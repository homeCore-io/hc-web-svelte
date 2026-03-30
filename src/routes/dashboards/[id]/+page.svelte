<script lang="ts">
	import DashboardGrid from '$lib/components/dashboard/DashboardGrid.svelte';
	import { getDashboard } from '$lib/api/dashboards';
	import { listDevices } from '$lib/api/devices';
	import { listScenes } from '$lib/api/scenes';
	import { listModes } from '$lib/api/modes';
	import type { DashboardDefinition } from '$lib/models/dashboard';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';
	import type { HcEvent } from '$lib/models/event';

	let { params }: { params: { id: string } } = $props();

	let dashboard = $state<DashboardDefinition | null>(null);
	let devices = $state<DeviceState[]>([]);
	let scenes = $state<Scene[]>([]);
	let modes = $state<ModeState[]>([]);
	let events = $state<HcEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		void (async () => {
			loading = true;
			error = null;
			try {
				const [loadedDashboard, loadedDevices, loadedScenes, loadedModes] = await Promise.all([
					getDashboard(params.id),
					listDevices(),
					listScenes(),
					listModes()
				]);
				dashboard = loadedDashboard;
				devices = loadedDevices;
				scenes = loadedScenes;
				modes = loadedModes;
			} catch (value) {
				error = value instanceof Error ? value.message : 'Unable to load dashboard';
			} finally {
				loading = false;
			}
		})();
	});
</script>

{#if loading}
	<p>Loading dashboard…</p>
{:else if error}
	<p class="error">{error}</p>
{:else if dashboard}
	<section class="page">
		<div class="heading">
			<div>
				<h1>{dashboard.name}</h1>
				<p>{dashboard.description ?? 'HomeCore dashboard'}</p>
			</div>
			<div class="meta">
				{#if dashboard.is_default}
					<span class="badge">Default</span>
				{/if}
				{#each dashboard.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		</div>

		<DashboardGrid {dashboard} {devices} {scenes} {modes} {events} />
	</section>
{/if}

<style>
	.page {
		display: grid;
		gap: 1rem;
	}

	.heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1rem;
	}

	h1 {
		margin: 0;
	}

	p {
		margin: 0.35rem 0 0;
		color: #617285;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.badge,
	.tag {
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		background: #dde9f5;
		color: #173e65;
		font-size: 0.82rem;
	}

	.error {
		color: #b53622;
	}
</style>
