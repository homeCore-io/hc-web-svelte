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
	import { cardFor, kindOf } from '#lib/card.js';
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
	import LitChip from './LitChip.svelte';
	import LitRow from './LitRow.svelte';
	import LitArt from './LitArt.svelte';
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
	import ExtensionSlot from '#lib/components/ExtensionSlot.svelte';
	import { extensions } from '#lib/extensions.svelte.js';
	import { optionValues } from '#lib/drawingOptions.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { isCameraLight } from '#lib/cameraLights.js';
	import { devices } from '#lib/devices.svelte.js';
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
	// A running timer counts down in seconds: keep the clock that fine while it shows.
	$effect(() => {
		if (d.attributes?.state === 'running' && kindOf(d) === 'timer') return clock.hold();
	});
	// A camera's spotlight is its camera's, never drawn as one of the room's lamps.
	const lamp = $derived(
		card.scene || isCameraLight(d, devices.byId) ? null : lampOf(card, view, name)
	);
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
							: ['media_player', 'tv'].includes(view.kind)
								? 'media'
								: null
	);
	const drawing = $derived(family ? look.draws(family) : 'classic');
	const made = $derived(look.def.made.find((m) => m.id === drawing && m.family === family));
	// A plugin's drawing (13 §12.1), while its plugin offers it for this family.
	const plugin = $derived.by(() => {
		if (!drawing.startsWith('plugin:')) return undefined;
		const found = pluginUis.look(drawing);
		return found?.slot.slot === 'look.drawing' &&
			!found.slot.rive &&
			family &&
			found.slot.draws?.includes(family)
			? found
			: undefined;
	});
	let pluginFailed = $state(false);
	// A UI extension's code drawing (13 §12.6), while its extension offers it for this family.
	extensions.ensure();
	const code = $derived(family ? extensions.code(drawing, family) : undefined);
	let codeFailed = $state(false);
	const room = $derived(roomOf(d, rooms.list)?.name ?? '');
	const thing = $derived(
		!made && !plugin && !code
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
	// A light's brightness, sent once a slider is let go (as Lit's light does).
	function setLevel(v: number) {
		if (!lamp || !session.mayUse) return;
		void commands.set(
			d.device_id,
			view.kind,
			v === 0 ? { [lamp.attr]: false } : { brightness_pct: v, [lamp.attr]: true },
			d.attributes
		);
	}
	const open = () => openDevice(d.device_id, here.url);
	// A chip's or row's tint when on: the light's own color where the look allows, else the theme's.
	const ink = $derived(
		lamp && look.def.ownColors && family === 'lights' ? `rgb(${lamp.rgb})` : 'var(--accent)'
	);
	// A command that failed says so in place of the state, as Classic's cards do.
	const note = $derived(commands.notes[d.device_id]);
	// A reading in a chip: its value, the first of its state's words ("44°F").
	const readingWords = $derived(view.stateLine.split(' · ')[0] ?? view.stateLine);
	const power = $derived(
		view.kind === 'outlet' || /\b(heat|heater|plug|valve|pump|charger|fan|ac)\b/i.test(name)
	);
</script>

{#if layout === 'joined' && lamp}
	<!-- A line of a joined card (13 §13.1): a row, whatever the look draws it as elsewhere. -->
	<LitRow
		{name}
		words={note ?? view.stateLine}
		alarm={!!note}
		icon={view.icon}
		on={lamp.on}
		{ink}
		level={family === 'lights' ? lamp.level : null}
		bare
		{flip}
		{setLevel}
		{open}
	/>
{:else if layout === 'joined' && !card.scene}
	<LitWatch id={d.device_id} {view} {name} />
{:else if made && thing}
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
		props={{ thing, options: optionValues(look.def, drawing) }}
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
{:else if code && thing && !codeFailed}
	<ExtensionSlot
		ext={code}
		props={{ thing, options: optionValues(look.def, drawing) }}
		on={{
			act: (x) => {
				if (look.preview) return;
				if (x.do === 'open') openDevice(d.device_id, here.url);
				else if (card.scene) commands.act(d.device_id, 'activate');
				else void flip();
			}
		}}
		onfail={() => (codeFailed = true)}
	/>
{:else if drawing === 'art' && family === 'media'}
	<LitArt device={d} {view} {name} {room} {open}>{@render children()}</LitArt>
{:else if drawing === 'chip' && (lamp || reading)}
	<LitChip
		{name}
		words={note ?? (reading ? readingWords : view.stateLine)}
		icon={view.icon}
		on={lamp?.on ?? false}
		{ink}
		alarm={!!view.alarm || !!note}
		reading={!!reading}
		flip={lamp ? flip : undefined}
		{open}
	/>
{:else if drawing === 'row' && lamp}
	<LitRow
		{name}
		words={note ?? view.stateLine}
		alarm={!!note}
		icon={view.icon}
		on={lamp.on}
		{ink}
		level={family === 'lights' ? lamp.level : null}
		{flip}
		{setLevel}
		{open}
	/>
{:else if drawing === 'band' && reading}
	<LitReading r={reading} band />
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
