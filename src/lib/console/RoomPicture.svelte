<!--
	A room's drawing, lit as its spots say (pictures.ts): on its tile on
	Home and behind a room's header, filling either one across, cut to fit
	top and bottom. On a header the band over it keeps the words readable.
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

	let { picture, g }: { picture: PictureId; g: Glow } = $props();

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

<span class="pic" aria-hidden="true"><Drawing {g} /></span>

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
	.pic :global(ellipse),
	.pic :global(rect),
	.pic :global(path),
	.pic :global(circle) {
		transition:
			opacity 0.4s ease,
			fill 0.4s ease;
	}
</style>
