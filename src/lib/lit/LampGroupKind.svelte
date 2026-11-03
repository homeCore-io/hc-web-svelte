<!--
	Lights that belong together, one card (13 §6.3): a dot for each, and a
	switch for them all. Its lights are the house's, live.
-->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import { cardFor } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { ref } from '#lib/layers.js';
	import LitLamp from './LitLamp.svelte';
	import { lampOf, type Lamp } from './room.js';

	let { card, label }: KindProps<'lampgroup'> = $props();

	const members = $derived(
		card.devices.flatMap((d0): Lamp[] => {
			const d = devices.byId[d0.device_id] ?? d0;
			const v = withPending(cardFor(d, clock.now), commands.pending[d.device_id]);
			const l = lampOf(
				{ ref: ref.device(d.device_id), kind: 'device', device: d, scene: false },
				v,
				v.name
			);
			return l ? [l] : [];
		})
	);
</script>

{#if members.length}<LitLamp lamp={{ name: label ?? card.name, members }} />{/if}
