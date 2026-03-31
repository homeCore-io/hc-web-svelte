<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { listDevices, setDeviceState } from '$lib/api/devices';
	import {
		boolAttr,
		deviceDisplayName,
		formatRelativeTime,
		isSceneLikeDevice,
		isMediaPlayer,
		mediaImageUrl,
		mediaSummary,
		playbackState,
		sortText,
		statusIcon,
		statusText,
		statusTone,
		supportsAction,
		supportsInlineToggle,
		type DeviceState
	} from '$lib/models/device';

	type AvailabilityFilter = 'all' | 'online' | 'offline';
	type Density = 'comfortable' | 'compact';
	type SortKey = 'name' | 'area' | 'status' | 'type' | 'last_seen';
	type SortDirection = 'asc' | 'desc';
	type DeviceColumn =
		| 'status_icon'
		| 'name'
		| 'area'
		| 'device_type'
		| 'status_text'
		| 'media_info'
		| 'last_seen'
		| 'control'
		| 'canonical_name'
		| 'plugin';

	type DevicePrefs = {
		columns: DeviceColumn[];
		density: Density;
		showMediaDetails: boolean;
	};

	const PREFS_KEY = 'hc-web-svelte:devices:grid';
	const defaultColumns: DeviceColumn[] = [
		'status_icon',
		'name',
		'area',
		'device_type',
		'status_text',
		'last_seen',
		'control'
	];
	const allColumns: { id: DeviceColumn; label: string }[] = [
		{ id: 'status_icon', label: 'Status icon' },
		{ id: 'name', label: 'Name' },
		{ id: 'area', label: 'Area' },
		{ id: 'device_type', label: 'Type' },
		{ id: 'status_text', label: 'Status' },
		{ id: 'media_info', label: 'Media info' },
		{ id: 'last_seen', label: 'Last changed' },
		{ id: 'control', label: 'Control' },
		{ id: 'canonical_name', label: 'Canonical name' },
		{ id: 'plugin', label: 'Plugin' }
	];

	let devices = $state<DeviceState[]>([]);
	let loading = $state(true);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let search = $state('');
	let availability = $state<AvailabilityFilter>('all');
	let areaFilter = $state('all');
	let typeFilter = $state('all');
	let sortBy = $state<SortKey>('name');
	let sortDirection = $state<SortDirection>('asc');
	let density = $state<Density>('comfortable');
	let showMediaDetails = $state(false);
	let visibleColumns = $state<DeviceColumn[]>([...defaultColumns]);
	let draggedColumn = $state<DeviceColumn | null>(null);
	let prefsReady = $state(false);

	$effect(() => {
		void refresh();
	});

	$effect(() => {
		if (!browser || prefsReady) return;
		const raw = localStorage.getItem(PREFS_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
				if (Array.isArray(parsed.columns)) {
					const filtered = parsed.columns.filter((value): value is DeviceColumn =>
						allColumns.some((column) => column.id === value)
					);
					if (filtered.length > 0) visibleColumns = filtered;
				}
				if (parsed.density === 'compact' || parsed.density === 'comfortable') {
					density = parsed.density;
				}
				if (typeof parsed.showMediaDetails === 'boolean') {
					showMediaDetails = parsed.showMediaDetails;
				}
			} catch {
				localStorage.removeItem(PREFS_KEY);
			}
		}
		prefsReady = true;
	});

	$effect(() => {
		if (!browser || !prefsReady) return;
		const prefs: DevicePrefs = {
			columns: visibleColumns,
			density,
			showMediaDetails
		};
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			devices = await listDevices();
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load devices';
		} finally {
			loading = false;
		}
	}

	async function send(device: DeviceState, body: Record<string, unknown>, label: string) {
		busyId = device.device_id;
		error = null;
		notice = null;
		try {
			await setDeviceState(device.device_id, body);
			notice = `${label} sent for ${deviceDisplayName(device)}`;
			await refresh();
		} catch (value) {
			error = value instanceof Error ? value.message : `${label} failed`;
		} finally {
			busyId = null;
		}
	}

	function toggleColumn(column: DeviceColumn) {
		if (visibleColumns.includes(column)) {
			if (visibleColumns.length === 1) return;
			visibleColumns = visibleColumns.filter((value) => value !== column);
			return;
		}
		visibleColumns = [...visibleColumns, column];
	}

	function sortByColumn(column: DeviceColumn) {
		const nextSort: SortKey | null =
			column === 'name' ? 'name'
			: column === 'area' ? 'area'
			: column === 'status_icon' || column === 'status_text' ? 'status'
			: column === 'device_type' ? 'type'
			: column === 'last_seen' ? 'last_seen'
			: null;
		if (!nextSort) return;
		if (sortBy === nextSort) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortBy = nextSort;
		sortDirection = nextSort === 'last_seen' ? 'desc' : 'asc';
	}

	function handleDragStart(column: DeviceColumn) {
		draggedColumn = column;
	}

	function handleDrop(targetColumn: DeviceColumn) {
		if (!draggedColumn || draggedColumn === targetColumn) return;
		const fromIndex = visibleColumns.indexOf(draggedColumn);
		const toIndex = visibleColumns.indexOf(targetColumn);
		if (fromIndex < 0 || toIndex < 0) return;
		const copy = [...visibleColumns];
		const [item] = copy.splice(fromIndex, 1);
		copy.splice(toIndex, 0, item);
		visibleColumns = copy;
		draggedColumn = null;
	}

	function resetLayout() {
		visibleColumns = [...defaultColumns];
		density = 'comfortable';
		showMediaDetails = false;
		sortBy = 'name';
		sortDirection = 'asc';
	}

	function openDevice(device: DeviceState) {
		void goto(`/devices/${device.device_id}`);
	}

	function isSortColumnActive(column: DeviceColumn): boolean {
		return (
			(column === 'name' && sortBy === 'name') ||
			(column === 'area' && sortBy === 'area') ||
			((column === 'status_icon' || column === 'status_text') && sortBy === 'status') ||
			(column === 'device_type' && sortBy === 'type') ||
			(column === 'last_seen' && sortBy === 'last_seen')
		);
	}

	const areaOptions = $derived.by(() =>
		[...new Set(devices.filter((device) => !isSceneLikeDevice(device)).map((device) => device.area?.trim()).filter((value): value is string => Boolean(value)))]
			.sort((a, b) => a.localeCompare(b))
	);

	const typeOptions = $derived.by(() =>
		[...new Set(devices.filter((device) => !isSceneLikeDevice(device)).map((device) => device.device_type?.trim()).filter((value): value is string => Boolean(value)))]
			.sort((a, b) => a.localeCompare(b))
	);

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return devices.filter((device) => {
			if (isSceneLikeDevice(device)) return false;
			if (availability === 'online' && !device.available) return false;
			if (availability === 'offline' && device.available) return false;
			if (areaFilter !== 'all' && (device.area?.trim() || 'Unassigned') !== areaFilter) return false;
			if (typeFilter !== 'all' && (device.device_type?.trim() || 'device') !== typeFilter) return false;
			if (!query) return true;
			return [
				deviceDisplayName(device),
				device.device_id,
				device.canonical_name,
				device.area,
				device.device_type,
				device.plugin_id,
				statusText(device),
				mediaSummary(device)
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(query);
		});
	});

	const sorted = $derived.by(() => {
		const items = [...filtered];
		items.sort((a, b) => {
			let result = 0;
			if (sortBy === 'name') result = sortText(deviceDisplayName(a)).localeCompare(sortText(deviceDisplayName(b)));
			else if (sortBy === 'area') result = sortText(a.area ?? 'Unassigned').localeCompare(sortText(b.area ?? 'Unassigned'));
			else if (sortBy === 'status') result = sortText(statusText(a)).localeCompare(sortText(statusText(b)));
			else if (sortBy === 'type') result = sortText(a.device_type ?? 'device').localeCompare(sortText(b.device_type ?? 'device'));
			else result = (Date.parse(a.last_seen ?? '') || 0) - (Date.parse(b.last_seen ?? '') || 0);
			return sortDirection === 'asc' ? result : -result;
		});
		return items;
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Devices</h1>
			<p>Sortable, filterable device inventory with configurable columns and inline controls.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<div class="toolbar panel">
		<div class="toolbar-row">
			<input bind:value={search} placeholder="Search name, area, type, plugin, canonical name, status" />
			<select bind:value={availability}>
				<option value="all">All devices</option>
				<option value="online">Online only</option>
				<option value="offline">Offline only</option>
			</select>
			<select bind:value={areaFilter}>
				<option value="all">All areas</option>
				{#each areaOptions as area}
					<option value={area}>{area}</option>
				{/each}
			</select>
			<select bind:value={typeFilter}>
				<option value="all">All types</option>
				{#each typeOptions as deviceType}
					<option value={deviceType}>{deviceType}</option>
				{/each}
			</select>
		</div>

		<div class="toolbar-row preferences">
			<label>
				Density
				<select bind:value={density}>
					<option value="comfortable">Comfortable</option>
					<option value="compact">Compact</option>
				</select>
			</label>
			<label class="inline-check">
				<input type="checkbox" bind:checked={showMediaDetails} />
				<span>Show media details</span>
			</label>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<div class="column-editor">
			<div>
				<strong>Columns</strong>
				<p>Use the dropdown to show or hide columns. Drag table headers to reorder them.</p>
			</div>
			<details class="column-dropdown">
				<summary>Column selection</summary>
				<div class="column-menu">
					{#each allColumns as column}
						<label class="column-option">
							<input
								type="checkbox"
								checked={visibleColumns.includes(column.id)}
								onchange={() => toggleColumn(column.id)}
								disabled={visibleColumns.length === 1 && visibleColumns.includes(column.id)}
							/>
							<span>{column.label}</span>
						</label>
					{/each}
				</div>
			</details>
		</div>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}
	{#if notice}
		<p class="notice">{notice}</p>
	{/if}

	{#if loading && devices.length === 0}
		<p>Loading devices…</p>
	{:else if sorted.length === 0}
		<p>No devices match the current filters.</p>
	{:else}
		<div class="table-wrap panel">
			<table class:compact={density === 'compact'}>
				<thead>
					<tr>
						{#each visibleColumns as column}
							<th
								scope="col"
								class:dragging={draggedColumn === column}
								draggable="true"
								ondragstart={() => handleDragStart(column)}
								ondragover={(event) => event.preventDefault()}
								ondrop={() => handleDrop(column)}
								ondragend={() => (draggedColumn = null)}
							>
								<button type="button" class="header-button" onclick={() => sortByColumn(column)}>
									<span class="drag-handle" title="Drag to reorder">⋮⋮</span>
									<span>{allColumns.find((value) => value.id === column)?.label ?? column}</span>
									{#if isSortColumnActive(column)}
										<span class="sort-indicator">{sortDirection === 'asc' ? '↑' : '↓'}</span>
									{/if}
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sorted as device}
						<tr class:offline={!device.available} onclick={() => openDevice(device)}>
							{#each visibleColumns as column}
								<td data-column={column}>
									{#if column === 'status_icon'}
										<span class={`status tone-${statusTone(device)}`} title={statusText(device)}>
											{statusIcon(device)}
										</span>
									{:else if column === 'name'}
										<div class="primary">
											<a href={`/devices/${device.device_id}`} onclick={(event) => event.stopPropagation()}>
												{deviceDisplayName(device)}
											</a>
											<span class="subtle">{device.device_id}</span>
										</div>
									{:else if column === 'area'}
										{device.area ?? 'Unassigned'}
									{:else if column === 'device_type'}
										{device.device_type ?? 'device'}
									{:else if column === 'status_text'}
										<div class="primary">
											<span>{statusText(device)}</span>
											{#if isMediaPlayer(device) && playbackState(device) !== statusText(device).toLowerCase()}
												<span class="subtle">{playbackState(device)}</span>
											{/if}
										</div>
									{:else if column === 'media_info'}
										{#if isMediaPlayer(device)}
											<div class:media-cell={showMediaDetails}>
												{#if showMediaDetails && mediaImageUrl(device)}
													<img src={mediaImageUrl(device) ?? ''} alt="" />
												{/if}
												<div class="primary">
													<span>{mediaSummary(device) ?? 'Nothing playing'}</span>
													{#if showMediaDetails}
														<span class="subtle">{playbackState(device)}</span>
													{/if}
												</div>
											</div>
										{:else}
											<span class="subtle">—</span>
										{/if}
									{:else if column === 'last_seen'}
										<div class="primary">
											<span>{formatRelativeTime(device.last_seen)}</span>
											{#if device.last_seen}
												<span class="subtle">{new Date(device.last_seen).toLocaleString()}</span>
											{/if}
										</div>
									{:else if column === 'control'}
										<div class="controls">
											{#if supportsInlineToggle(device)}
												<button
													type="button"
													class="secondary"
													onclick={(event) => {
														event.stopPropagation();
														void send(
															device,
															{ on: !boolAttr(device.attributes.on) },
															boolAttr(device.attributes.on) ? 'Turn off' : 'Turn on'
														);
													}}
													disabled={busyId === device.device_id}
												>
													{boolAttr(device.attributes.on) ? 'Turn off' : 'Turn on'}
												</button>
											{:else if isMediaPlayer(device)}
												{#if playbackState(device) === 'playing' && supportsAction(device, 'pause')}
													<button type="button" class="secondary" onclick={(event) => {
														event.stopPropagation();
														void send(device, { action: 'pause' }, 'Pause');
													}} disabled={busyId === device.device_id}>Pause</button>
												{:else if supportsAction(device, 'play')}
													<button type="button" class="secondary" onclick={(event) => {
														event.stopPropagation();
														void send(device, { action: 'play' }, 'Play');
													}} disabled={busyId === device.device_id}>Play</button>
												{/if}
											{:else}
												<a class="secondary-link" href={`/devices/${device.device_id}`} onclick={(event) => event.stopPropagation()}>Details</a>
											{/if}
										</div>
									{:else if column === 'canonical_name'}
										{device.canonical_name ?? '—'}
									{:else if column === 'plugin'}
										{device.plugin_id}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.page { display: grid; gap: 1rem; }
	.heading, .toolbar-row, .controls, .media-cell { display: flex; gap: 0.75rem; align-items: center; }
	.heading { justify-content: space-between; }
	.panel {
		background: rgba(255, 255, 255, 0.8);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}
	.toolbar { display: grid; gap: 1rem; }
	.toolbar-row { flex-wrap: wrap; }
	.preferences { justify-content: flex-start; gap: 1rem; }
	.column-editor { display: grid; gap: 0.75rem; }
	.column-editor p, .heading p { margin: 0.25rem 0 0; color: #617486; }
	.column-dropdown summary {
		width: fit-content;
		list-style: none;
		cursor: pointer;
		padding: 0.65rem 0.9rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		color: #173b61;
	}
	.column-dropdown[open] summary { margin-bottom: 0.6rem; }
	.column-menu {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.25rem 0.75rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid #dbe4ed;
		border-radius: 0.8rem;
		background: #f8fbfd;
		max-width: min(100%, 40rem);
	}
	.column-option {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		font-size: 0.84rem;
		line-height: 1.2;
		color: #33485a;
		padding: 0.15rem 0;
	}
	input, select {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
	input { min-width: min(360px, 100%); flex: 1; }
	.inline-check {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		color: #33485a;
		font-size: 0.92rem;
		white-space: nowrap;
		min-height: 2.9rem;
	}
	.inline-check input,
	.column-option input {
		margin: 0;
		min-width: 0;
		flex: 0 0 auto;
	}
	button, .secondary-link {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
		font: inherit;
		text-decoration: none;
	}
	.secondary, .secondary-link {
		background: #e6eef7;
		color: #173b61;
	}
	.preferences > button { margin-left: auto; }
	.table-wrap { overflow: auto; padding: 0; }
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 960px;
	}
	th, td {
		padding: 0.95rem 0.85rem;
		border-bottom: 1px solid #e4ebf2;
		text-align: left;
		vertical-align: middle;
	}
	th {
		position: sticky;
		top: 0;
		background: #f7fafc;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #627488;
	}
	th.dragging { opacity: 0.55; }
	.header-button {
		display: inline-flex;
		gap: 0.45rem;
		align-items: center;
		border: 0;
		background: transparent;
		padding: 0;
		color: inherit;
		font: inherit;
		text-transform: inherit;
		letter-spacing: inherit;
		cursor: pointer;
	}
	.drag-handle {
		color: #789;
		font-size: 0.9rem;
		letter-spacing: -0.1em;
		user-select: none;
	}
	.sort-indicator { color: #173b61; }
	tbody tr { cursor: pointer; }
	tbody tr:hover { background: #f8fbfd; }
	tbody tr.offline { background: rgba(249, 240, 240, 0.45); }
	table.compact th, table.compact td { padding: 0.6rem 0.65rem; }
	a { color: #163c63; text-decoration: none; }
	a:hover { text-decoration: underline; }
	.primary { display: grid; gap: 0.15rem; }
	.subtle {
		font-size: 0.82rem;
		color: #66798a;
		word-break: break-word;
	}
	.status {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		font-size: 1rem;
		font-weight: 700;
	}
	.tone-good { background: #e1f5e8; color: #12693a; }
	.tone-warn { background: #fff0da; color: #995c00; }
	.tone-idle { background: #e8eef5; color: #39546e; }
	.tone-media { background: #e5ecff; color: #234da3; }
	.tone-offline { background: #f7e3e3; color: #983434; }
	.media-cell img {
		width: 2.8rem;
		height: 2.8rem;
		object-fit: cover;
		border-radius: 0.55rem;
		border: 1px solid #d8e0ea;
	}
	.error { color: #b53622; }
	.notice {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 0.85rem;
		background: #e6f4ea;
		color: #155b36;
	}
	@media (max-width: 900px) {
		.preferences > button { margin-left: 0; }
		input { min-width: 100%; }
	}
</style>
