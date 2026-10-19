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
	import { added, cardRef, ref } from '#lib/layers.js';
	import AddedCards from '#lib/components/AddedCards.svelte';
	import type { CoreDevice } from '#lib/devices.js';
	import { view } from '#lib/view.svelte.js';
	import { editing } from '#lib/edit.svelte.js';

	const id = $derived(page.params.id ?? '');
	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(id === 'none' ? 'Not in a room' : room?.name);
	const inRoom = $derived(byRoom(devices.byId, rooms.list).get(id === 'none' ? '' : id) ?? []);
	const sections = $derived(roomSections(inRoom.map((d) => cardFor(d, clock.now))));

	$effect(() => heading.show(name ?? null));

	const devicesOf = (ids: { id: string }[]) => ids.map((c) => devices.byId[c.id]!).filter(Boolean);

	const key = $derived(`room:${id}`);
	// Cards the household added from elsewhere in the house (M2 `add`).
	const extra = $derived(
		added(view.changes(key))
			.filter((r) => r.startsWith('device:'))
			.map((r) => devices.byId[r.slice(7)])
			.filter((d): d is CoreDevice => d !== undefined && !inRoom.includes(d))
	);
	// Plugins' own cards added here.
	const cards = $derived(added(view.changes(key)).filter((r) => cardRef(r) !== undefined));
	$effect(() => {
		if (editing.on(key))
			editing.present = new Set([
				...[...inRoom, ...extra].map((d) => ref.device(d.device_id)),
				...cards
			]);
	});
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if name === undefined}
	<p class="quiet">This room isn't in the house any more.</p>
{:else}
	<div class="room">
		<CustomiseButton page={key} />
		<CustomiseBar page={key} />
		{#if sections.length === 0 && extra.length === 0 && cards.length === 0}
			<p class="quiet">Nothing in {name} yet.</p>
		{/if}
		{#each sections as s (s.key)}
			<section>
				<h2 class="section-label">{s.title}</h2>
				<CardGrid devices={devicesOf(s.cards)} large={['media_player']} page={key} />
			</section>
		{/each}
		{#if extra.length > 0 || cards.length > 0}
			<section>
				<h2 class="section-label">Also here</h2>
				{#if extra.length > 0}<CardGrid devices={extra} page={key} added />{/if}
				{#if cards.length > 0}<AddedCards refs={cards} page={key} />{/if}
			</section>
		{/if}
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
