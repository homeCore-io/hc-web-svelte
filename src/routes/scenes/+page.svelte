<script lang="ts">
	import { page } from '$app/state';
	import { listEvents } from '$lib/api/events';
	import CollapsibleFilterPanel from '$lib/components/ui/CollapsibleFilterPanel.svelte';
	import ColumnDropdown from '$lib/components/ui/ColumnDropdown.svelte';
	import { activateScene, listScenes } from '$lib/api/scenes';
	import { listDevices, setDeviceState } from '$lib/api/devices';
	import { deviceDisplayName, formatRelativeTime, type DeviceState } from '$lib/models/device';
	import {
		pluginSceneSummary,
		sceneStateCount,
		type DisplayScene,
		type Scene
	} from '$lib/models/scene';

	type SortKey = 'name' | 'state_count' | 'source' | 'last_activated';
	type SortDirection = 'asc' | 'desc';
	type SceneColumn =
		| 'name'
		| 'summary'
		| 'source'
		| 'last_activated'
		| 'state_count'
		| 'activate'
		| 'id';

	const PREFS_KEY = 'hc-web-svelte:scenes:grid';
	const defaultColumns: SceneColumn[] = ['name', 'summary', 'source', 'last_activated', 'activate'];
	const allColumns: { id: SceneColumn; label: string }[] = [
		{ id: 'name', label: 'Name' },
		{ id: 'summary', label: 'Summary' },
		{ id: 'source', label: 'Source' },
		{ id: 'last_activated', label: 'Last Activated' },
		{ id: 'state_count', label: 'Captured states' },
		{ id: 'activate', label: 'Control' },
		{ id: 'id', label: 'Scene ID' }
	];

	let nativeScenes = $state<Scene[]>([]);
	let pluginSceneDevices = $state<DeviceState[]>([]);
	let loading = $state(true);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let search = $state('');
	let sortBy = $state<SortKey>('name');
	let sortDirection = $state<SortDirection>('asc');
	let sourceFilter = $state<'all' | 'native' | 'plugin'>('all');
	let visibleColumns = $state<SceneColumn[]>([...defaultColumns]);
	let draggedColumn = $state<SceneColumn | null>(null);
	let toolbarExpanded = $state(false);
	let prefsReady = $state(false);
	let lastActivatedBySceneId = $state<Record<string, string>>({});
	const routeSceneId = $derived(page.url.searchParams.get('scene_id')?.trim() ?? '');

	$effect(() => {
		void refresh();
	});

	$effect(() => {
		if (typeof localStorage === 'undefined' || prefsReady) return;
		const raw = localStorage.getItem(PREFS_KEY);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { columns?: SceneColumn[] };
				if (Array.isArray(parsed.columns)) {
					const filtered = parsed.columns.filter((value): value is SceneColumn =>
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
			const [loadedScenes, loadedDevices, recentSceneEvents] = await Promise.all([
				listScenes(),
				listDevices(),
				listEvents({ limit: 1000, type: 'scene_activated' })
			]);
			nativeScenes = loadedScenes;
			pluginSceneDevices = loadedDevices.filter((device) => device.device_type === 'scene');
			lastActivatedBySceneId = buildLastActivatedLookup(recentSceneEvents);
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load scenes';
		} finally {
			loading = false;
		}
	}

	async function activate(scene: DisplayScene) {
		busyId = scene.id;
		error = null;
		notice = null;
		try {
			if (scene.isPlugin) {
				await setDeviceState(scene.id, { activate: true });
			} else {
				await activateScene(scene.id);
			}
			lastActivatedBySceneId = {
				...lastActivatedBySceneId,
				[scene.id]: new Date().toISOString()
			};
			notice = `Activation sent for ${scene.name}`;
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to activate scene';
		} finally {
			busyId = null;
		}
	}

	function sortByColumn(column: SceneColumn) {
		const nextSort: SortKey | null =
			column === 'name' ? 'name'
			: column === 'state_count' ? 'state_count'
			: column === 'last_activated' ? 'last_activated'
			: column === 'source' ? 'source'
			: null;
		if (!nextSort) return;
		if (sortBy === nextSort) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		sortBy = nextSort;
		sortDirection = 'asc';
	}

	function handleDragStart(column: SceneColumn) {
		draggedColumn = column;
	}

	function handleDrop(targetColumn: SceneColumn) {
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
		sourceFilter = 'all';
	}

	function isSortColumnActive(column: SceneColumn): boolean {
		return (
			(column === 'name' && sortBy === 'name') ||
			(column === 'state_count' && sortBy === 'state_count') ||
			(column === 'last_activated' && sortBy === 'last_activated') ||
			(column === 'source' && sortBy === 'source')
		);
	}

	function buildLastActivatedLookup(
		entries: {
			event_type: string;
			event?: { scene_id?: string; timestamp?: string };
		}[]
	): Record<string, string> {
		const lookup: Record<string, string> = {};
		for (const entry of entries) {
			if (entry.event_type !== 'scene_activated') continue;
			const sceneId = entry.event?.scene_id;
			const timestamp = entry.event?.timestamp;
			if (!sceneId || !timestamp) continue;
			if (!(sceneId in lookup)) lookup[sceneId] = timestamp;
		}
		return lookup;
	}

	const allScenes = $derived.by<DisplayScene[]>(() => [
		...nativeScenes.map((scene) => ({
			...scene,
			isPlugin: false,
			lastActivated: lastActivatedBySceneId[scene.id] ?? null
		})),
		...pluginSceneDevices.map((device) => ({
			id: device.device_id,
			name: deviceDisplayName(device),
			description: null,
			states: {},
			isPlugin: true,
			lastActivated: lastActivatedBySceneId[device.device_id] ?? null
		}))
	]);

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		const items = allScenes.filter((scene) => {
			if (routeSceneId && scene.id !== routeSceneId) return false;
			if (sourceFilter === 'native' && scene.isPlugin) return false;
			if (sourceFilter === 'plugin' && !scene.isPlugin) return false;
			if (!query) return true;
			return [scene.name, pluginSceneSummary(scene), scene.id, scene.isPlugin ? 'plugin' : 'native']
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(query);
		});
		items.sort((a, b) => {
			let result = 0;
			if (sortBy === 'state_count') result = sceneStateCount(a) - sceneStateCount(b);
			else if (sortBy === 'last_activated') {
				const aTime = a.lastActivated ? Date.parse(a.lastActivated) : 0;
				const bTime = b.lastActivated ? Date.parse(b.lastActivated) : 0;
				result = aTime - bTime;
			}
			else if (sortBy === 'source') result = (a.isPlugin ? 'plugin' : 'native').localeCompare(b.isPlugin ? 'plugin' : 'native');
			else result = a.name.localeCompare(b.name);
			return sortDirection === 'asc' ? result : -result;
		});
		return items;
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Scenes</h1>
			<p>Native scenes and plugin-managed scene devices in one grid.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<CollapsibleFilterPanel
		bind:search
		bind:expanded={toolbarExpanded}
		searchPlaceholder="Search scene name, summary, source"
	>
		<div class="toolbar-row">
			<select bind:value={sourceFilter}>
				<option value="all">All scenes</option>
				<option value="native">Native only</option>
				<option value="plugin">Plugin only</option>
			</select>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>

		<ColumnDropdown allColumns={allColumns} bind:visibleColumns />
	</CollapsibleFilterPanel>

	{#if error}
		<p class="error">{error}</p>
	{:else if routeSceneId}
		<p class="notice">Filtered to scene <code>{routeSceneId}</code>. <a href="/scenes">Show all</a></p>
	{/if}
	{#if notice}
		<p class="notice">{notice}</p>
	{/if}

	{#if loading && allScenes.length === 0}
		<p>Loading scenes…</p>
	{:else if allScenes.length === 0}
		<p>No scenes found.</p>
	{:else if filtered.length === 0}
		<p>No scenes match the current filters.</p>
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
					{#each filtered as scene}
						<tr>
							{#each visibleColumns as column}
								<td>
									{#if column === 'name'}
										<div class="primary">
											<strong>{scene.name}</strong>
											<span class="subtle">{scene.id}</span>
										</div>
									{:else if column === 'summary'}
										{pluginSceneSummary(scene)}
									{:else if column === 'source'}
										<span class:plugin-pill={scene.isPlugin} class="pill">
											{scene.isPlugin ? 'Plugin' : 'Native'}
										</span>
									{:else if column === 'last_activated'}
										<div class="primary">
											<strong>{formatRelativeTime(scene.lastActivated)}</strong>
											{#if scene.lastActivated}
												<span class="subtle">{new Date(scene.lastActivated).toLocaleString()}</span>
											{:else}
												<span class="subtle">Never recorded</span>
											{/if}
										</div>
									{:else if column === 'state_count'}
										<span class="pill">{sceneStateCount(scene)}</span>
									{:else if column === 'activate'}
										<button type="button" class="secondary" onclick={() => activate(scene)} disabled={busyId === scene.id}>
											{busyId === scene.id ? 'Activating…' : 'Activate'}
										</button>
									{:else if column === 'id'}
										<span class="subtle">{scene.id}</span>
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
	.table-wrap { overflow: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; min-width: 860px; }
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
	.primary { display: grid; gap: 0.15rem; }
	.subtle { font-size: 0.82rem; color: #66798a; word-break: break-word; }
	.pill {
		display: inline-block;
		background: #dde9f5;
		color: #173e65;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.82rem;
	}
	.plugin-pill {
		background: #f0e7fb;
		color: #5e2c91;
	}
	.notice {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 0.85rem;
		background: #e6f4ea;
		color: #155b36;
	}
	.error { color: #b53622; }
</style>
