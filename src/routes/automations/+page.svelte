<script lang="ts">
	import CollapsibleFilterPanel from '$lib/components/ui/CollapsibleFilterPanel.svelte';
	import ColumnDropdown from '$lib/components/ui/ColumnDropdown.svelte';
	import { listAutomations } from '$lib/api/automations';
	import {
		automationActionsSummary,
		automationConditionsSummary,
		automationTriggerSummary,
		type AutomationRule
	} from '$lib/models/automation';

	type EnabledFilter = 'all' | 'enabled' | 'disabled';
	type SortKey = 'name' | 'priority' | 'trigger' | 'enabled';
	type SortDirection = 'asc' | 'desc';
	type AutomationColumn =
		| 'enabled'
		| 'name'
		| 'priority'
		| 'trigger'
		| 'conditions'
		| 'actions'
		| 'id';

	const PREFS_KEY = 'hc-web-svelte:automations:grid';
	const defaultColumns: AutomationColumn[] = [
		'enabled',
		'name',
		'priority',
		'trigger',
		'conditions',
		'actions'
	];
	const allColumns: { id: AutomationColumn; label: string }[] = [
		{ id: 'enabled', label: 'Enabled' },
		{ id: 'name', label: 'Name' },
		{ id: 'priority', label: 'Priority' },
		{ id: 'trigger', label: 'Trigger' },
		{ id: 'conditions', label: 'Conditions' },
		{ id: 'actions', label: 'Actions' },
		{ id: 'id', label: 'Rule ID' }
	];

	let automations = $state<AutomationRule[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let enabledFilter = $state<EnabledFilter>('all');
	let triggerFilter = $state('all');
	let sortBy = $state<SortKey>('priority');
	let sortDirection = $state<SortDirection>('desc');
	let visibleColumns = $state<AutomationColumn[]>([...defaultColumns]);
	let draggedColumn = $state<AutomationColumn | null>(null);
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

	async function refresh() {
		loading = true;
		error = null;
		try {
			automations = await listAutomations();
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
	}

	function isSortColumnActive(column: AutomationColumn): boolean {
		return (
			(column === 'name' && sortBy === 'name') ||
			(column === 'priority' && sortBy === 'priority') ||
			(column === 'trigger' && sortBy === 'trigger') ||
			(column === 'enabled' && sortBy === 'enabled')
		);
	}

	const triggerOptions = $derived.by(() =>
		[...new Set(automations.map((rule) => String(rule.trigger.type ?? 'Unknown')))].sort((a, b) =>
			a.localeCompare(b)
		)
	);

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return automations.filter((rule) => {
			if (enabledFilter === 'enabled' && !rule.enabled) return false;
			if (enabledFilter === 'disabled' && rule.enabled) return false;
			if (triggerFilter !== 'all' && String(rule.trigger.type ?? 'Unknown') !== triggerFilter) return false;
			if (!query) return true;
			return [
				rule.name,
				rule.id,
				String(rule.priority),
				automationTriggerSummary(rule),
				automationConditionsSummary(rule),
				automationActionsSummary(rule)
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
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<ColumnDropdown allColumns={allColumns} bind:visibleColumns />
	</CollapsibleFilterPanel>

	{#if error}
		<p class="error">{error}</p>
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
									{:else if column === 'name'}
										<div class="primary">
											<strong>{rule.name}</strong>
											<span class="subtle">{rule.id}</span>
										</div>
									{:else if column === 'priority'}
										<span class="pill">{rule.priority}</span>
									{:else if column === 'trigger'}
										<div class="primary">
											<strong>{String(rule.trigger.type ?? 'Unknown')}</strong>
											<span class="subtle">{automationTriggerSummary(rule)}</span>
										</div>
									{:else if column === 'conditions'}
										<span>{automationConditionsSummary(rule)}</span>
									{:else if column === 'actions'}
										<span>{automationActionsSummary(rule)}</span>
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
	.error { color: #b53622; }
</style>
