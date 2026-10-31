<!-- A room on Home: its summary and "All off" (C5). -->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import RoomRow from '../RoomRow.svelte';

	let { card, label }: KindProps<'room'> = $props();
	const cards = $derived(card.devices.map((d) => cardFor(d, clock.now)));
</script>

<RoomRow
	href={card.href}
	name={label ?? card.name}
	icon={household.iconOf(card.id)}
	devices={card.devices}
	{cards}
/>
