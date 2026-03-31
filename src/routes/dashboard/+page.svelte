<script lang="ts">
	import { goto } from '$app/navigation';
	import { dashboardsState } from '$lib/stores/dashboards.svelte';

	let error = $state<string | null>(null);

	$effect(() => {
		void (async () => {
			try {
				await dashboardsState.ensureLoaded();
				if (dashboardsState.defaultDashboard) {
					await goto(`/dashboards/${dashboardsState.defaultDashboard.id}`);
				} else {
					await goto('/dashboards');
				}
			} catch (value) {
				error = value instanceof Error ? value.message : 'Unable to load dashboards';
			}
		})();
	});
</script>

{#if error}
	<p>{error}</p>
{:else}
	<p>Loading dashboard…</p>
{/if}
