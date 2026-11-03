<!--
	One device card in the Lit look (12), wherever a page draws one (Home, a
	page someone made): a light you drag across to dim, a switch's rocker, a
	scene's swatch. Loaded only in Lit; DeviceKind draws everything else.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cardFor } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import type { Card } from '#lib/page.js';
	import LitLamp from './LitLamp.svelte';
	import LitScene from './LitScene.svelte';
	import LitSwitch from './LitSwitch.svelte';
	import { deviceScene, lampOf } from './room.js';

	let {
		card,
		label,
		options,
		children
	}: {
		card: Card & { kind: 'device' };
		label?: string;
		options?: Record<string, unknown>;
		/** Today's card, for a device Lit can't draw just now (one that isn't answering). */
		children: Snippet;
	} = $props();

	const d = $derived(card.device);
	const view = $derived(withPending(cardFor(d, clock.now, options), commands.pending[d.device_id]));
	const name = $derived(label ?? view.name);
	const lamp = $derived(card.scene ? null : lampOf(card, view, name));
	const power = $derived(
		view.kind === 'outlet' || /\b(heat|heater|plug|valve|pump|charger|fan|ac)\b/i.test(name)
	);
</script>

{#if card.scene}
	<LitScene s={deviceScene(card, name)} run={() => commands.act(d.device_id, 'activate')} />
{:else if lamp && lamp.level !== null}
	<LitLamp {lamp} />
{:else if lamp}
	<LitSwitch l={lamp} {power} />
{:else}
	{@render children()}
{/if}
