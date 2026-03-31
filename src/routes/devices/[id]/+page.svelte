<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { deleteDevice, getDevice, listDevices, setDeviceState, updateDevice } from '$lib/api/devices';
	import {
		formatRelativeTime,
		deviceCanonicalReference,
		deviceDisplayName,
		durationSecs,
		formatDuration,
		isMediaPlayer,
		mediaAlbum,
		mediaArtist,
		mediaSource,
		mediaTitle,
		muted,
		playbackState,
		positionSecs,
		sonosData,
		statusText,
		supportedActions,
		supportsAction,
		uiEnrichments,
		volumePercent,
		type DeviceState
	} from '$lib/models/device';

	let { params }: { params: { id: string } } = $props();

	let device = $state<DeviceState | null>(null);
	let loading = $state(true);
	let busy = $state(false);
	let savingMeta = $state(false);
	let deleting = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let areaOptions = $state<string[]>([]);
	let editName = $state('');
	let editArea = $state('');
	let editCanonicalName = $state('');
	let areaSelectValue = $state('');

	$effect(() => {
		void refresh();
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			const [loadedDevice, devices] = await Promise.all([getDevice(params.id), listDevices()]);
			device = loadedDevice;
			editName = loadedDevice.name ?? '';
			editArea = loadedDevice.area ?? '';
			editCanonicalName = loadedDevice.canonical_name ?? '';
			areaOptions = [...new Set(devices.map((item) => item.area?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
			areaSelectValue = loadedDevice.area && areaOptions.includes(loadedDevice.area) ? loadedDevice.area : loadedDevice.area ? '__custom__' : '';
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load device';
		} finally {
			loading = false;
		}
	}

	async function send(body: Record<string, unknown>, label: string) {
		if (!device) return;
		busy = true;
		error = null;
		notice = null;
		try {
			await setDeviceState(device.device_id, body);
			notice = `${label} sent`;
			await refresh();
		} catch (value) {
			error = value instanceof Error ? value.message : `${label} failed`;
		} finally {
			busy = false;
		}
	}

	async function saveMetadata() {
		if (!device) return;
		savingMeta = true;
		error = null;
		notice = null;
		try {
			const resolvedArea =
				areaSelectValue === '__custom__'
					? (editArea.trim() ? editArea.trim() : null)
					: (areaSelectValue || null);
			const updated = await updateDevice(device.device_id, {
				name: editName.trim() || device.device_id,
				area: resolvedArea,
				canonical_name: editCanonicalName.trim() ? editCanonicalName.trim() : null
			});
			device = updated;
			editName = updated.name ?? '';
			editArea = updated.area ?? '';
			editCanonicalName = updated.canonical_name ?? '';
			areaSelectValue = updated.area && areaOptions.includes(updated.area) ? updated.area : updated.area ? '__custom__' : '';
			notice = 'Device details saved';
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to save device details';
		} finally {
			savingMeta = false;
		}
	}

	async function removeDevice() {
		if (!device || !browser) return;
		const confirmed = window.confirm(`Delete device "${deviceDisplayName(device)}"?`);
		if (!confirmed) return;
		deleting = true;
		error = null;
		notice = null;
		try {
			await deleteDevice(device.device_id);
			void goto('/devices');
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to delete device';
			deleting = false;
		}
	}

	const visibleEntries = $derived.by(() => {
		if (!device) return [] as [string, unknown][];
		const hidden = new Set([
			'title','artist','album','source','position_secs','duration_secs','media_title',
			'media_artist','media_album','media_position','media_duration','volume','muted',
			'supported_actions','ui_enrichments','sonos'
		]);
		return Object.entries(device.attributes)
			.filter(([key]) => !hidden.has(key))
			.sort((a, b) => a[0].localeCompare(b[0]));
	});

	const favoriteNames = $derived.by(() => {
		if (!device) return [] as string[];
		const sonos = sonosData(device);
		const raw = (sonos.favorites as unknown[] | undefined) ?? (device.attributes.available_favorites as unknown[] | undefined) ?? [];
		return raw.filter((value): value is string => typeof value === 'string');
	});

	const playlistNames = $derived.by(() => {
		if (!device) return [] as string[];
		const sonos = sonosData(device);
		const raw = (sonos.playlists as unknown[] | undefined) ?? (device.attributes.available_playlists as unknown[] | undefined) ?? [];
		return raw.filter((value): value is string => typeof value === 'string');
	});

	const groupMembers = $derived.by(() => {
		if (!device) return [] as string[];
		const sonos = sonosData(device);
		const raw = (sonos.group_members as unknown[] | undefined) ?? (device.attributes.group_members as unknown[] | undefined) ?? [];
		return raw.filter((value): value is string => typeof value === 'string');
	});
	const knownAreas = $derived.by(() => {
		const areas = [...areaOptions];
		if (device?.area && !areas.includes(device.area)) areas.push(device.area);
		return areas.sort((a, b) => a.localeCompare(b));
	});
</script>

{#if loading}
	<p>Loading device…</p>
{:else if error && !device}
	<p class="error">{error}</p>
{:else if device}
	<section class="page">
		<div class="heading">
			<div>
				<a class="back-link" href="/devices">← Back to devices</a>
				<h1>{deviceDisplayName(device)}</h1>
				<p>{device.device_type ?? 'device'} via {device.plugin_id}</p>
			</div>
			<div class="actions">
				<span class:offline={!device.available}>{device.available ? 'Online' : 'Offline'}</span>
				<button type="button" onclick={refresh} disabled={loading || busy}>
					{loading ? 'Refreshing…' : 'Refresh'}
				</button>
			</div>
		</div>

		{#if error}
			<p class="error">{error}</p>
		{/if}
		{#if notice}
			<p class="notice">{notice}</p>
		{/if}

		<div class="columns">
			<section class="panel">
				<h2>Overview</h2>
				<div class="chips">
					<span class:offline={!device.available}>{device.available ? 'Online' : 'Offline'}</span>
					<span class="meta-chip">{device.device_type ?? 'device'}</span>
					<span class="meta-chip">{device.plugin_id}</span>
					{#if device.area}<span class="meta-chip">{device.area}</span>{/if}
					<a class="chip-link" href={`/events?device_id=${encodeURIComponent(device.device_id)}`}>Recent events</a>
				</div>
				<div class="info-grid">
					<div>
						<dt>Status</dt>
						<dd>{statusText(device)}</dd>
					</div>
					<div>
						<dt>Last seen</dt>
						<dd>{formatRelativeTime(device.last_seen)}</dd>
					</div>
					<div>
						<dt>Device ID</dt>
						<dd>{device.device_id}</dd>
					</div>
					<div>
						<dt>Canonical</dt>
						<dd>{deviceCanonicalReference(device)}</dd>
					</div>
					<div>
						<dt>Area</dt>
						<dd>{device.area ?? 'Unassigned'}</dd>
					</div>
					<div>
						<dt>Supported actions</dt>
						<dd>{supportedActions(device).length ? supportedActions(device).join(', ') : 'None published'}</dd>
					</div>
				</div>
			</section>

			<section class="panel">
				<h2>Edit Metadata</h2>
				<div class="form-grid">
					<label>
						<span>Name</span>
						<input bind:value={editName} placeholder="Device name" />
					</label>
					<label>
						<span>Area</span>
						<select
							bind:value={areaSelectValue}
							onchange={() => {
								if (areaSelectValue !== '__custom__') editArea = areaSelectValue;
							}}
						>
							<option value="">Unassigned</option>
							{#each knownAreas as area}
								<option value={area}>{area}</option>
							{/each}
							<option value="__custom__">Custom…</option>
						</select>
					</label>
					{#if areaSelectValue === '__custom__'}
						<label>
							<span>Custom area</span>
							<input bind:value={editArea} placeholder="Area name" />
						</label>
					{/if}
					<label>
						<span>Canonical name</span>
						<input bind:value={editCanonicalName} placeholder="living_room.floor_lamp" />
					</label>
				</div>
				<div class="form-actions">
					<button type="button" onclick={saveMetadata} disabled={savingMeta || busy || deleting}>
						{savingMeta ? 'Saving…' : 'Save details'}
					</button>
					<button type="button" class="secondary" onclick={() => {
						editName = device?.name ?? '';
						editArea = device?.area ?? '';
						editCanonicalName = device?.canonical_name ?? '';
					}} disabled={savingMeta || deleting}>
						Reset
					</button>
					<button type="button" class="danger" onclick={removeDevice} disabled={savingMeta || deleting}>
						{deleting ? 'Deleting…' : 'Delete device'}
					</button>
				</div>
			</section>

			{#if isMediaPlayer(device)}
				<section class="panel">
					<h2>Media</h2>
					<div class="media-meta">
						<strong>{mediaTitle(device) ?? playbackState(device)}</strong>
						{#if mediaArtist(device)}<p>{mediaArtist(device)}</p>{/if}
						{#if mediaAlbum(device)}<p>{mediaAlbum(device)}</p>{/if}
						{#if mediaSource(device)}<p>Source: {mediaSource(device)}</p>{/if}
					</div>

					{#if durationSecs(device) !== null}
						<div class="progress">
							<progress
								value={positionSecs(device) ?? 0}
								max={durationSecs(device) ?? 1}
							></progress>
							<div class="progress-label">
								<span>{formatDuration(positionSecs(device))}</span>
								<span>{formatDuration(durationSecs(device))}</span>
							</div>
						</div>
					{/if}

					<div class="control-row">
						{#if supportsAction(device, 'play')}
							<button type="button" onclick={() => send({ action: 'play' }, 'Play')} disabled={busy}>Play</button>
						{/if}
						{#if supportsAction(device, 'pause')}
							<button type="button" class="secondary" onclick={() => send({ action: 'pause' }, 'Pause')} disabled={busy}>Pause</button>
						{/if}
						{#if supportedActions(device).includes('stop')}
							<button type="button" class="secondary" onclick={() => send({ action: 'stop' }, 'Stop')} disabled={busy}>Stop</button>
						{/if}
						{#if supportedActions(device).includes('previous')}
							<button type="button" class="secondary" onclick={() => send({ action: 'previous' }, 'Previous')} disabled={busy}>Previous</button>
						{/if}
						{#if supportedActions(device).includes('next')}
							<button type="button" class="secondary" onclick={() => send({ action: 'next' }, 'Next')} disabled={busy}>Next</button>
						{/if}
					</div>

					<div class="media-grid">
						<div>
							<dt>Playback</dt>
							<dd>{playbackState(device)}</dd>
						</div>
						{#if volumePercent(device) !== null}
							<div>
								<dt>Volume</dt>
								<dd>{volumePercent(device)}%</dd>
							</div>
						{/if}
						{#if muted(device) !== null}
							<div>
								<dt>Muted</dt>
								<dd>{muted(device) ? 'Yes' : 'No'}</dd>
							</div>
						{/if}
					</div>
				</section>
			{/if}
		</div>

		<section class="panel">
			<h2>Diagnostics</h2>
			<div class="info-grid">
				<div>
					<dt>Plugin</dt>
					<dd>{device.plugin_id}</dd>
				</div>
				<div>
					<dt>Type</dt>
					<dd>{device.device_type ?? 'device'}</dd>
				</div>
				<div>
					<dt>Last seen</dt>
					<dd>{device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Unknown'}</dd>
				</div>
				<div>
					<dt>UI enrichments</dt>
					<dd>{uiEnrichments(device).length ? uiEnrichments(device).join(', ') : 'None'}</dd>
				</div>
			</div>
		</section>

		{#if isMediaPlayer(device) && (favoriteNames.length || playlistNames.length || groupMembers.length || uiEnrichments(device).length)}
			<section class="panel">
				<h2>Plugin Enrichments</h2>
				{#if uiEnrichments(device).length}
					<div class="chips">
						{#each uiEnrichments(device) as enrichment}
							<span class="chip">{enrichment}</span>
						{/each}
					</div>
				{/if}
				{#if groupMembers.length}
					<p>Group: {groupMembers.join(', ')}</p>
				{/if}
				{#if favoriteNames.length}
					<div class="action-list">
						<strong>Favorites</strong>
						<div class="chips">
							{#each favoriteNames.slice(0, 6) as favorite}
								<button type="button" class="secondary" onclick={() => send({ action: 'play_media', media_type: 'favorite', name: favorite }, `Play ${favorite}`)} disabled={busy}>
									{favorite}
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if playlistNames.length}
					<div class="action-list">
						<strong>Playlists</strong>
						<div class="chips">
							{#each playlistNames.slice(0, 6) as playlist}
								<button type="button" class="secondary" onclick={() => send({ action: 'play_media', media_type: 'playlist', name: playlist }, `Play ${playlist}`)} disabled={busy}>
									{playlist}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		{/if}

		<section class="panel">
			<h2>Attributes</h2>
			{#if visibleEntries.length === 0}
				<p>No additional attributes.</p>
			{:else}
				<dl>
					{#each visibleEntries as [key, value]}
						<div>
							<dt>{key}</dt>
							<dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</section>
	</section>
{/if}

<style>
	.page { display: grid; gap: 1rem; }
	.columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
	.heading, .actions, .control-row, .chips, .progress-label { display: flex; gap: 0.75rem; }
	.heading { justify-content: space-between; align-items: start; }
	.actions { align-items: center; }
	.back-link {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: #e7eef6;
		color: #183b60;
		text-decoration: none;
		font-size: 0.92rem;
		margin-bottom: 0.6rem;
	}
	.back-link:hover { background: #dce7f3; }
	.panel {
		background: rgba(255,255,255,0.82);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
		display: grid;
		gap: 0.8rem;
	}
	.form-grid { display: grid; gap: 0.8rem; }
	.form-grid label { display: grid; gap: 0.35rem; }
	.form-grid span { padding: 0; background: transparent; color: #617486; font-size: 0.82rem; }
	h1, h2, p, dl { margin: 0; }
	p { color: #627488; }
	dl { display: grid; gap: 0.55rem; }
	dl div, .media-grid { display: grid; gap: 0.15rem; }
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem 1rem;
	}
	.info-grid > div { display: grid; gap: 0.15rem; }
	.media-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
	dt { font-size: 0.78rem; color: #6a7b8d; text-transform: uppercase; }
	dd { margin: 0; font-size: 0.95rem; color: #203242; word-break: break-word; }
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
		font: inherit;
	}
	input {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
	select {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	.secondary { background: #e7eef6; color: #183b60; }
	.danger { background: #f7e3e3; color: #8b2a2a; }
	span, .chip {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: #dff4e7;
		color: #14633a;
		font-size: 0.8rem;
		width: fit-content;
	}
	.offline { background: #f4dfdf; color: #8b2a2a; }
	.meta-chip { background: #e7eef6; color: #183b60; }
	.chip-link {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: #edf4fb;
		color: #214564;
		font-size: 0.8rem;
		text-decoration: none;
	}
	.chip-link:hover { text-decoration: underline; }
	.notice { color: #14633a; }
	.error { color: #b53622; }
	.chips { flex-wrap: wrap; }
	.media-meta { display: grid; gap: 0.25rem; }
	progress { width: 100%; height: 0.75rem; }
	.progress { display: grid; gap: 0.35rem; }
	.progress-label { justify-content: space-between; color: #627488; font-size: 0.9rem; }
	.action-list { display: grid; gap: 0.5rem; }
	@media (max-width: 860px) {
		.heading { flex-direction: column; }
		.actions, .control-row { flex-wrap: wrap; }
	}
</style>
