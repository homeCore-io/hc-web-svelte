<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import DashboardGrid from '$lib/components/dashboard/DashboardGrid.svelte';
	import { listDevices } from '$lib/api/devices';
	import { listScenes } from '$lib/api/scenes';
	import { listModes } from '$lib/api/modes';
	import { dashboardsState } from '$lib/stores/dashboards.svelte';
	import { eventsState } from '$lib/stores/events.svelte';
	import type { DashboardDefinition } from '$lib/models/dashboard';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';

	let { params }: { params: { id: string } } = $props();

	let dashboard = $state<DashboardDefinition | null>(null);
	let devices = $state<DeviceState[]>([]);
	let scenes = $state<Scene[]>([]);
	let modes = $state<ModeState[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		void (async () => {
			loading = true;
			error = null;
			try {
				await dashboardsState.ensureLoaded();
				dashboard = dashboardsState.getById(params.id);
				if (!dashboard) {
					throw new Error('Dashboard not found');
				}
				const [loadedDevices, loadedScenes, loadedModes] = await Promise.all([
					listDevices(),
					listScenes(),
					listModes()
				]);
				devices = loadedDevices;
				scenes = loadedScenes;
				modes = loadedModes;
				if (browser) {
					eventsState.connect();
				}
			} catch (value) {
				error = value instanceof Error ? value.message : 'Unable to load dashboard';
			} finally {
				loading = false;
			}
		})();
	});

	function switchDashboard(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		if (target.value) {
			void goto(`/dashboards/${target.value}`);
		}
	}
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
			<div class="heading-actions">
				<label class="switcher">
					<span>Switch dashboard</span>
					<select onchange={switchDashboard} value={dashboard.id}>
						{#each dashboardsState.items as item}
							<option value={item.id}>{item.name}</option>
						{/each}
					</select>
				</label>
				<div class="meta">
				{#if dashboard.is_default}
					<span class="badge">Default</span>
				{/if}
				{#each dashboard.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
				{#if eventsState.connected}
					<span class="live connected">Live events</span>
				{:else}
					<span class="live">Reconnecting events</span>
				{/if}
				</div>
			</div>
		</div>

		<DashboardGrid
			{dashboard}
			{devices}
			{scenes}
			{modes}
			events={eventsState.items}
		/>
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

	.heading-actions {
		display: grid;
		gap: 0.75rem;
		justify-items: end;
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
		justify-content: end;
	}

	.badge,
	.tag,
	.live {
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		background: #dde9f5;
		color: #173e65;
		font-size: 0.82rem;
	}

	.connected {
		background: #dff4e7;
		color: #14633a;
	}

	.switcher {
		display: grid;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: #516477;
	}

	select {
		min-width: 220px;
		padding: 0.65rem 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}

	.error {
		color: #b53622;
	}

	@media (max-width: 860px) {
		.heading {
			flex-direction: column;
		}

		.heading-actions {
			width: 100%;
			justify-items: stretch;
		}

		.meta {
			justify-content: start;
		}

		select {
			width: 100%;
			min-width: 0;
		}
	}
</style>
