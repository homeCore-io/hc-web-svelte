<script lang="ts">
	import type { DashboardDefinition, DashboardLayout, DashboardWidget as DashboardWidgetModel } from '$lib/models/dashboard';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';
	import type { HcEvent } from '$lib/models/event';
	import { titleCase } from '$lib/utils/formatting';

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

	const config = $derived((widget.config ?? {}) as Record<string, unknown>);
	const selectedDevices = $derived(selectDevices(config));
	const metrics = $derived((config.metrics as string[] | undefined) ?? []);
</script>

<article class="widget">
	<header>
		<h2>{widget.title}</h2>
		{#if widget.subtitle}
			<p>{widget.subtitle}</p>
		{/if}
	</header>

	{#if widget.type === 'markdown'}
		<div class="copy">
			<pre>{String(config.markdown ?? '')}</pre>
		</div>
	{:else if widget.type === 'stat_summary'}
		<div class="stats">
			{#each metrics as metric}
				<div class="stat">
					<strong>
						{#if metric === 'devices'}
							{devices.length}
						{:else if metric === 'on'}
							{devices.filter((device) => device.attributes.on === true).length}
						{:else if metric === 'offline'}
							{devices.filter((device) => !device.available).length}
						{:else if metric === 'media_playing'}
							{devices.filter((device) => device.attributes.state === 'playing').length}
						{:else}
							0
						{/if}
					</strong>
					<span>{titleCase(metric)}</span>
				</div>
			{/each}
		</div>
	{:else if widget.type === 'mode_chips'}
		<div class="chips">
			{#each modes as mode}
				<span class="chip">{mode.name ?? mode.device_id}</span>
			{/each}
		</div>
	{:else if widget.type === 'scene_row'}
		<div class="chips">
			{#each scenes as scene}
				<span class="chip">{scene.name}</span>
			{/each}
		</div>
	{:else if widget.type === 'device_grid'}
		<div class="device-grid">
			{#each selectedDevices as device}
				<div class="device-card">
					<strong>{device.name ?? device.device_id}</strong>
					<span>{device.area ?? device.device_type ?? 'Device'}</span>
				</div>
			{/each}
		</div>
	{:else if widget.type === 'device_list'}
		<ul class="device-list">
			{#each selectedDevices as device}
				<li>
					<strong>{device.name ?? device.device_id}</strong>
					<span>{device.area ?? device.device_type ?? 'Device'}</span>
				</li>
			{/each}
		</ul>
	{:else if widget.type === 'event_feed'}
		<ul class="event-list">
			{#each events.slice(0, Number(config.limit ?? 8)) as event}
				<li>
					<strong>{titleCase(event.type)}</strong>
					<span>{String(event.device_id ?? '')}</span>
				</li>
			{/each}
		</ul>
	{:else if widget.type === 'dashboard_link'}
		<div class="links">
			<a href="/dashboards">Manage dashboards</a>
			<a href="/dashboard">Default dashboard</a>
		</div>
	{:else}
		<div class="placeholder">
			<strong>{titleCase(widget.type)}</strong>
			<span>This widget is planned but not implemented in Milestone 1 yet.</span>
		</div>
	{/if}
</article>

<style>
	.widget {
		height: 100%;
		padding: 1rem;
		border-radius: 1rem;
		background: white;
		border: 1px solid #dbe4ee;
		box-shadow: 0 8px 24px rgba(16, 33, 50, 0.08);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow: hidden;
	}

	header h2 {
		margin: 0;
		font-size: 1rem;
	}

	header p {
		margin: 0.25rem 0 0;
		color: #637589;
		font-size: 0.9rem;
	}

	.copy,
	.placeholder {
		color: #415264;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
		font: inherit;
	}

	.stats,
	.device-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.stat,
	.device-card,
	.chip {
		padding: 0.85rem;
		border-radius: 0.85rem;
		background: #f3f6fa;
	}

	.stat strong,
	.device-card strong {
		display: block;
		font-size: 1.15rem;
	}

	.stat span,
	.device-card span,
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

	.device-list,
	.event-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	.device-list li,
	.event-list li {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid #e4ebf2;
	}

	.links a {
		text-decoration: none;
		color: #153a63;
		background: #edf3fa;
		padding: 0.7rem 0.9rem;
		border-radius: 999px;
	}
</style>
