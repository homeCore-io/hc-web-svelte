<script lang="ts">
	import DashboardCardShell from '$lib/components/dashboard/DashboardCardShell.svelte';
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import type {
		DashboardDefinition,
		DashboardLayout,
		DashboardWidget as DashboardWidgetModel
	} from '$lib/models/dashboard';
	import {
		boolAttr,
		deviceDisplayName,
		deviceStatusIconName,
		durationSecs,
		formatDuration,
		formatRelativeTime,
		isMediaPlayer,
		mediaArtist,
		mediaImageUrl,
		mediaSource,
		mediaSummary,
		playbackState,
		positionSecs,
		statusText,
		statusTone,
		volumePercent,
		type DeviceState
	} from '$lib/models/device';
	import type { HcEvent } from '$lib/models/event';
	import { modeDisplayName, modeStatusLabel, type ModeState } from '$lib/models/mode';
	import { dashboardCardSpec, dashboardWidgetLabel } from '$lib/models/dashboardCards';
	import type { Scene } from '$lib/models/scene';
	import { formatShortTimestamp, titleCase } from '$lib/utils/formatting';

	let {
		dashboard,
		layout,
		widget,
		devices = [],
		scenes = [],
		modes = [],
		events = []
	}: {
		dashboard: DashboardDefinition;
		layout: DashboardLayout;
		widget: DashboardWidgetModel;
		devices?: DeviceState[];
		scenes?: Scene[];
		modes?: ModeState[];
		events?: HcEvent[];
	} = $props();

	function selectDevices(config: Record<string, unknown>): DeviceState[] {
		const selectionMode = (config.selection_mode as string | undefined) ?? 'query';
		const limit = typeof config.limit === 'number' ? config.limit : 999;
		const showOffline = (config.show_offline as boolean | undefined) ?? true;
		let selected = devices;

		if (selectionMode === 'manual') {
			const ids = new Set((config.device_ids as string[] | undefined) ?? []);
			selected = devices.filter((device) => ids.has(device.device_id));
		} else if (selectionMode === 'area') {
			const area = (config.area_name as string | undefined) ?? '';
			selected = area ? devices.filter((device) => device.area === area) : devices;
		} else {
			const query = ((config.query as string | undefined) ?? '').toLowerCase();
			if (query) {
				selected = devices.filter((device) =>
					[
						device.name,
						device.device_id,
						device.canonical_name,
						device.area,
						device.device_type
					]
						.filter(Boolean)
						.join(' ')
						.toLowerCase()
						.includes(query)
				);
			}
		}

		if (!showOffline) {
			selected = selected.filter((device) => device.available);
		}

		return selected.slice(0, limit);
	}

	function metricValue(metric: string): number {
		if (metric === 'devices') return devices.length;
		if (metric === 'on') return devices.filter((device) => device.attributes.on === true).length;
		if (metric === 'offline') return devices.filter((device) => !device.available).length;
		if (metric === 'media_playing') {
			return devices.filter((device) => device.attributes.state === 'playing').length;
		}
		return 0;
	}

	function selectHistoryDevices(config: Record<string, unknown>): DeviceState[] {
		const ids = (config.device_ids as string[] | undefined) ?? [];
		if (ids.length > 0) {
			const idSet = new Set(ids);
			return devices.filter((device) => idSet.has(device.device_id));
		}
		const area = String(config.area_name ?? '').trim();
		if (area) {
			return devices.filter((device) => device.area === area);
		}
		const query = String(config.query ?? '').trim().toLowerCase();
		if (!query) return [];
		return devices.filter((device) =>
			[
				device.name,
				device.device_id,
				device.canonical_name,
				device.area,
				device.device_type
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(query)
		);
	}

	function eventDetail(event: HcEvent): string {
		if (typeof event.rule_name === 'string' && event.rule_name) return event.rule_name;
		if (typeof event.scene_name === 'string' && event.scene_name) return event.scene_name;
		if (typeof event.message === 'string' && event.message) return event.message;
		if (typeof event.device_id === 'string' && event.device_id) return event.device_id;
		return 'HomeCore';
	}

	function deviceMeta(device: DeviceState): string {
		const on = boolAttr(device.attributes.on);
		const locked = boolAttr(device.attributes.locked);
		const motion = boolAttr(device.attributes.motion);
		const open = boolAttr(device.attributes.open ?? device.attributes.contact);
		if (locked !== null) return locked ? 'Secure' : 'Unlocked';
		if (motion !== null) return motion ? 'Activity now' : 'No motion';
		if (open !== null) return open ? 'Open' : 'Closed';
		if (on !== null) return on ? 'Active' : 'Idle';
		return device.device_type?.replaceAll('_', ' ') ?? 'Device';
	}

	function deviceLastLine(device: DeviceState): string {
		if (!device.available) return 'Offline';
		return `Updated ${formatRelativeTime(device.last_seen)}`;
	}

	function eventTone(event: HcEvent): 'good' | 'warn' | 'media' | 'neutral' {
		if (event.type.includes('scene')) return 'good';
		if (event.type.includes('alert') || event.type.includes('offline')) return 'warn';
		if (event.type.includes('media')) return 'media';
		return 'neutral';
	}

	function csvValue(value: unknown): string {
		return Array.isArray(value) ? value.join(', ') : '';
	}

	function historyValue(device: DeviceState): { label: string; value: number } | null {
		const candidates: Array<[string, unknown]> = [
			['Power', device.attributes.power],
			['Temperature', device.attributes.temperature],
			['Humidity', device.attributes.humidity],
			['Brightness', device.attributes.brightness],
			['Level', device.attributes.level]
		];
		for (const [label, raw] of candidates) {
			if (typeof raw === 'number' && Number.isFinite(raw)) {
				return { label, value: raw };
			}
		}
		return null;
	}

	const config = $derived((widget.config ?? {}) as Record<string, unknown>);
	const selectedDevices = $derived(selectDevices(config));
	const selectedDevice = $derived(selectedDevices[0] ?? null);
	const selectedModes = $derived.by(() => {
		const ids = (config.mode_ids as string[] | undefined) ?? [];
		if (!ids.length) return modes;
		const idSet = new Set(ids);
		return modes.filter((mode) => idSet.has(mode.device_id));
	});
	const selectedScenes = $derived.by(() => {
		const ids = (config.scene_ids as string[] | undefined) ?? [];
		if (!ids.length) return scenes;
		const idSet = new Set(ids);
		return scenes.filter((scene) => idSet.has(scene.id));
	});
	const metrics = $derived((config.metrics as string[] | undefined) ?? []);
	const historyDevices = $derived(selectHistoryDevices(config).slice(0, 6));
	const historySnapshots = $derived.by(() =>
		historyDevices
			.map((device) => {
				const snapshot = historyValue(device);
				return snapshot ? { device, ...snapshot } : null;
			})
			.filter((entry) => entry !== null)
	);
	const eventLimit = $derived(Number(config.limit ?? 8));
	const spec = $derived(dashboardCardSpec(widget.type));
	const footerSummary = $derived(
		widget.refresh_policy === 'live'
			? 'Live'
			: widget.refresh_policy === 'poll'
				? 'Polling'
				: widget.refresh_policy === 'manual'
					? 'Manual'
					: 'Passive'
	);
</script>

<DashboardCardShell
	title={widget.title}
	subtitle={widget.subtitle}
	eyebrow={spec.family}
	icon={spec.icon}
	tone={spec.tone}
	size={spec.size}
	compact={widget.type === 'device_list'}
	contentClass={widget.type === 'device_list' ? 'widget-body scroll-body' : 'widget-body'}
>
	{#snippet meta()}
		<span class="meta-chip">{dashboardWidgetLabel(widget.type)}</span>
	{/snippet}

	{#if widget.type === 'markdown'}
		<div class="copy">
			<pre>{String(config.markdown ?? '')}</pre>
		</div>
	{:else if widget.type === 'stat_summary'}
		<div class="stats">
			{#each metrics as metric}
				<div class="stat">
					<strong>{metricValue(metric)}</strong>
					<span>{titleCase(metric)}</span>
				</div>
			{/each}
		</div>
	{:else if widget.type === 'mode_chips'}
		<div class="chips">
			{#each selectedModes as mode}
				<span class={`chip tone-${mode.on ? 'good' : 'neutral'}`}>
					<strong>{modeDisplayName(mode)}</strong>
					<small>{modeStatusLabel(mode)}</small>
				</span>
			{/each}
		</div>
	{:else if widget.type === 'scene_row'}
		<div class="chips">
			{#each selectedScenes as scene}
				<a class="chip action-chip" href="/scenes">
					<span class="chip-icon" aria-hidden="true"><MaterialIcon name="scenes" size={16} /></span>
					<strong>{scene.name}</strong>
					<small>Open scenes</small>
				</a>
			{/each}
		</div>
	{:else if widget.type === 'device_grid'}
		<div class="device-grid">
			{#each selectedDevices as device}
				<a class="device-card device-link" href={`/devices/${device.device_id}`}>
					<div class="device-card-top">
						<div class={`device-status tone-${statusTone(device)}`}>
							<MaterialIcon name={deviceStatusIconName(device)} size={18} />
						</div>
						<span class={`device-pill tone-${statusTone(device)}`}>{statusText(device)}</span>
					</div>
					<div class="device-copy">
						<strong>{deviceDisplayName(device)}</strong>
						<span>{deviceMeta(device)}</span>
						<small>{device.area ?? device.device_type ?? 'Device'} · {deviceLastLine(device)}</small>
					</div>
				</a>
			{/each}
		</div>
	{:else if widget.type === 'device_tile'}
		{#if selectedDevice}
			<a class="device-card device-tile device-link" href={`/devices/${selectedDevice.device_id}`}>
				<div class="device-card-top">
					<div class={`device-status tone-${statusTone(selectedDevice)}`}>
						<MaterialIcon name={deviceStatusIconName(selectedDevice)} size={18} />
					</div>
					<span class={`device-pill tone-${statusTone(selectedDevice)}`}>{statusText(selectedDevice)}</span>
				</div>
				<div class="device-copy">
					<strong>{deviceDisplayName(selectedDevice)}</strong>
					<span>{deviceMeta(selectedDevice)}</span>
					<small>{selectedDevice.area ?? selectedDevice.device_type ?? 'Device'} · {deviceLastLine(selectedDevice)}</small>
				</div>
			</a>
		{:else}
			<div class="placeholder">
				<strong>Select a device</strong>
				<span>This tile needs one matching device to render.</span>
			</div>
		{/if}
	{:else if widget.type === 'device_list'}
		<ul class="device-list compact-device-list">
			{#each selectedDevices as device}
				<li class="device-row-card">
					<a class="device-link" href={`/devices/${device.device_id}`}>
						<div class="device-list-layout">
							<div class={`device-status device-status-inline tone-${statusTone(device)}`}>
								<MaterialIcon name={deviceStatusIconName(device)} size={16} />
							</div>
							<div class="device-list-copy">
								<div class="device-list-row">
									<strong>{deviceDisplayName(device)}</strong>
									<span class={`inline-pill tone-${statusTone(device)}`}>{statusText(device)}</span>
								</div>
								<span>{deviceMeta(device)}</span>
								<small>{device.area ?? device.device_type ?? 'Device'} · {deviceLastLine(device)}</small>
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else if widget.type === 'event_feed'}
		<ul class="event-list">
			{#each events.slice(0, eventLimit) as event}
				<li class="event-card">
					<div class="event-row">
						<span class={`event-pill tone-${eventTone(event)}`}>{titleCase(event.type)}</span>
						<small>{formatShortTimestamp(event.timestamp)}</small>
					</div>
					<strong class="event-title">{eventDetail(event)}</strong>
					<span>{typeof event.device_id === 'string' && event.device_id ? event.device_id : 'HomeCore'}</span>
				</li>
			{/each}
		</ul>
	{:else if widget.type === 'media_player'}
		{#if selectedDevice}
			<div class="media-card">
				{#if mediaImageUrl(selectedDevice)}
					<img class="media-art" src={mediaImageUrl(selectedDevice) ?? ''} alt="" />
				{/if}
				<div class="media-copy">
					<div class="media-head">
						<span class={`device-pill tone-${statusTone(selectedDevice)}`}>{statusText(selectedDevice)}</span>
						{#if volumePercent(selectedDevice) !== null}
							<small>Volume {volumePercent(selectedDevice)}%</small>
						{/if}
					</div>
					<strong>{mediaSummary(selectedDevice) ?? deviceDisplayName(selectedDevice)}</strong>
					<span>{mediaSource(selectedDevice) ?? playbackState(selectedDevice)}</span>
					<small>
						{#if positionSecs(selectedDevice) !== null || durationSecs(selectedDevice) !== null}
							{formatDuration(positionSecs(selectedDevice))} / {formatDuration(durationSecs(selectedDevice))}
						{:else}
							{selectedDevice.area ?? selectedDevice.device_type ?? 'Media player'}
						{/if}
					</small>
				</div>
			</div>
		{:else}
			<div class="placeholder">
				<strong>Select a media player</strong>
				<span>This card needs one matching media player device.</span>
			</div>
		{/if}
	{:else if widget.type === 'camera_video'}
		<div class="embed-card">
			{#if String(config.url ?? '').trim()}
				<img class="camera-preview" src={String(config.url)} alt="" />
			{/if}
			<strong>{String(config.url ?? '').trim() || 'Camera source not configured'}</strong>
			<span>{String(config.source_type ?? 'url') === 'url' ? 'Remote camera source' : 'Camera source'}</span>
			<small>Refresh every {Number(config.refresh_secs ?? 15)}s</small>
			{#if String(config.url ?? '').trim()}
				<a class="embed-link" href={String(config.url)} target="_blank" rel="noreferrer">Open camera feed</a>
			{/if}
		</div>
	{:else if widget.type === 'web_embed'}
		<div class="embed-card">
			{#if String(config.url ?? '').trim()}
				<iframe
					class="embed-frame"
					src={String(config.url)}
					title={widget.title}
					loading="lazy"
					referrerpolicy="no-referrer"
				></iframe>
			{/if}
			<strong>{String(config.url ?? '').trim() || 'Embed URL not configured'}</strong>
			<span>Embedded web content</span>
			<small>Manual refresh surface</small>
			{#if String(config.url ?? '').trim()}
				<a class="embed-link" href={String(config.url)} target="_blank" rel="noreferrer">Open source</a>
			{/if}
		</div>
	{:else if widget.type === 'history_chart'}
		<div class="history-card">
			<div class="history-stat">
				<strong>{Number(config.timeframe_hours ?? 24)}h</strong>
				<span>Timeframe</span>
			</div>
			<div class="history-copy">
				<strong>{String(config.query ?? '').trim() || csvValue(config.device_ids) || 'Device history'}</strong>
				<span>
					{csvValue(config.device_ids)
						? 'Selected devices'
						: String(config.area_name ?? '').trim()
							? `Area ${String(config.area_name).trim()}`
							: 'Query-based history'}
				</span>
				<small>Showing up to {Number(config.limit ?? 24)} points</small>
				{#if historySnapshots.length > 0}
					<div class="history-bars">
						{#each historySnapshots as entry}
							<div class="history-bar-row">
								<div class="history-bar-copy">
									<strong>{deviceDisplayName(entry.device)}</strong>
									<small>{entry.label}</small>
								</div>
								<div class="history-bar-track">
									<span class="history-bar-fill" style={`width:${Math.max(8, Math.min(100, entry.value))}%`}></span>
								</div>
								<span class="history-bar-value">{Math.round(entry.value)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else if widget.type === 'dashboard_link'}
		<div class="links">
			{#if ((config.dashboard_ids as string[] | undefined) ?? []).length > 0}
				{#each (config.dashboard_ids as string[] | undefined) ?? [] as dashboardId}
					<a href={`/dashboards/${dashboardId}`}>{titleCase(dashboardId.replaceAll('_', ' '))}</a>
				{/each}
			{:else}
				<a href="/dashboards">Manage dashboards</a>
				<a href="/dashboard">Default dashboard</a>
			{/if}
		</div>
	{:else}
		<div class="placeholder">
			<strong>{titleCase(widget.type)}</strong>
			<span>This widget is planned but not implemented in Milestone 1 yet.</span>
		</div>
	{/if}

	{#snippet footer()}
		<span class="footer-chip">{footerSummary}</span>
		<span class="footer-chip">{layout.breakpoint}</span>
		<span class="footer-chip">{dashboard.name}</span>
	{/snippet}
</DashboardCardShell>

<style>
	.copy,
	.placeholder {
		color: #415264;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
		font: inherit;
		line-height: 1.55;
	}

	.stats,
	.device-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.stat,
	.device-card {
		padding: 0.9rem;
		border-radius: 0.55rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.stat {
		display: grid;
		gap: 0.25rem;
	}

	.stat strong,
	.device-copy strong {
		display: block;
		font-size: 1.35rem;
	}

	.stat span,
	.device-copy span,
	.device-list span,
	.event-list span,
	.placeholder span {
		color: #66778b;
		font-size: 0.9rem;
	}

	.chips,
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.chip {
		padding: 0.62rem 0.74rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: #15334f;
		text-decoration: none;
	}

	.chip-icon {
		display: inline-grid;
		place-items: center;
		color: #2b5f8a;
	}

	.chip strong {
		font-size: 0.92rem;
	}

	.chip small {
		font-size: 0.76rem;
		color: #66778b;
	}

	.device-list,
	.event-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	:global(.scroll-body) {
		min-height: 0;
	}

	.compact-device-list {
		height: 100%;
		overflow: auto;
		align-content: start;
		gap: 0.45rem;
		padding-right: 0.2rem;
		scrollbar-gutter: stable;
	}

	.device-list li,
	.event-list li {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #e4ebf2;
	}

	.device-list li:last-child,
	.event-list li:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.compact-device-list li {
		gap: 0.14rem;
		padding-bottom: 0.45rem;
	}

	.device-link {
		color: inherit;
		text-decoration: none;
	}

	.device-link:hover strong {
		text-decoration: underline;
	}

	.device-card {
		display: grid;
		gap: 0.65rem;
	}

	.device-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.device-copy {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
	}

	.device-copy small,
	.device-list small,
	.event-row small {
		color: #73859a;
		font-size: 0.78rem;
	}

	.device-status {
		width: 2rem;
		height: 2rem;
		flex: none;
		border-radius: 0.45rem;
		display: grid;
		place-items: center;
		background: rgba(92, 118, 143, 0.12);
		color: #335474;
	}

	.device-status-inline {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.4rem;
	}

	.device-list-row,
	.event-row {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: baseline;
	}

	.compact-device-list .device-list-row {
		gap: 0.35rem;
		align-items: center;
	}

	.device-list-layout {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.55rem;
		align-items: start;
	}

	.device-list-copy {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
	}

	.device-row-card {
		padding: 0.62rem 0.68rem 0.58rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.compact-device-list strong {
		font-size: 0.9rem;
		line-height: 1.2;
	}

	.compact-device-list span {
		font-size: 0.8rem;
	}

	.compact-device-list small {
		font-size: 0.72rem;
		line-height: 1.2;
	}

	.device-pill,
	.event-pill,
	.inline-pill,
	.meta-chip,
	.footer-chip {
		padding: 0.26rem 0.55rem;
		border-radius: 0.4rem;
		font-size: 0.76rem;
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
	}

	.footer-chip {
		background: var(--hc-surface-soft);
	}

	.event-card {
		padding: 0.72rem 0.76rem 0.68rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.event-title {
		font-size: 0.86rem;
		line-height: 1.25;
		color: var(--hc-text);
	}

	.links a {
		text-decoration: none;
		color: var(--hc-accent);
		background: var(--hc-surface);
		padding: 0.68rem 0.82rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
	}

	.media-card,
	.embed-card,
	.history-card {
		display: grid;
		gap: 0.6rem;
		padding: 0.82rem;
		border-radius: 0.5rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.media-card {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
	}

	.media-art {
		width: 4rem;
		height: 4rem;
		border-radius: 0.45rem;
		object-fit: cover;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
	}

	.media-copy,
	.history-copy {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
	}

	.media-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
	}

	.media-copy strong,
	.embed-card strong,
	.history-copy strong {
		font-size: 0.95rem;
	}

	.media-copy span,
	.embed-card span,
	.history-copy span {
		font-size: 0.82rem;
		color: var(--hc-text-muted);
	}

	.media-copy small,
	.embed-card small,
	.history-copy small {
		font-size: 0.76rem;
		color: #73859a;
	}

	.embed-link {
		color: var(--hc-accent);
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.camera-preview,
	.embed-frame {
		width: 100%;
		min-height: 8rem;
		border: 1px solid var(--hc-border);
		border-radius: 0.45rem;
		background: var(--hc-surface);
	}

	.camera-preview {
		object-fit: cover;
	}

	.embed-frame {
		border: 1px solid var(--hc-border);
	}

	.history-card {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
	}

	.history-stat {
		display: grid;
		gap: 0.12rem;
		padding-right: 0.75rem;
		border-right: 1px solid var(--hc-border);
	}

	.history-stat strong {
		font-size: 1.2rem;
	}

	.history-stat span {
		font-size: 0.74rem;
		color: var(--hc-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.history-bars {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}

	.history-bar-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
		gap: 0.5rem;
		align-items: center;
	}

	.history-bar-copy {
		display: grid;
		gap: 0.05rem;
		min-width: 0;
	}

	.history-bar-copy strong {
		font-size: 0.78rem;
	}

	.history-bar-copy small,
	.history-bar-value {
		font-size: 0.72rem;
		color: var(--hc-text-muted);
	}

	.history-bar-track {
		height: 0.38rem;
		border-radius: 999px;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		overflow: hidden;
	}

	.history-bar-fill {
		display: block;
		height: 100%;
		background: var(--hc-accent);
	}

	.tone-good {
		background: var(--hc-success-soft);
		color: var(--hc-success);
	}

	.tone-warn {
		background: var(--hc-warn-soft);
		color: var(--hc-warn);
	}

	.tone-media {
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
	}

	.tone-neutral,
	.tone-idle {
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
	}

	.tone-offline {
		background: var(--hc-danger-soft);
		color: var(--hc-danger);
	}

	@media (max-width: 720px) {
		.device-list-row,
		.event-row {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
