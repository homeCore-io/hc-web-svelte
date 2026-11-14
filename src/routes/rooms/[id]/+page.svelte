<!--
	A generated room page (N4): the room's devices as cards — things to use,
	its scenes, its readings, then infrastructure (C6) — and what the household
	added from elsewhere. `/rooms/none` holds the devices that are in no room.

	A look with a room grouping of its own makes the page by its rules (13
	§8), loaded only then; either way the one renderer draws it, so it is
	arranged in place.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { rooms } from '#lib/rooms.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import RoomView from '#lib/components/rooms/RoomView.svelte';

	const id = $derived(page.params.id ?? '');
	const name = $derived(id === 'none' ? 'No room' : rooms.list.find((r) => r.id === id)?.name);
	$effect(() => heading.show(name ?? null));
</script>

<RoomView {id} />
