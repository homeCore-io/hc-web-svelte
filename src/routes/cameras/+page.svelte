<!--
	Every camera in the house (Everywhere › Cameras): one large and live, the
	rest as snapshots, and the day's events. Drawn by the console's own page,
	loaded only here. On a phone, in any look, its phone form (PhoneCameras):
	the live picture across the top, the controls under it, then the rest.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import { phone } from '#lib/console/phone/phone.svelte.js';
	import { heading } from '#lib/heading.svelte.js';

	// The phone form draws its own title, as the wall does.
	$effect(() => heading.ownTitle());
	let Wall = $state<Component | null>(null);
	let Phone = $state<Component | null>(null);
	$effect(() => {
		if (phone.current) {
			if (!Phone)
				void import('#lib/console/phone/PhoneCameras.svelte').then((m) => (Phone = m.default));
		} else if (!Wall)
			void import('#lib/console/CamerasWall.svelte').then((m) => (Wall = m.default));
	});
</script>

{#if phone.current}
	{#if Phone}<Phone />{/if}
{:else if Wall}<Wall />{/if}
