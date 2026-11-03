<!--
	One card's settings on a page (G2, G13): its kind's sheet, in the layer
	being changed — the person's in Customise, the household's in Edit — with
	a preview of the card. Plugin cards keep their own (`CardSettings`).

	A device's sheet is built for the device (G23–G26): its size is the page's
	`form` change, the rest its `config`; "Same for every … card" turns the
	sheet to the default for its type, and back.
-->
<script lang="ts">
	import { cardFor, kindOf as typeOf } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { deviceDescriptor, typeWords } from '#lib/deviceOptions.js';
	import { kindOf } from '#lib/kinds.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { Form } from '#lib/layers.js';
	import { DEVICE_BUILT_IN, deviceKind, type Options } from '#lib/options.js';
	import type { Card } from '#lib/page.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { roomBox } from '#lib/roomBox.js';
	import { view } from '#lib/view.svelte.js';
	import KindSettings from './KindSettings.svelte';
	import KindView from './KindView.svelte';
	import RoomBox from './RoomBox.svelte';
	import SummaryKind from './kinds/SummaryKind.svelte';

	let {
		page,
		card,
		name,
		form,
		close
	}: { page: string; card: Card; name: string; form?: Form; close: () => void } = $props();

	const kind = $derived(kindOf(card));
	const who = $derived(
		view.mode(page) === 'edit'
			? 'For everyone — unless they changed their own.'
			: 'Only you see this, on top of the house’s Home.'
	);

	// A device: its own sheet, or — "Same for every … card" — its type's.
	const device = $derived(card.kind === 'device' ? card.device : undefined);
	let every = $state(false);
	const forms = $derived(kind.forms(card));
	const pluginDrawn = $derived.by(() => {
		if (!device?.plugin_id) return false;
		const found = pluginUis.find(device.plugin_id, 'device.card', device.device_type);
		const f = found?.slot.forms ?? [];
		return !!found && (f.length === 0 || f.includes(form ?? 'standard'));
	});
	// What could open a door: a scene a hub's button runs, or a switch (a relay).
	const openers = $derived(
		Object.values(devices.byId)
			.filter((x) => x.device_id !== device?.device_id && ['scene', 'switch'].includes(typeOf(x)))
			.map((x) => ({ value: x.device_id, label: displayName(x) }))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
	const descriptor = $derived(
		device
			? deviceDescriptor(
					device,
					every
						? { everyCard: true }
						: { forms: { all: forms, now: form ?? 'standard' }, pluginDrawn, openers }
				)
			: kind.options?.(card)
	);
	// Read once per sheet: it edits from what was there when it opened.
	const layer = $derived(
		device
			? every
				? kindOptions.kind(page, deviceKind(device), DEVICE_BUILT_IN)
				: kindOptions.card(page, deviceKind(device), card.ref, DEVICE_BUILT_IN)
			: kindOptions.card(page, card.kind, card.ref, kind.defaults)
	);
	function save(next: Options) {
		const { size, ...rest } = next;
		if (typeof size === 'string' && size !== form)
			view.change(page, { op: 'form', ref: card.ref, form: size as Form });
		layer.save(rest);
	}
	const title = $derived(
		card.kind === 'room'
			? `${name} box`
			: device && every
				? `Every ${typeWords(device)} card`
				: name
	);
</script>

{#if descriptor}
	{#key every}
		<KindSettings
			{title}
			{who}
			{descriptor}
			mine={layer.mine}
			without={layer.without}
			{save}
			close={() => (every ? (every = false) : close())}
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
				{:else if device}
					<div class="device">
						<KindView
							{card}
							{page}
							cardTools={false}
							form={typeof o.size === 'string' ? (o.size as Form) : form}
							label={every ? undefined : name}
							options={o}
						/>
					</div>
				{:else}
					<KindView {card} {page} cardTools={false} options={o} />
				{/if}
			{/snippet}
			{#if device && !pluginDrawn}
				<button type="button" class="every" onclick={() => (every = !every)}>
					{every ? `Back to ${name}` : `Same for every ${typeWords(device)} card…`}
				</button>
			{/if}
		</KindSettings>
	{/key}
{/if}

<style>
	.room {
		height: 150px;
		display: grid;
	}
	.device {
		display: grid;
		max-width: 360px;
	}
	.every {
		align-self: flex-start;
		min-height: 44px;
		padding: 0 4px;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
	}
</style>
