<!--
	One of the house's Everywhere views (Lights, Media, Climate, Security,
	Water): every room at once. Drawn by the console's own page, loaded only
	here.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { page } from '$app/state';

	const view = $derived(page.params.view ?? '');
	let Everywhere = $state<Component<{ view: string }> | null>(null);
	$effect(() => {
		if (!Everywhere)
			void import('#lib/console/Everywhere.svelte').then((m) => (Everywhere = m.default));
	});
</script>

{#if Everywhere}<Everywhere {view} />{/if}
