<!--
	A room on Home: in the list, its summary and "All off" (C5); in the room
	field or tiles, its box (G-b), with the settings that apply on this screen.
	In the field, the field's plan says whether it is a big box (`large`) or a
	small one (mockup A).
	On a page someone made, in a grid, its box too (G27).
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { ROOM_BUILT_IN, sourceOf } from '#lib/options.js';
	import { degrees, roomBox, sourced } from '#lib/roomBox.js';
	import FieldBox from '../FieldBox.svelte';
	import RoomBox from '../RoomBox.svelte';
	import RoomRow from '../RoomRow.svelte';

	let { card, label, page, layout, form }: KindProps<'room'> = $props();
	const cards = $derived(card.devices.map((d) => cardFor(d, clock.now)));
	// In a grid (a page someone made, G27) a room is a box the grid's size.
	const boxed = $derived(layout === 'field' || layout === 'tiles' || layout === 'grid');
	const options = $derived(kindOptions.of(page, 'room', card.ref, ROOM_BUILT_IN));
	const box = $derived(boxed ? roomBox(card.devices, cards, devices.byId, options) : undefined);
	// In the list, the same temperature its box would show.
	const temperature = $derived(
		boxed
			? undefined
			: degrees(sourced(sourceOf(options.temperature), 'temperature', devices.byId, card.devices))
	);
</script>

{#if box && layout === 'field'}
	<FieldBox
		href={card.href}
		name={label ?? card.name}
		{box}
		devices={card.devices}
		big={form === 'large'}
		photo={household.photoOf(card.id)}
	/>
{:else if box}
	<RoomBox
		href={card.href}
		name={label ?? card.name}
		{box}
		devices={card.devices}
		tiles
		photo={household.photoOf(card.id)}
	/>
{:else}
	<RoomRow
		href={card.href}
		name={label ?? card.name}
		icon={household.iconOf(card.id)}
		devices={card.devices}
		{cards}
		{temperature}
	/>
{/if}
