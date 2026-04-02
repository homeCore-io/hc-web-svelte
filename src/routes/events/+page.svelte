<script lang="ts">
	import { page } from '$app/state';
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import type { MaterialIconName } from '$lib/components/ui/MaterialIcon.svelte';
	import CollapsibleFilterPanel from '$lib/components/ui/CollapsibleFilterPanel.svelte';
	import ColumnDropdown from '$lib/components/ui/ColumnDropdown.svelte';
	import { listEvents } from '$lib/api/events';
	import { eventsState } from '$lib/stores/events.svelte';
	import { formatRelativeTime } from '$lib/models/device';
	import { eventSummary, eventTargetLabel, type LogEntry } from '$lib/models/event';

	type SortKey = 'timestamp' | 'type' | 'target';
	type SortDirection = 'asc' | 'desc';
	type EventColumn = 'timestamp' | 'event_type' | 'target' | 'summary' | 'seq';

	const PREFS_KEY = 'hc-web-svelte:events:grid';
	const defaultColumns: EventColumn[] = ['timestamp', 'event_type', 'target', 'summary'];
	const allColumns: { id: EventColumn; label: string }[] = [
		{ id: 'timestamp', label: 'Time' },
		{ id: 'event_type', label: 'Type' },
		{ id: 'target', label: 'Target' },
		{ id: 'summary', label: 'Summary' },
		{ id: 'seq', label: 'Sequence' }
	];

	let eventLog = $state<LogEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let typeFilter = $state('all');
	let sortBy = $state<SortKey>('timestamp');
	let sortDirection = $state<SortDirection>('desc');
	let visibleColumns = $state<EventColumn[]>([...defaultColumns]);
	let draggedColumn = $state<EventColumn | null>(null);
	let toolbarExpanded = $state(false);
	let prefsReady = $state(false);

	$effect(() => {
		eventsState.connect();
		void refresh();
	});

	$effect(() => {
		if (typeof localStorage === 'undefined' || prefsReady) return;
		const raw = localStorage.getItem(PREFS_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { columns?: EventColumn[] };
				if (Array.isArray(parsed.columns)) {
					const filtered = parsed.columns.filter((value): value is EventColumn =>
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
			eventLog = await listEvents({ limit: 200 });
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load event log';
		} finally {
			loading = false;
		}
	}

	function sortByColumn(column: EventColumn) {
		const nextSort: SortKey | null =
			column === 'timestamp' ? 'timestamp'
			: column === 'event_type' ? 'type'
			: column === 'target' ? 'target'
			: null;
		if (!nextSort) return;
		if (sortBy === nextSort) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortBy = nextSort;
		sortDirection = nextSort === 'timestamp' ? 'desc' : 'asc';
	}

	function handleDragStart(column: EventColumn) {
		draggedColumn = column;
	}

	function handleDrop(targetColumn: EventColumn) {
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
		sortBy = 'timestamp';
		sortDirection = 'desc';
		typeFilter = 'all';
	}

	function targetHref(entry: LogEntry): string | null {
		if (entry.event.rule_id) return `/automations?rule_id=${encodeURIComponent(String(entry.event.rule_id))}`;
		if (entry.event.scene_id) return `/scenes?scene_id=${encodeURIComponent(String(entry.event.scene_id))}`;
		if (entry.device_id) return `/devices/${encodeURIComponent(entry.device_id)}`;
		if (entry.event.device_id && typeof entry.event.device_id === 'string') {
			return `/devices/${encodeURIComponent(entry.event.device_id)}`;
		}
		return null;
	}

	function isSortColumnActive(column: EventColumn): boolean {
		return (
			(column === 'timestamp' && sortBy === 'timestamp') ||
			(column === 'event_type' && sortBy === 'type') ||
			(column === 'target' && sortBy === 'target')
		);
	}

	function toLogEntry(event: { type: string; timestamp: string; [key: string]: unknown }, index: number): LogEntry {
		return {
			seq: 0 - index,
			event_type: event.type,
			device_id: typeof event.device_id === 'string' ? event.device_id : undefined,
			event: event as LogEntry['event']
		};
	}

	const liveEntries = $derived.by(() => eventsState.items.map((event, index) => toLogEntry(event, index)));
	const routeType = $derived(page.url.searchParams.get('type')?.trim() ?? '');
	const routeDeviceId = $derived(page.url.searchParams.get('device_id')?.trim() ?? '');
	const routeRuleId = $derived(page.url.searchParams.get('rule_id')?.trim() ?? '');
	const routeSceneId = $derived(page.url.searchParams.get('scene_id')?.trim() ?? '');
	const merged = $derived.by(() => {
		const seen = new Set<string>();
		const combined: LogEntry[] = [];
		for (const entry of [...liveEntries, ...eventLog]) {
			const key = `${entry.event_type}:${entry.seq}:${entry.event.timestamp}:${entry.device_id ?? ''}`;
			if (seen.has(key)) continue;
			seen.add(key);
			combined.push(entry);
		}
		return combined;
	});
	const typeOptions = $derived.by(() =>
		[...new Set(merged.map((entry) => entry.event_type).filter(Boolean))].sort((a, b) => a.localeCompare(b))
	);
	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return merged.filter((entry) => {
			if (routeType && entry.event_type !== routeType) return false;
			if (routeDeviceId && entry.device_id !== routeDeviceId && entry.event.device_id !== routeDeviceId) return false;
			if (routeRuleId && entry.event.rule_id !== routeRuleId) return false;
			if (routeSceneId && entry.event.scene_id !== routeSceneId) return false;
			if (typeFilter !== 'all' && entry.event_type !== typeFilter) return false;
			if (!query) return true;
			return [
				entry.event_type,
				eventTargetLabel(entry),
				eventSummary(entry),
				entry.device_id,
				entry.event.scene_name,
				entry.event.rule_name
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
			if (sortBy === 'type') result = a.event_type.localeCompare(b.event_type);
			else if (sortBy === 'target') result = eventTargetLabel(a).localeCompare(eventTargetLabel(b));
			else result = (Date.parse(a.event.timestamp ?? '') || 0) - (Date.parse(b.event.timestamp ?? '') || 0);
			return sortDirection === 'asc' ? result : -result;
		});
		return items;
	});

	function eventIconName(entry: LogEntry): MaterialIconName {
		if (entry.event.rule_id) return 'automation';
		if (entry.event.scene_id) return 'scenes';
		if (entry.device_id || entry.event.device_id) return 'devices';
		if (entry.event_type.includes('warn') || entry.event_type.includes('error')) return 'warning';
		return 'events';
	}

	function eventTone(entry: LogEntry): 'good' | 'warn' | 'idle' | 'media' {
		if (entry.event_type.includes('warn') || entry.event_type.includes('error')) return 'warn';
		if (entry.event.rule_id) return 'media';
		if (entry.event.scene_id) return 'good';
		return 'idle';
	}
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Events</h1>
			<p>Compact activity stream with live state and source-aware icons.</p>
		</div>
		<div class="heading-actions">
			<span class:live={eventsState.connected} class="live-pill">
				{eventsState.connected ? 'Live stream connected' : 'Live stream disconnected'}
			</span>
			<button type="button" onclick={refresh} disabled={loading}>
				{loading ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>
	</div>

	<CollapsibleFilterPanel
		bind:search
		bind:expanded={toolbarExpanded}
		searchPlaceholder="Search event type, target, summary"
	>
		<div class="toolbar-row">
			<select bind:value={typeFilter}>
				<option value="all">All event types</option>
				{#each typeOptions as type}
					<option value={type}>{type}</option>
				{/each}
			</select>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<ColumnDropdown allColumns={allColumns} bind:visibleColumns />
	</CollapsibleFilterPanel>

	{#if error}
		<p class="error">{error}</p>
	{:else if routeRuleId || routeSceneId || routeDeviceId || routeType}
		<p class="context">
			Filtered view.
			<a href="/events">Show all events</a>
		</p>
	{/if}
	{#if eventsState.error}
		<p class="error">{eventsState.error}</p>
	{/if}

	{#if loading && merged.length === 0}
		<p>Loading events…</p>
	{:else if merged.length === 0}
		<p>No events found.</p>
	{:else if sorted.length === 0}
		<p>No events match the current filters.</p>
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
					{#each sorted as entry}
						<tr>
							{#each visibleColumns as column}
								<td>
									{#if column === 'timestamp'}
										<div class="primary">
											<strong>{formatRelativeTime(entry.event.timestamp)}</strong>
											<span class="subtle">{new Date(entry.event.timestamp).toLocaleString()}</span>
										</div>
									{:else if column === 'event_type'}
										<span class={`pill tone-${eventTone(entry)}`}>
											<MaterialIcon name={eventIconName(entry)} size={14} />
											{entry.event_type}
										</span>
									{:else if column === 'target'}
										<div class="primary event-target">
											<span class={`event-icon tone-${eventTone(entry)}`} aria-hidden="true">
												<MaterialIcon name={eventIconName(entry)} size={16} />
											</span>
											{#if targetHref(entry)}
												<a class="target-link" href={targetHref(entry) ?? undefined}>{eventTargetLabel(entry)}</a>
											{:else}
												<strong>{eventTargetLabel(entry)}</strong>
											{/if}
											{#if entry.device_id}
												<span class="subtle">{entry.device_id}</span>
											{/if}
										</div>
									{:else if column === 'summary'}
										<span class="summary">{eventSummary(entry)}</span>
									{:else if column === 'seq'}
										<span class="subtle">{entry.seq}</span>
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
	.heading, .toolbar-row, .heading-actions { display: flex; gap: 0.75rem; align-items: center; }
	.heading { justify-content: space-between; }
	.heading-actions { flex-wrap: wrap; justify-content: end; }
	.toolbar-row { flex-wrap: wrap; }
	.panel {
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		border-radius: 0.7rem;
		padding: 1rem;
	}
	.table-wrap { overflow: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; min-width: 980px; }
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
	.event-target {
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.15rem 0.55rem;
		align-items: center;
	}
	.event-target > :global(*) { grid-column: 2; }
	.event-icon {
		width: 1.65rem;
		height: 1.65rem;
		display: grid;
		place-items: center;
		border-radius: 0.45rem;
		grid-row: 1 / span 2;
	}
	.subtle { font-size: 0.82rem; color: var(--hc-text-muted); word-break: break-word; }
	.summary { color: var(--hc-text); }
	.target-link {
		color: var(--hc-accent);
		text-decoration: none;
		font-weight: 600;
	}
	.target-link:hover { text-decoration: underline; }
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
	.live-pill {
		display: inline-block;
		padding: 0.3rem 0.7rem;
		border-radius: 0.45rem;
		background: var(--hc-danger-soft);
		color: var(--hc-danger);
		font-size: 0.82rem;
	}
	.live-pill.live {
		background: var(--hc-success-soft);
		color: var(--hc-success);
	}
	.context {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 0.5rem;
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
	}
	.tone-good { background: var(--hc-success-soft); color: var(--hc-success); }
	.tone-warn { background: var(--hc-warn-soft); color: var(--hc-warn); }
	.tone-idle { background: var(--hc-surface-soft); color: var(--hc-text-muted); }
	.tone-media { background: var(--hc-accent-soft); color: var(--hc-accent); }
	.error { color: var(--hc-danger); margin: 0; }
</style>
