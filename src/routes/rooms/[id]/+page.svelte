<!--
	A generated room page (N4): the room's devices as cards — things to use,
	its scenes, its readings, then infrastructure (C6) — and what the household
	added from elsewhere. `/rooms/none` holds the devices that are in no room.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { added, cardRef } from '#lib/layers.js';
	import { roomPage } from '#lib/page.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import PageView from '#lib/components/PageView.svelte';

	const id = $derived(page.params.id ?? '');
	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(id === 'none' ? 'Not in a room' : room?.name);

	$effect(() => heading.show(name ?? null));

	const key = $derived(`room:${id}`);
	const doc = $derived(
		roomPage(id, {
			devices: devices.byId,
			rooms: rooms.list,
			// Cards the household added from elsewhere in the house (M2 `add`).
			added: added(view.changes(key)),
			pluginCard: (r) => {
				const c = cardRef(r);
				const found = c ? pluginUis.card(c.pluginId, c.element) : undefined;
				return found
					? { label: found.slot.label ?? 'A plugin’s card', forms: found.slot.forms }
					: undefined;
			},
			now: clock.now
		})
	);
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
		<PageView page={doc} />
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
