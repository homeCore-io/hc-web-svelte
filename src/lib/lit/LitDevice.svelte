<!--
	One device in Lit's drawings (13 §6), wherever a page draws it: a light you
	drag across to dim, a switch's rocker, a scene's swatch (round in a row of
	swatches, a pill elsewhere), a door or lock as what it is, a reading with
	its day, and, in a Watching box, a sensor as one line. Each family only
	where the look draws it this way; loaded only for a look that draws some.
	Anything else, or anything Lit can't draw just now, is today's card.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cardFor } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import type { Card, Layout } from '#lib/page.js';
	import type { Family } from '#lib/looks/model.js';
	import LitDoor from './LitDoor.svelte';
	import LitLamp from './LitLamp.svelte';
	import LitReading from './LitReading.svelte';
	import LitScene from './LitScene.svelte';
	import LitSwitch from './LitSwitch.svelte';
	import LitWatch from './LitWatch.svelte';
	import { lookHere } from '#lib/look.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { sceneThing, thingOf } from '#lib/looks/thing.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import { page as here } from '$app/state';
	import MadeDrawing from '#lib/components/looks/MadeDrawing.svelte';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { deviceScene, isDoorKind, isWatchKind, lampOf, readingOf } from './room.js';

	const look = lookHere();

	let {
		card,
		label,
		options,
		layout,
		children
	}: {
		card: Card & { kind: 'device' };
		label?: string;
		options?: Record<string, unknown>;
		/** How its section lays cards out: a row of swatches, a Watching box. */
		layout?: Layout;
		/** Today's card, for anything Lit doesn't draw, or can't just now. */
		children: Snippet;
	} = $props();

	const d = $derived(card.device);
	const view = $derived(withPending(cardFor(d, clock.now, options), commands.pending[d.device_id]));
	const name = $derived(label ?? view.name);
	const lamp = $derived(card.scene ? null : lampOf(card, view, name));
	const reading = $derived(card.scene ? null : readingOf(card, view, name));
	// Which family it is, and how the look draws that family (13 §6): Lit's
	// way, a drawing made in the editor (§6.4), or today's card.
	const family = $derived<Family | null>(
		card.scene
			? 'scenes'
			: lamp
				? lamp.level !== null
					? 'lights'
					: 'switches'
				: isDoorKind(view.kind)
					? 'doors'
					: reading
						? 'readings'
						: layout === 'lines'
							? 'watching'
							: null
	);
	const drawing = $derived(family ? look.draws(family) : 'classic');
	const made = $derived(look.def.made.find((m) => m.id === drawing && m.family === family));
	// A plugin's drawing (13 §12.1), while its plugin offers it for this family.
	const plugin = $derived.by(() => {
		if (!drawing.startsWith('plugin:')) return undefined;
		const found = pluginUis.look(drawing);
		return found?.slot.slot === 'look.drawing' && family && found.slot.draws?.includes(family)
			? found
			: undefined;
	});
	let pluginFailed = $state(false);
	const room = $derived(roomOf(d, rooms.list)?.name ?? '');
	const thing = $derived(
		!made && !plugin
			? null
			: card.scene
				? sceneThing(name, deviceScene(card, name).colours, !!deviceScene(card, name).active, room)
				: thingOf(d, view, name, room)
	);
	// A made drawing's tap: switch it, asking first where the house says to; else open it.
	async function flip() {
		const sw = view.control?.kind === 'switch' ? view.control : null;
		if (!sw || !session.mayUse) return openDevice(d.device_id, here.url);
		if (!(await goAhead(d.device_id, view.kind, `Turn ${name} ${sw.on ? 'off' : 'on'}?`))) return;
		void commands.set(d.device_id, view.kind, { [sw.attr]: !sw.on }, d.attributes);
	}
	const power = $derived(
		view.kind === 'outlet' || /\b(heat|heater|plug|valve|pump|charger|fan|ac)\b/i.test(name)
	);
</script>

{#if made && thing}
	<MadeDrawing
		{made}
		{thing}
		ownColors={look.def.ownColors}
		words={view.stateLine}
		icon={view.icon}
		available={view.available}
		act={card.scene ? () => commands.act(d.device_id, 'activate') : flip}
		open={() => openDevice(d.device_id, here.url)}
		preview={look.preview}>{@render children()}</MadeDrawing
	>
{:else if plugin && thing && !pluginFailed}
	<PluginSlot
		pluginId={plugin.pluginId}
		ui={plugin.ui}
		slot={plugin.slot}
		deviceId={d.device_id}
		props={{ thing }}
		on={{
			act: (x) => {
				if (look.preview) return;
				if (x.do === 'open') openDevice(d.device_id, here.url);
				else if (card.scene) commands.act(d.device_id, 'activate');
				else void flip();
			}
		}}
		onfail={() => (pluginFailed = true)}
	/>
{:else if drawing !== 'lit'}
	{@render children()}
{:else if card.scene}
	<LitScene
		s={deviceScene(card, name)}
		form={layout === 'swatches' ? 'disc' : 'chip'}
		run={() => commands.act(d.device_id, 'activate')}
	/>
{:else if family === 'lights' && lamp}
	<LitLamp {lamp} />
{:else if family === 'switches' && lamp}
	<LitSwitch l={lamp} {power} />
{:else if family === 'doors'}
	<LitDoor device={d} {view} {name} {options} />
{:else if family === 'readings' && reading}
	<LitReading r={reading} />
{:else if family === 'watching'}
	<LitWatch id={d.device_id} {view} {name} />
{:else}
	{@render children()}
{/if}
