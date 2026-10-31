<!-- What's out of the ordinary now, by name (G-c): leaks, open, unlocked, playing. -->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { WORTH_BUILT_IN } from '#lib/options.js';
	import { worthKnowing } from '#lib/pieces.js';
	import ItemList from './ItemList.svelte';

	let { card, page, label, options }: KindProps<'worth'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'worth', card.ref, WORTH_BUILT_IN));
	const items = $derived(
		worthKnowing(
			Object.values(devices.byId).map((d) => cardFor(d, clock.now)),
			devices.byId,
			rooms.list,
			o
		)
	);
</script>

<ItemList title={label ?? 'Worth knowing'} {items} none="Nothing out of the ordinary." />
