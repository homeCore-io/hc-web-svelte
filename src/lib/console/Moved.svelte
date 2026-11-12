<!--
	"moved here": a device the household put on this tab of its room
	(room.ts's `TabChoices`), under its name in a row or beside its "⋯"
	(Place). Only in a room, where the picker is.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { household } from '#lib/household.svelte.js';
	import { placer } from './placer.svelte.js';
	import { tabChoicesOf } from './room.js';

	let { d }: { d: CoreDevice } = $props();

	const inRoom = placer() !== undefined;
	const moved = $derived(tabChoicesOf(household.doc.console?.tabs)[d.device_id] !== undefined);
</script>

{#if inRoom && moved}<span class="moved" title="The household put it on this tab">moved here</span
	>{/if}

<style>
	.moved {
		display: block;
		width: max-content;
		margin-top: 2px;
		font-size: 9.5px;
		font-weight: 700;
		line-height: 1.4;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		padding: 1px 5px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: color-mix(in srgb, var(--accent) 70%, var(--ink));
	}
</style>
