<!-- Every speaker and TV playing now, with its room (G-c). -->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { playingNow } from '#lib/pieces.js';
	import ItemList from './ItemList.svelte';

	let { label }: KindProps<'playing'> = $props();
	const items = $derived(
		playingNow(
			Object.values(devices.byId).map((d) => cardFor(d, clock.now)),
			devices.byId,
			rooms.list
		)
	);
</script>

<ItemList title={label ?? 'Playing'} {items} none="Nothing playing." />
