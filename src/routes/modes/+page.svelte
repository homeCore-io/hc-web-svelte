<script lang="ts">
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import CollapsibleFilterPanel from '$lib/components/ui/CollapsibleFilterPanel.svelte';
	import ColumnDropdown from '$lib/components/ui/ColumnDropdown.svelte';
	import { listModes } from '$lib/api/modes';
	import {
		modeDisplayName,
		modeStatusLabel,
		modeWindowSummary,
		type ModeState
	} from '$lib/models/mode';

	type SortKey = 'name' | 'kind' | 'status' | 'effective_on';
	type SortDirection = 'asc' | 'desc';
	type ModeColumn =
		| 'name'
		| 'kind'
		| 'status'
		| 'effective_window'
		| 'offsets'
		| 'sun_times'
		| 'device_id';

	const PREFS_KEY = 'hc-web-svelte:modes:grid';
	const defaultColumns: ModeColumn[] = ['name', 'kind', 'status', 'effective_window', 'offsets'];
	const allColumns: { id: ModeColumn; label: string }[] = [
		{ id: 'name', label: 'Name' },
		{ id: 'kind', label: 'Kind' },
		{ id: 'status', label: 'Status' },
		{ id: 'effective_window', label: 'Effective window' },
		{ id: 'offsets', label: 'Offsets' },
		{ id: 'sun_times', label: 'Sun times' },
		{ id: 'device_id', label: 'Device ID' }
	];

	let modes = $state<ModeState[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let kindFilter = $state('all');
	let statusFilter = $state<'all' | 'on' | 'off'>('all');
	let sortBy = $state<SortKey>('name');
	let sortDirection = $state<SortDirection>('asc');
	let visibleColumns = $state<ModeColumn[]>([...defaultColumns]);
	let draggedColumn = $state<ModeColumn | null>(null);
	let toolbarExpanded = $state(false);
	let prefsReady = $state(false);

	$effect(() => {
		void refresh();
	});

	$effect(() => {
		if (typeof localStorage === 'undefined' || prefsReady) return;
		const raw = localStorage.getItem(PREFS_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { columns?: ModeColumn[] };
				if (Array.isArray(parsed.columns)) {
					const filtered = parsed.columns.filter((value): value is ModeColumn =>
						allColumns.some((column) => column.id === value)
					);
					if (filtered.length > 0) visibleColumns = filtered;
				}
			} catch {
				localStorage.removeItem(PREFS_KEY);
			}
		}
		prefsReady = true;
	});

	$effect(() => {
		if (typeof localStorage === 'undefined' || !prefsReady) return;
		localStorage.setItem(PREFS_KEY, JSON.stringify({ columns: visibleColumns }));
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			modes = await listModes();
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load modes';
		} finally {
			loading = false;
		}
	}

	function sortByColumn(column: ModeColumn) {
		const nextSort: SortKey | null =
			column === 'name' ? 'name'
			: column === 'kind' ? 'kind'
			: column === 'status' ? 'status'
			: column === 'effective_window' ? 'effective_on'
			: null;
		if (!nextSort) return;
		if (sortBy === nextSort) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortBy = nextSort;
		sortDirection = 'asc';
	}

	function handleDragStart(column: ModeColumn) {
		draggedColumn = column;
	}

	function handleDrop(targetColumn: ModeColumn) {
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
		sortBy = 'name';
		sortDirection = 'asc';
		kindFilter = 'all';
		statusFilter = 'all';
	}

	function isSortColumnActive(column: ModeColumn): boolean {
		return (
			(column === 'name' && sortBy === 'name') ||
			(column === 'kind' && sortBy === 'kind') ||
			(column === 'status' && sortBy === 'status') ||
			(column === 'effective_window' && sortBy === 'effective_on')
		);
	}

	const kindOptions = $derived.by(() =>
		[...new Set(modes.map((mode) => mode.kind?.trim()).filter((value): value is string => Boolean(value)))]
			.sort((a, b) => a.localeCompare(b))
	);

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return modes.filter((mode) => {
			if (kindFilter !== 'all' && (mode.kind ?? 'manual') !== kindFilter) return false;
			if (statusFilter === 'on' && !mode.on) return false;
			if (statusFilter === 'off' && mode.on) return false;
			if (!query) return true;
			return [
				modeDisplayName(mode),
				mode.device_id,
				mode.kind,
				modeStatusLabel(mode),
				modeWindowSummary(mode)
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
			if (sortBy === 'kind') result = (a.kind ?? 'manual').localeCompare(b.kind ?? 'manual');
			else if (sortBy === 'status') result = modeStatusLabel(a).localeCompare(modeStatusLabel(b));
			else if (sortBy === 'effective_on') result = (a.effective_on ?? '').localeCompare(b.effective_on ?? '');
			else result = modeDisplayName(a).localeCompare(modeDisplayName(b));
			return sortDirection === 'asc' ? result : -result;
		});
		return items;
	});

	function modeTone(mode: ModeState): 'good' | 'idle' {
		return mode.on ? 'good' : 'idle';
	}
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Modes</h1>
			<p>Compact mode inventory with cleaner state cues and schedule detail.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<CollapsibleFilterPanel
		bind:search
		bind:expanded={toolbarExpanded}
		searchPlaceholder="Search mode name, kind, status"
	>
		<div class="toolbar-row">
			<select bind:value={kindFilter}>
				<option value="all">All kinds</option>
				{#each kindOptions as kind}
					<option value={kind}>{kind}</option>
				{/each}
			</select>
			<select bind:value={statusFilter}>
				<option value="all">All status</option>
				<option value="on">On only</option>
				<option value="off">Off only</option>
			</select>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<ColumnDropdown allColumns={allColumns} bind:visibleColumns />
	</CollapsibleFilterPanel>

	{#if error}
		<p class="error">{error}</p>
	{:else if loading && modes.length === 0}
		<p>Loading modes…</p>
	{:else if modes.length === 0}
		<p>No modes found.</p>
	{:else if sorted.length === 0}
		<p>No modes match the current filters.</p>
	{:else}
		<div class="table-wrap panel">
			<table>
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
					{#each sorted as mode}
						<tr>
							{#each visibleColumns as column}
								<td>
									{#if column === 'name'}
										<div class="primary mode-name">
											<span class={`mode-icon tone-${modeTone(mode)}`} aria-hidden="true">
												<MaterialIcon name="modes" size={16} />
											</span>
											<strong>{modeDisplayName(mode)}</strong>
											<span class="subtle">{mode.device_id}</span>
										</div>
									{:else if column === 'kind'}
										<span class="pill">{mode.kind ?? 'manual'}</span>
									{:else if column === 'status'}
										<span class:off={!mode.on} class={`pill status-pill tone-${modeTone(mode)}`}>
											<MaterialIcon name={mode.on ? 'check' : 'power_off'} size={14} />
											{modeStatusLabel(mode)}
										</span>
									{:else if column === 'effective_window'}
										<div class="primary">
											<strong>{modeWindowSummary(mode)}</strong>
											<span class="subtle">
												{mode.effective_on ?? 'Unknown'} → {mode.effective_off ?? 'Unknown'}
											</span>
										</div>
									{:else if column === 'offsets'}
										<span class="subtle">
											On {mode.on_offset_minutes ?? 0}m / Off {mode.off_offset_minutes ?? 0}m
										</span>
									{:else if column === 'sun_times'}
										<div class="primary">
											<strong>Sunrise {mode.sunrise_today ?? 'Unknown'}</strong>
											<span class="subtle">Sunset {mode.sunset_today ?? 'Unknown'}</span>
										</div>
									{:else if column === 'device_id'}
										<span class="subtle">{mode.device_id}</span>
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
	.heading, .toolbar-row { display: flex; gap: 0.75rem; align-items: center; }
	.heading { justify-content: space-between; }
	.toolbar-row { flex-wrap: wrap; }
	.panel {
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		border-radius: 0.7rem;
		padding: 1rem;
	}
	.table-wrap { overflow: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; min-width: 840px; }
	th, td {
		padding: 0.95rem 0.85rem;
		border-bottom: 1px solid #e4ebf2;
		text-align: left;
		vertical-align: middle;
	}
	th {
		background: var(--hc-surface-soft);
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--hc-text-muted);
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
	.sort-indicator { color: var(--hc-accent); }
	.primary { display: grid; gap: 0.15rem; }
	.mode-name {
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.15rem 0.55rem;
		align-items: center;
	}
	.mode-name strong,
	.mode-name .subtle { grid-column: 2; }
	.mode-icon {
		width: 1.65rem;
		height: 1.65rem;
		display: grid;
		place-items: center;
		border-radius: 0.45rem;
		grid-row: 1 / span 2;
	}
	.subtle { font-size: 0.82rem; color: var(--hc-text-muted); word-break: break-word; }
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
		padding: 0.25rem 0.6rem;
		border-radius: 0.45rem;
		font-size: 0.82rem;
	}
	.status-pill.off {
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
	}
	.tone-good { background: var(--hc-success-soft); color: var(--hc-success); }
	.tone-idle { background: var(--hc-surface-soft); color: var(--hc-text-muted); }
	.error { color: var(--hc-danger); }
</style>
