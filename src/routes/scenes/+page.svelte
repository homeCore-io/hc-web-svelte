<script lang="ts">
	import { browser } from '$app/environment';
	import { activateScene, listScenes } from '$lib/api/scenes';
	import { sceneStateCount, sceneSummary, type Scene } from '$lib/models/scene';

	type SortKey = 'name' | 'state_count';
	type SceneColumn = 'name' | 'summary' | 'state_count' | 'activate' | 'id';

	const PREFS_KEY = 'hc-web-svelte:scenes:grid';
	const defaultColumns: SceneColumn[] = ['name', 'summary', 'state_count', 'activate'];
	const allColumns: { id: SceneColumn; label: string }[] = [
		{ id: 'name', label: 'Name' },
		{ id: 'summary', label: 'Summary' },
		{ id: 'state_count', label: 'Captured states' },
		{ id: 'activate', label: 'Control' },
		{ id: 'id', label: 'Scene ID' }
	];

	let scenes = $state<Scene[]>([]);
	let loading = $state(true);
	let busyId = $state<string | null>(null);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let search = $state('');
	let sortBy = $state<SortKey>('name');
	let visibleColumns = $state<SceneColumn[]>([...defaultColumns]);
	let prefsReady = $state(false);

	$effect(() => {
		void refresh();
	});

	$effect(() => {
		if (!browser || prefsReady) return;
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
		if (!browser || !prefsReady) return;
		localStorage.setItem(PREFS_KEY, JSON.stringify({ columns: visibleColumns }));
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			scenes = await listScenes();
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load scenes';
		} finally {
			loading = false;
		}
	}

	async function activate(scene: Scene) {
		busyId = scene.id;
		error = null;
		notice = null;
		try {
			await activateScene(scene.id);
			notice = `Activation sent for ${scene.name}`;
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to activate scene';
		} finally {
			busyId = null;
		}
	}

	function toggleColumn(column: SceneColumn) {
		if (visibleColumns.includes(column)) {
			if (visibleColumns.length === 1) return;
			visibleColumns = visibleColumns.filter((value) => value !== column);
			return;
		}
		visibleColumns = [...visibleColumns, column];
	}

	function moveColumn(column: SceneColumn, direction: -1 | 1) {
		const index = visibleColumns.indexOf(column);
		if (index < 0) return;
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= visibleColumns.length) return;
		const copy = [...visibleColumns];
		const [item] = copy.splice(index, 1);
		copy.splice(nextIndex, 0, item);
		visibleColumns = copy;
	}

	function resetLayout() {
		visibleColumns = [...defaultColumns];
	}

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		const items = scenes.filter((scene) => {
			if (!query) return true;
			return [scene.name, scene.description, scene.id]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(query);
		});
		items.sort((a, b) => {
			if (sortBy === 'state_count') {
				return sceneStateCount(b) - sceneStateCount(a);
			}
			return a.name.localeCompare(b.name);
		});
		return items;
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Scenes</h1>
			<p>Scene inventory using the same grid model, with a single Activate control.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<div class="toolbar panel">
		<div class="toolbar-row">
			<input bind:value={search} placeholder="Search scene name or description" />
			<select bind:value={sortBy}>
				<option value="name">Sort: Name</option>
				<option value="state_count">Sort: Captured states</option>
			</select>
			<button type="button" class="secondary" onclick={resetLayout}>Reset layout</button>
		</div>
		<div class="column-list">
			{#each allColumns as column}
				<div class="column-item">
					<label class="check">
						<input
							type="checkbox"
							checked={visibleColumns.includes(column.id)}
							onchange={() => toggleColumn(column.id)}
						/>
						{column.label}
					</label>
					<div class="move-buttons">
						<button type="button" class="ghost" onclick={() => moveColumn(column.id, -1)}>↑</button>
						<button type="button" class="ghost" onclick={() => moveColumn(column.id, 1)}>↓</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}
	{#if notice}
		<p class="notice">{notice}</p>
	{/if}

	{#if loading && scenes.length === 0}
		<p>Loading scenes…</p>
	{:else if filtered.length === 0}
		<p>No scenes match the current filters.</p>
	{:else}
		<div class="table-wrap panel">
			<table>
				<thead>
					<tr>
						{#each visibleColumns as column}
							<th scope="col">{allColumns.find((value) => value.id === column)?.label ?? column}</th>
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
										{sceneSummary(scene)}
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
	.heading, .toolbar-row, .column-item, .check, .move-buttons { display: flex; gap: 0.75rem; align-items: center; }
	.heading { justify-content: space-between; }
	.panel {
		background: rgba(255,255,255,0.8);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}
	.toolbar { display: grid; gap: 1rem; }
	.column-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.6rem; }
	.column-item {
		justify-content: space-between;
		background: #f7fafc;
		border: 1px solid #dbe4ed;
		border-radius: 0.8rem;
		padding: 0.55rem 0.7rem;
	}
	input, select {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
	input { min-width: min(360px, 100%); flex: 1; }
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
	.ghost {
		background: #eef3f8;
		color: #173b61;
		padding: 0.35rem 0.6rem;
	}
	.table-wrap { overflow: auto; padding: 0; }
	table { width: 100%; border-collapse: collapse; min-width: 760px; }
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
	.notice {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 0.85rem;
		background: #e6f4ea;
		color: #155b36;
	}
	.error { color: #b53622; }
</style>
