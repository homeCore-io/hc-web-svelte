<!--
	One of the house's Everywhere views (Lights, Media, Climate, Security,
	Water): every room at once. Drawn by the console's own page, loaded only
	here. On a phone, in any look, its phone form (PhoneEverywhere): the views
	as a segmented control and rows that wrap, as the console's phone has it.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { page } from '$app/state';
	import { phone } from '#lib/console/phone/phone.svelte.js';
	import type { ViewId } from '#lib/console/everywhere.js';

	const view = $derived(page.params.view ?? '');
	let Everywhere = $state<Component<{ view: string }> | null>(null);
	let Phone = $state<Component<{ view: ViewId }> | null>(null);
	$effect(() => {
		if (phone.current) {
			if (!Phone)
				void import('#lib/console/phone/PhoneEverywhere.svelte').then((m) => (Phone = m.default));
		} else if (!Everywhere)
			void import('#lib/console/Everywhere.svelte').then((m) => (Everywhere = m.default));
	});
</script>

{#if phone.current}
	{#if Phone}<Phone view={view as ViewId} />{/if}
{:else if Everywhere}<Everywhere {view} />{/if}
