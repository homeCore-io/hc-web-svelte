<!--
	A generated room page (N4): the room's devices as cards — things to use,
	its scenes, its readings, then infrastructure (C6). `/rooms/none` holds the
	devices that are in no room.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { cardFor } from '#lib/card.js';
	import { byRoom, roomSections } from '#lib/summary.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import CardGrid from '#lib/components/CardGrid.svelte';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import CustomiseButton from '#lib/components/CustomiseButton.svelte';

	const id = $derived(page.params.id ?? '');
	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(id === 'none' ? 'Not in a room' : room?.name);
	const inRoom = $derived(byRoom(devices.byId, rooms.list).get(id === 'none' ? '' : id) ?? []);
	const sections = $derived(roomSections(inRoom.map((d) => cardFor(d, clock.now))));

	$effect(() => heading.show(name ?? null));

	const devicesOf = (ids: { id: string }[]) => ids.map((c) => devices.byId[c.id]!).filter(Boolean);
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if name === undefined}
	<p class="quiet">This room isn't in the house any more.</p>
{:else if sections.length === 0}
	<p class="quiet">Nothing in {name} yet.</p>
{:else}
	<div class="room">
		<CustomiseButton page={`room:${id}`} />
		<CustomiseBar page={`room:${id}`} />
		{#each sections as s (s.key)}
			<section>
				<h2 class="section-label">{s.title}</h2>
				<CardGrid devices={devicesOf(s.cards)} large={['media_player']} page={`room:${id}`} />
			</section>
		{/each}
	</div>
{/if}

<style>
	.room {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
