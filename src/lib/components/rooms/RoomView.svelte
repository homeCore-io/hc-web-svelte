<!--
	A room drawn as its page (N4): the room's devices as cards, or as a look
	groups them (13 §8), and what the household added from elsewhere. Drawn
	by the room's page, and over Home as a sheet (13 §7, G1), where it is
	only looked at and used, not arranged. The console's look draws the
	room's page its own way (ConsoleRoom), loaded only for it.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { inSheet } from '#lib/heading.svelte.js';
	import { cardRef } from '#lib/layers.js';
	import { roomPage, type RoomInput } from '#lib/page.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import CustomiseBar from '../CustomiseBar.svelte';
	import PageView from '../PageView.svelte';
	import { look } from '#lib/look.svelte.js';
	import { shellOf } from '#lib/looks/model.js';
	import type { Component } from 'svelte';

	let { id }: { id: string } = $props();
	const sheet = inSheet();
	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(id === 'none' ? 'No room' : room?.name);

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
		rules && grouping
			? grouping.groupRoom(
					id,
					input,
					rules,
					look.def.frame,
					look.draws('lights') === 'lit',
					look.def.drawings
				)
			: roomPage(id, input)
	);
	// Such a look draws the room's name in its header; until its grouping has loaded, nothing yet.
	const waiting = $derived(!!rules && !grouping);

	// The console's look draws a room its own way (ConsoleRoom), loaded only then.
	const desk = $derived(!sheet && id !== 'none' && shellOf(look.def) === 'console');
	let ConsoleRoom = $state<Component<{ id: string }> | null>(null);
	$effect(() => {
		if (desk && !ConsoleRoom)
			void import('#lib/console/ConsoleRoom.svelte').then((m) => (ConsoleRoom = m.default));
	});
</script>

{#if desk}
	{#if ConsoleRoom}<ConsoleRoom {id} />{/if}
{:else if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if name === undefined}
	<p class="quiet">This room isn't in the house any more.</p>
{:else}
	<div class="room">
		{#if !sheet}<CustomiseBar page={key} />{/if}
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
