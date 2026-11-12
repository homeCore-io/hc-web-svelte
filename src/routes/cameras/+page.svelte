<!--
	Every camera in the house (Everywhere › Cameras): one large and live, the
	rest as snapshots, and the day's events. Drawn by the console's own page,
	loaded only here.
-->
<script lang="ts">
	import type { Component } from 'svelte';

	let Wall = $state<Component | null>(null);
	$effect(() => {
		if (!Wall) void import('#lib/console/CamerasWall.svelte').then((m) => (Wall = m.default));
	});
</script>

{#if Wall}<Wall />{/if}
