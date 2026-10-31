<!--
	One card's settings on a page (G2, G13): its kind's sheet, in the layer
	being changed — the person's in Customise, the household's in Edit — with
	a preview of the card. Plugin cards keep their own (`CardSettings`).
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { kindOf } from '#lib/kinds.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { Card } from '#lib/page.js';
	import { roomBox } from '#lib/roomBox.js';
	import { view } from '#lib/view.svelte.js';
	import KindSettings from './KindSettings.svelte';
	import RoomBox from './RoomBox.svelte';
	import SummaryKind from './kinds/SummaryKind.svelte';

	let { page, card, name, close }: { page: string; card: Card; name: string; close: () => void } =
		$props();

	const kind = $derived(kindOf(card));
	// Read once: the sheet edits from what was there when it opened.
	const layer = $derived(kindOptions.card(page, card.kind, card.ref, kind.defaults));
	const who = $derived(
		view.mode(page) === 'edit'
			? 'For everyone — unless they changed their own.'
			: 'Only you see this, on top of the house’s Home.'
	);
</script>

{#if kind.options}
	<KindSettings
		title={card.kind === 'room' ? `${name} box` : name}
		{who}
		descriptor={kind.options(card)}
		mine={layer.mine}
		without={layer.without}
		save={layer.save}
		{close}
	>
		{#snippet preview(o)}
			{#if card.kind === 'room'}
				<div class="room">
					<RoomBox
						{name}
						box={roomBox(
							card.devices,
							card.devices.map((d) => cardFor(d, clock.now)),
							devices.byId,
							o
						)}
						devices={[]}
					/>
				</div>
			{:else if card.kind === 'summary'}
				<SummaryKind {card} {page} cardTools={false} options={o} />
			{/if}
		{/snippet}
	</KindSettings>
{/if}

<style>
	.room {
		height: 150px;
		display: grid;
	}
</style>
