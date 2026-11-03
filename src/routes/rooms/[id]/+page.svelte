<!--
	A generated room page (N4): the room's devices as cards — things to use,
	its scenes, its readings, then infrastructure (C6) — and what the household
	added from elsewhere. `/rooms/none` holds the devices that are in no room.

	In the Lit look its grouping makes the page (13 §8.2), loaded only then;
	either way the one renderer draws it, so it is arranged in place.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { cardRef } from '#lib/layers.js';
	import { roomPage, type RoomInput } from '#lib/page.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import { look } from '#lib/look.svelte.js';

	const id = $derived(page.params.id ?? '');
	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(id === 'none' ? 'Not in a room' : room?.name);

	$effect(() => heading.show(name ?? null));

	const key = $derived(`room:${id}`);
	// Lit groups a room its own way (13 §8.2); its grouping loads only in Lit.
	let litGrouping = $state<typeof import('#lib/lit/grouping.js') | null>(null);
	$effect(() => {
		if (look.lit && !litGrouping)
			void import('#lib/lit/grouping.js').then((m) => (litGrouping = m));
	});
	const input = $derived<RoomInput>({
		devices: devices.byId,
		rooms: rooms.list,
		// Cards the household added from elsewhere in the house (M2 `add`).
		added: view.added(key),
		pluginCard: (r) => {
			const c = cardRef(r);
			const found = c ? pluginUis.card(c.pluginId, c.element) : undefined;
			return found
				? { label: found.slot.label ?? 'A plugin’s card', forms: found.slot.forms }
				: undefined;
		},
		now: clock.now
	});
	const doc = $derived(
		look.lit && litGrouping ? litGrouping.litRoomPage(id, input) : roomPage(id, input)
	);
	// Lit draws the room's name in its header; until its grouping has loaded, nothing yet.
	const waiting = $derived(look.lit && !litGrouping);
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if name === undefined}
	<p class="quiet">This room isn't in the house any more.</p>
{:else}
	<div class="room">
		<CustomiseBar page={key} />
		{#if doc.sections.length === 0}
			<p class="quiet">Nothing in {name} yet.</p>
		{/if}
		{#if !waiting}<PageView page={doc} />{/if}
	</div>
{/if}

<style>
	.room {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
