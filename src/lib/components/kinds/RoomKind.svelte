<!--
	A room on Home: in the list, its summary and "All off" (C5); in the room
	field or tiles, its box (G-b), with the settings that apply on this screen.
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { roomBox } from '#lib/roomBox.js';
	import RoomBox from '../RoomBox.svelte';
	import RoomRow from '../RoomRow.svelte';

	let { card, label, page, layout }: KindProps<'room'> = $props();
	const cards = $derived(card.devices.map((d) => cardFor(d, clock.now)));
	const boxed = $derived(layout === 'field' || layout === 'tiles');
	const box = $derived(
		boxed
			? roomBox(
					card.devices,
					cards,
					devices.byId,
					kindOptions.of(page, 'room', card.ref, ROOM_BUILT_IN)
				)
			: undefined
	);
</script>

{#if box}
	<RoomBox
		href={card.href}
		name={label ?? card.name}
		{box}
		devices={card.devices}
		tiles={layout === 'tiles'}
	/>
{:else}
	<RoomRow
		href={card.href}
		name={label ?? card.name}
		icon={household.iconOf(card.id)}
		devices={card.devices}
		{cards}
	/>
{/if}
