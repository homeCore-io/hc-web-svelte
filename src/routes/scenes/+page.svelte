<script lang="ts">
	import { listScenes } from '$lib/api/scenes';
	import type { Scene } from '$lib/models/scene';

	let scenes = $state<Scene[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		void refresh();
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
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Scenes</h1>
			<p>Saved scenes and the number of device states they capture.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{:else if loading && scenes.length === 0}
		<p>Loading scenes…</p>
	{:else if scenes.length === 0}
		<p>No scenes found.</p>
	{:else}
		<div class="grid">
			{#each scenes as scene}
				<article class="card">
					<strong>{scene.name}</strong>
					<p>{scene.description ?? 'No description'}</p>
					<span>{Object.keys(scene.states ?? {}).length} captured states</span>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page { display: grid; gap: 1rem; }
	.heading { display: flex; gap: 1rem; justify-content: space-between; align-items: center; }
	.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.85rem; }
	.card {
		background: white;
		border: 1px solid #dbe5ef;
		border-radius: 0.95rem;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
	}
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
	}
	h1, p { margin: 0; }
	p { color: #627488; }
	span {
		color: #173e65;
		background: #dde9f5;
		width: fit-content;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-size: 0.82rem;
	}
	.error { color: #b53622; }
</style>
