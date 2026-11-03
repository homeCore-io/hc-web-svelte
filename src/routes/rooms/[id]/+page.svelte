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
	// A look may group a room its own way (13 §8); grouping loads only then.
	const rules = $derived(look.def.grouping.room);
	let grouping = $state<typeof import('#lib/looks/grouping.js') | null>(null);
	$effect(() => {
		if (rules && !grouping) void import('#lib/looks/grouping.js').then((m) => (grouping = m));
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
		rules && grouping ? grouping.groupRoom(id, input, rules, look.def.frame) : roomPage(id, input)
	);
	// Such a look draws the room's name in its header; until its grouping has loaded, nothing yet.
	const waiting = $derived(!!rules && !grouping);
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
