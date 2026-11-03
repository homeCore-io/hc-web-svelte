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
	import { look } from '#lib/look.svelte.js';
	import { deviceScene, isDoorKind, isWatchKind, lampOf, readingOf } from './room.js';

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
	/** Whether the look draws this family the Lit way (13 §6); else today's card. */
	const own = (f: Family) => look.draws(f) === 'lit';
	const power = $derived(
		view.kind === 'outlet' || /\b(heat|heater|plug|valve|pump|charger|fan|ac)\b/i.test(name)
	);
</script>

{#if card.scene && own('scenes')}
	<LitScene
		s={deviceScene(card, name)}
		form={layout === 'swatches' ? 'disc' : 'chip'}
		run={() => commands.act(d.device_id, 'activate')}
	/>
{:else if card.scene}
	{@render children()}
{:else if lamp && lamp.level !== null && own('lights')}
	<LitLamp {lamp} />
{:else if lamp && lamp.level === null && own('switches')}
	<LitSwitch l={lamp} {power} />
{:else if isDoorKind(view.kind) && own('doors')}
	<LitDoor device={d} {view} {name} {options} />
{:else if reading && own('readings')}
	<LitReading r={reading} />
{:else if layout === 'lines' && own('watching')}
	<LitWatch id={d.device_id} {view} {name} />
{:else}
	{@render children()}
{/if}
