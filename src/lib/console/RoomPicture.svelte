<!--
	A room's drawing, lit as its spots say (pictures.ts): on its tile on
	Home, filling the tile, and behind a room's header, against its right
	end. A header is wide and short, so there the drawing keeps most of its
	height and fades in from the left, where the room's name is.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import type { Glow, PictureId } from './pictures.js';
	import Family from './drawings/Family.svelte';
	import Living from './drawings/Living.svelte';
	import Office from './drawings/Office.svelte';
	import Garage from './drawings/Garage.svelte';
	import Kitchen from './drawings/Kitchen.svelte';
	import Bedroom from './drawings/Bedroom.svelte';
	import Bathroom from './drawings/Bathroom.svelte';
	import Hallway from './drawings/Hallway.svelte';
	import Laundry from './drawings/Laundry.svelte';
	import Dining from './drawings/Dining.svelte';
	import Attic from './drawings/Attic.svelte';
	import Equipment from './drawings/Equipment.svelte';
	import Outside from './drawings/Outside.svelte';
	import Plain from './drawings/Plain.svelte';

	let {
		picture,
		g,
		side = false
	}: {
		picture: PictureId;
		g: Glow;
		/** Against the right end, for a header. */
		side?: boolean;
	} = $props();

	const DRAWINGS: Record<PictureId, Component<{ g: Glow }>> = {
		family: Family,
		living: Living,
		office: Office,
		garage: Garage,
		kitchen: Kitchen,
		bedroom: Bedroom,
		bathroom: Bathroom,
		hallway: Hallway,
		laundry: Laundry,
		dining: Dining,
		attic: Attic,
		equipment: Equipment,
		outside: Outside,
		plain: Plain
	};
	const Drawing = $derived(DRAWINGS[picture]);
</script>

<span class="pic" class:side aria-hidden="true"><Drawing {g} /></span>

<style>
	.pic {
		position: absolute;
		inset: 0;
		line-height: 0;
		overflow: hidden;
	}
	.pic :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.side :global(svg) {
		position: absolute;
		top: 0;
		right: 0;
		width: auto;
		min-width: 60%;
		max-width: 100%;
		aspect-ratio: 4 / 1;
		mask-image: linear-gradient(90deg, transparent, #000 25%);
	}
	.pic :global(ellipse),
	.pic :global(rect),
	.pic :global(path),
	.pic :global(circle) {
		transition:
			opacity 0.4s ease,
			fill 0.4s ease;
	}
</style>
