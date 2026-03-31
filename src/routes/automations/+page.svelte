<script lang="ts">
	import { page } from '$app/state';
	import { listEvents } from '$lib/api/events';
	import { eventSummary, eventTargetLabel, type LogEntry } from '$lib/models/event';
	import CollapsibleFilterPanel from '$lib/components/ui/CollapsibleFilterPanel.svelte';
	import ColumnDropdown from '$lib/components/ui/ColumnDropdown.svelte';
	import { listAutomations } from '$lib/api/automations';
	import { eventsState } from '$lib/stores/events.svelte';
	import { formatRelativeTime } from '$lib/models/device';
	import {
		automationActionsSummary,
		automationConditionsSummary,
		automationTagsSummary,
		automationTriggerSummary,
		type AutomationRule
	} from '$lib/models/automation';

	type EnabledFilter = 'all' | 'enabled' | 'disabled';
	type SortKey = 'name' | 'priority' | 'trigger' | 'enabled' | 'last_triggered';
	type SortDirection = 'asc' | 'desc';
	type AutomationColumn =
		| 'enabled'
		| 'stale'
		| 'name'
		| 'priority'
		| 'last_triggered'
		| 'trigger'
		| 'conditions'
		| 'actions'
		| 'tags'
		| 'id';

	const PREFS_KEY = 'hc-web-svelte:automations:grid';
	const defaultColumns: AutomationColumn[] = [
		'enabled',
		'name',
		'priority',
		'last_triggered',
		'trigger',
		'conditions',
		'actions'
	];
	const allColumns: { id: AutomationColumn; label: string }[] = [
		{ id: 'enabled', label: 'Enabled' },
		{ id: 'stale', label: 'Stale' },
		{ id: 'name', label: 'Name' },
		{ id: 'priority', label: 'Priority' },
		{ id: 'last_triggered', label: 'Last Triggered' },
		{ id: 'trigger', label: 'Trigger' },
		{ id: 'conditions', label: 'Conditions' },
		{ id: 'actions', label: 'Actions' },
		{ id: 'tags', label: 'Tags' },
		{ id: 'id', label: 'Rule ID' }
	];

	let automations = $state<AutomationRule[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let enabledFilter = $state<EnabledFilter>('all');
	let triggerFilter = $state('all');
	let tagFilter = $state('all');
	let staleOnly = $state(false);
	let sortBy = $state<SortKey>('priority');
	let sortDirection = $state<SortDirection>('desc');
	let visibleColumns = $state<AutomationColumn[]>([...defaultColumns]);
	let draggedColumn = $state<AutomationColumn | null>(null);
	let toolbarExpanded = $state(false);
	let prefsReady = $state(false);
	let lastTriggeredByRuleId = $state<Record<string, string>>({});
	let recentEvents = $state<LogEntry[]>([]);
	let selectedTraceRuleId = $state<string | null>(null);
	let selectedTraceTimestamp = $state<string | null>(null);

	$effect(() => {
		eventsState.connect();
		void refresh();
	});

	$effect(() => {
		if (typeof localStorage === 'undefined' || prefsReady) return;
		const raw = localStorage.getItem(PREFS_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { columns?: AutomationColumn[] };
				if (Array.isArray(parsed.columns)) {
					const filtered = parsed.columns.filter((value): value is AutomationColumn =>
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

	$effect(() => {
		if (routeRuleId) selectedTraceRuleId = routeRuleId;
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			const [loadedAutomations, recentRuleEvents, loadedEvents] = await Promise.all([
				listAutomations(),
				listEvents({ limit: 1000, type: 'rule_fired' }),
				listEvents({ limit: 300 })
			]);
			automations = loadedAutomations;
			lastTriggeredByRuleId = buildLastTriggeredLookup(recentRuleEvents);
			recentEvents = loadedEvents;
			if (!selectedTraceRuleId && loadedAutomations.length > 0) {
				selectedTraceRuleId = routeRuleId || loadedAutomations[0].id;
			}
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load automations';
		} finally {
			loading = false;
		}
	}

	function sortByColumn(column: AutomationColumn) {
		const nextSort: SortKey | null =
			column === 'name' ? 'name'
			: column === 'priority' ? 'priority'
			: column === 'last_triggered' ? 'last_triggered'
			: column === 'trigger' ? 'trigger'
			: column === 'enabled' ? 'enabled'
			: null;
		if (!nextSort) return;
		if (sortBy === nextSort) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortBy = nextSort;
		sortDirection = nextSort === 'priority' ? 'desc' : 'asc';
	}

	function handleDragStart(column: AutomationColumn) {
		draggedColumn = column;
	}

	function handleDrop(targetColumn: AutomationColumn) {
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
		sortBy = 'priority';
		sortDirection = 'desc';
		enabledFilter = 'all';
		triggerFilter = 'all';
		tagFilter = 'all';
		staleOnly = false;
	}

	function isSortColumnActive(column: AutomationColumn): boolean {
		return (
			(column === 'name' && sortBy === 'name') ||
			(column === 'priority' && sortBy === 'priority') ||
			(column === 'last_triggered' && sortBy === 'last_triggered') ||
			(column === 'trigger' && sortBy === 'trigger') ||
			(column === 'enabled' && sortBy === 'enabled')
		);
	}

	function buildLastTriggeredLookup(
		entries: {
			event_type: string;
			event?: { rule_id?: string; timestamp?: string };
		}[]
	): Record<string, string> {
		const lookup: Record<string, string> = {};
		for (const entry of entries) {
			if (entry.event_type !== 'rule_fired') continue;
			const ruleId = entry.event?.rule_id;
			const timestamp = entry.event?.timestamp;
			if (!ruleId || !timestamp) continue;
			if (!(ruleId in lookup)) lookup[ruleId] = timestamp;
		}
		return lookup;
	}

	const liveLastTriggeredByRuleId = $derived.by(() => {
		const lookup: Record<string, string> = {};
		for (const event of eventsState.items) {
			if (event.type !== 'rule_fired') continue;
			const ruleId = typeof event.rule_id === 'string' ? event.rule_id : null;
			if (!ruleId || ruleId in lookup) continue;
			lookup[ruleId] = event.timestamp;
		}
		return lookup;
	});

	function lastTriggered(rule: AutomationRule): string | null {
		return liveLastTriggeredByRuleId[rule.id] ?? lastTriggeredByRuleId[rule.id] ?? null;
	}

	function toLogEntry(event: { type: string; timestamp: string; [key: string]: unknown }, index: number): LogEntry {
		return {
			seq: 0 - index,
			event_type: event.type,
			device_id: typeof event.device_id === 'string' ? event.device_id : undefined,
			event: event as LogEntry['event']
		};
	}

	function eventHref(entry: LogEntry): string | null {
		if (entry.event.rule_id) return `/automations?rule_id=${encodeURIComponent(String(entry.event.rule_id))}`;
		if (entry.event.scene_id) return `/scenes?scene_id=${encodeURIComponent(String(entry.event.scene_id))}`;
		if (entry.device_id) return `/devices/${encodeURIComponent(entry.device_id)}`;
		if (typeof entry.event.device_id === 'string') {
			return `/devices/${encodeURIComponent(entry.event.device_id)}`;
		}
		return null;
	}

	function openTrace(ruleId: string, timestamp?: string | null) {
		selectedTraceRuleId = ruleId;
		selectedTraceTimestamp = timestamp ?? null;
	}

	function closeTrace() {
		selectedTraceRuleId = null;
		selectedTraceTimestamp = null;
	}

	const triggerOptions = $derived.by(() =>
		[...new Set(automations.map((rule) => String(rule.trigger.type ?? 'Unknown')))].sort((a, b) =>
			a.localeCompare(b)
		)
	);
	const tagOptions = $derived.by(() =>
		[...new Set(automations.flatMap((rule) => rule.tags))].sort((a, b) => a.localeCompare(b))
	);
	const routeRuleId = $derived(page.url.searchParams.get('rule_id')?.trim() ?? '');
	const mergedEvents = $derived.by(() => {
		const liveEntries = eventsState.items.map((event, index) => toLogEntry(event, index));
		const seen = new Set<string>();
		const combined: LogEntry[] = [];
		for (const entry of [...liveEntries, ...recentEvents]) {
			const key = `${entry.event_type}:${entry.seq}:${entry.event.timestamp}:${entry.device_id ?? ''}:${entry.event.rule_id ?? ''}:${entry.event.scene_id ?? ''}`;
			if (seen.has(key)) continue;
			seen.add(key);
			combined.push(entry);
		}
		combined.sort((a, b) => (Date.parse(b.event.timestamp ?? '') || 0) - (Date.parse(a.event.timestamp ?? '') || 0));
		return combined;
	});
	const traceRule = $derived.by(() => automations.find((rule) => rule.id === selectedTraceRuleId) ?? null);
	const recentFiresForSelectedRule = $derived.by(() => {
		if (!selectedTraceRuleId) return [] as LogEntry[];
		return mergedEvents
			.filter((entry) => entry.event_type === 'rule_fired' && entry.event.rule_id === selectedTraceRuleId)
			.slice(0, 12);
	});
	const activeTraceTimestamp = $derived.by(() => selectedTraceTimestamp ?? recentFiresForSelectedRule[0]?.event.timestamp ?? null);
	const traceWindowEvents = $derived.by(() => {
		if (!traceRule || !activeTraceTimestamp) return [] as LogEntry[];
		const anchor = Date.parse(activeTraceTimestamp);
		if (!Number.isFinite(anchor)) return [] as LogEntry[];
		return mergedEvents
			.filter((entry) => {
				const ts = Date.parse(entry.event.timestamp ?? '');
				if (!Number.isFinite(ts)) return false;
				if (Math.abs(ts - anchor) > 90_000) return false;
				if (entry.event.rule_id === traceRule.id) return true;
				if (entry.event_type === 'rule_fired') return true;
				if (entry.device_id || entry.event.device_id) return true;
				if (entry.event.scene_id) return true;
				return false;
			})
			.sort((a, b) => (Date.parse(a.event.timestamp ?? '') || 0) - (Date.parse(b.event.timestamp ?? '') || 0));
	});

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return automations.filter((rule) => {
			if (routeRuleId && rule.id !== routeRuleId) return false;
			if (enabledFilter === 'enabled' && !rule.enabled) return false;
			if (enabledFilter === 'disabled' && rule.enabled) return false;
			if (triggerFilter !== 'all' && String(rule.trigger.type ?? 'Unknown') !== triggerFilter) return false;
			if (tagFilter !== 'all' && !rule.tags.includes(tagFilter)) return false;
			if (staleOnly && !rule.error) return false;
			if (!query) return true;
			return [
				rule.name,
				rule.id,
				String(rule.priority),
				automationTriggerSummary(rule),
				automationConditionsSummary(rule),
				automationActionsSummary(rule),
				automationTagsSummary(rule),
				rule.error
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
			if (sortBy === 'priority') result = a.priority - b.priority;
			else if (sortBy === 'last_triggered') {
				const aTime = lastTriggered(a) ? Date.parse(lastTriggered(a) ?? '') : 0;
				const bTime = lastTriggered(b) ? Date.parse(lastTriggered(b) ?? '') : 0;
				result = aTime - bTime;
			}
			else if (sortBy === 'trigger') result = automationTriggerSummary(a).localeCompare(automationTriggerSummary(b));
			else if (sortBy === 'enabled') result = Number(a.enabled) - Number(b.enabled);
			else result = a.name.localeCompare(b.name);
			return sortDirection === 'asc' ? result : -result;
		});
		return items;
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Automations</h1>
			<p>Read-only automation inventory with trigger, condition, and action summaries.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<CollapsibleFilterPanel
		bind:search
		bind:expanded={toolbarExpanded}
		searchPlaceholder="Search automation name, trigger, action, rule id"
	>
		<div class="toolbar-row">
			<select bind:value={enabledFilter}>
				<option value="all">All automations</option>
				<option value="enabled">Enabled only</option>
				<option value="disabled">Disabled only</option>
			</select>
			<select bind:value={triggerFilter}>
				<option value="all">All triggers</option>
				{#each triggerOptions as trigger}
					<option value={trigger}>{trigger}</option>
				{/each}
			</select>
			<select bind:value={tagFilter}>
				<option value="all">All tags</option>
				{#each tagOptions as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
			<label class="inline-check">
				<input type="checkbox" bind:checked={staleOnly} />
				<span>Stale only</span>
			</label>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<ColumnDropdown allColumns={allColumns} bind:visibleColumns />
	</CollapsibleFilterPanel>

	{#if error}
		<p class="error">{error}</p>
	{:else if routeRuleId}
		<p class="context">Filtered to rule <code>{routeRuleId}</code>. <a href="/automations">Show all</a></p>
	{:else if loading && automations.length === 0}
		<p>Loading automations…</p>
	{:else if automations.length === 0}
		<p>No automations found.</p>
	{:else if sorted.length === 0}
		<p>No automations match the current filters.</p>
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
					{#each sorted as rule}
						<tr class:disabled={!rule.enabled}>
							{#each visibleColumns as column}
								<td>
									{#if column === 'enabled'}
										<span class:disabled-pill={!rule.enabled} class="pill">
											{rule.enabled ? 'Enabled' : 'Disabled'}
										</span>
									{:else if column === 'stale'}
										{#if rule.error}
											<span class="pill stale-pill">Stale</span>
										{:else}
											<span class="subtle">No</span>
										{/if}
									{:else if column === 'name'}
										<div class="primary">
											<strong>{rule.name}</strong>
											<span class="subtle">{rule.id}</span>
											{#if rule.error}
												<span class="stale-text">{rule.error}</span>
											{/if}
											<button
												type="button"
												class="trace-link"
												onclick={() => openTrace(rule.id, lastTriggered(rule))}
											>
												View trace
											</button>
										</div>
									{:else if column === 'priority'}
										<span class="pill">{rule.priority}</span>
									{:else if column === 'last_triggered'}
										<div class="primary">
											<strong>{formatRelativeTime(lastTriggered(rule))}</strong>
											{#if lastTriggered(rule)}
												<span class="subtle">{new Date(lastTriggered(rule) ?? '').toLocaleString()}</span>
											{:else}
												<span class="subtle">Never recorded</span>
											{/if}
										</div>
									{:else if column === 'trigger'}
										<div class="primary">
											<strong>{String(rule.trigger.type ?? 'Unknown')}</strong>
											<span class="subtle">{automationTriggerSummary(rule)}</span>
										</div>
									{:else if column === 'conditions'}
										<span>{automationConditionsSummary(rule)}</span>
									{:else if column === 'actions'}
										<div class="primary">
											<span>{automationActionsSummary(rule)}</span>
											<div class="row-links">
												<a class="inline-link" href={`/events?type=rule_fired&rule_id=${encodeURIComponent(rule.id)}`}>Recent fires</a>
												<button
													type="button"
													class="trace-link"
													onclick={() => openTrace(rule.id, lastTriggered(rule))}
												>
													View trace
												</button>
											</div>
										</div>
									{:else if column === 'tags'}
										{#if rule.tags.length}
											<div class="chips">
												{#each rule.tags as tag}
													<span class="tag-chip">{tag}</span>
												{/each}
											</div>
										{:else}
											<span class="subtle">No tags</span>
										{/if}
									{:else if column === 'id'}
										<span class="subtle">{rule.id}</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if traceRule}
		<section class="panel trace-panel">
			<div class="trace-header">
				<div>
					<h2>Rule Trace</h2>
					<p>{traceRule.name} · {traceRule.id}</p>
				</div>
				<div class="trace-actions">
					<a class="inline-link" href={`/events?type=rule_fired&rule_id=${encodeURIComponent(traceRule.id)}`}>Open full event view</a>
					<button type="button" class="secondary" onclick={closeTrace}>Close</button>
				</div>
			</div>

			<div class="trace-summary">
				<div>
					<dt>Trigger</dt>
					<dd>{automationTriggerSummary(traceRule)}</dd>
				</div>
				<div>
					<dt>Last Triggered</dt>
					<dd>{formatRelativeTime(activeTraceTimestamp)}</dd>
				</div>
				<div>
					<dt>Conditions</dt>
					<dd>{automationConditionsSummary(traceRule)}</dd>
				</div>
				<div>
					<dt>Actions</dt>
					<dd>{automationActionsSummary(traceRule)}</dd>
				</div>
			</div>

			{#if recentFiresForSelectedRule.length}
				<div class="trace-fire-list">
					<strong>Recent fires</strong>
					<div class="chips">
						{#each recentFiresForSelectedRule as fire}
							<button
								type="button"
								class:selected-fire={activeTraceTimestamp === fire.event.timestamp}
								class="secondary trace-chip"
								onclick={() => openTrace(traceRule.id, fire.event.timestamp)}
							>
								{formatRelativeTime(fire.event.timestamp)}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if traceWindowEvents.length === 0}
				<p>No nearby events found for this firing yet.</p>
			{:else}
				<ol class="trace-timeline">
					{#each traceWindowEvents as entry}
						<li class:anchor-event={entry.event.timestamp === activeTraceTimestamp && entry.event_type === 'rule_fired'}>
							<div class="timeline-time">{formatRelativeTime(entry.event.timestamp)}</div>
							<div class="timeline-body">
								<div class="timeline-top">
									<strong>{entry.event_type}</strong>
									{#if eventHref(entry)}
										<a class="inline-link" href={eventHref(entry) ?? undefined}>{eventTargetLabel(entry)}</a>
									{:else}
										<span class="subtle">{eventTargetLabel(entry)}</span>
									{/if}
								</div>
								<div class="timeline-summary">{eventSummary(entry)}</div>
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}
</section>

<style>
	.page { display: grid; gap: 1rem; }
	.heading, .toolbar-row { display: flex; gap: 0.75rem; align-items: center; }
	.heading { justify-content: space-between; }
	.toolbar-row { flex-wrap: wrap; }
	select {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
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
	.inline-check input {
		margin: 0;
		min-width: 0;
		flex: 0 0 auto;
	}
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
		font: inherit;
	}
	.secondary { background: #e6eef7; color: #173b61; }
	.panel {
		background: rgba(255,255,255,0.8);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}
	.table-wrap { overflow: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; min-width: 920px; }
	th, td {
		padding: 0.95rem 0.85rem;
		border-bottom: 1px solid #e4ebf2;
		text-align: left;
		vertical-align: middle;
	}
	th {
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
	tr.disabled { background: rgba(244, 240, 240, 0.45); }
	.primary { display: grid; gap: 0.15rem; }
	.subtle { font-size: 0.82rem; color: #66798a; word-break: break-word; }
	.stale-text { font-size: 0.82rem; color: #8b2a2a; }
	.pill {
		display: inline-block;
		background: #dff4e7;
		color: #14633a;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.82rem;
	}
	.disabled-pill {
		background: #f4dfdf;
		color: #8b2a2a;
	}
	.stale-pill {
		background: #fff0da;
		color: #995c00;
	}
	.row-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.75rem;
		align-items: center;
	}
	.context {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 0.85rem;
		background: #edf4fb;
		color: #214564;
	}
	.inline-link {
		font-size: 0.82rem;
		color: #163c63;
		text-decoration: none;
	}
	.inline-link:hover { text-decoration: underline; }
	.trace-link {
		border: 0;
		background: transparent;
		color: #163c63;
		padding: 0;
		margin: 0;
		font: inherit;
		font-size: 0.82rem;
		text-align: left;
		cursor: pointer;
	}
	.trace-panel {
		display: grid;
		gap: 1rem;
	}
	.trace-header, .trace-actions, .trace-fire-list {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.trace-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem 1rem;
	}
	.trace-summary dt {
		font-size: 0.78rem;
		color: #6a7b8d;
		text-transform: uppercase;
	}
	.trace-summary dd {
		margin: 0.1rem 0 0;
		color: #213444;
	}
	.trace-chip.selected-fire {
		background: #153a63;
		color: white;
	}
	.trace-timeline {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.8rem;
	}
	.trace-timeline li {
		display: grid;
		grid-template-columns: 8.5rem minmax(0, 1fr);
		gap: 0.9rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid #dbe5ee;
		border-radius: 0.9rem;
		background: #fbfdff;
	}
	.trace-timeline li.anchor-event {
		border-color: #9db8d8;
		background: #f0f6fc;
	}
	.timeline-time {
		font-size: 0.82rem;
		color: #627488;
	}
	.timeline-body {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
	}
	.timeline-top {
		display: flex;
		gap: 0.65rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.timeline-summary {
		color: #314657;
		font-size: 0.92rem;
	}
	.chips { display: flex; gap: 0.45rem; flex-wrap: wrap; }
	.tag-chip {
		display: inline-block;
		background: #e7eef6;
		color: #183b60;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.8rem;
	}
	.error { color: #b53622; }
	@media (max-width: 760px) {
		.trace-timeline li {
			grid-template-columns: 1fr;
		}
	}
</style>
