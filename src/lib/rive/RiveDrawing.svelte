<!--
	A drawing made in Rive (13 §6): its file drawn on a canvas, its view model
	filled from the thing (rive/values.ts). It never commands anything; taps go
	to whatever holds it.

	The look's motion decides how it moves (rive/player.ts).

	Until the file is drawn, and if it can't be, `children` is shown instead.
-->
<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { Motion } from '#lib/looks/model.js';
	import type { RiveValues } from './values.js';
	import type { RivePlayer } from './player.js';

	let {
		src,
		artboard,
		stateMachine,
		values,
		motion,
		label,
		width,
		height,
		children
	}: {
		src: string;
		artboard?: string;
		stateMachine?: string;
		values: RiveValues;
		motion: Motion;
		label: string;
		/** Its largest size; it shrinks to fit narrower. */
		width: number;
		height: number;
		children?: Snippet;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	let drawn = $state(false);
	let failed = $state(false);
	let player = $state<RivePlayer>();

	// Made again only for another file; values and motion are told to it.
	$effect(() => {
		const el = canvas;
		if (!el) return;
		let gone = false;
		let made: RivePlayer | undefined;
		const opts = { src, artboard, stateMachine, width, height };
		// What it starts from, read now: after an await the component may be gone.
		const first = untrack(() => ({ values: $state.snapshot(values) as RiveValues, motion }));
		void (async () => {
			try {
				const { play } = await import('./player.js');
				if (gone) return;
				made = await play(el, { ...opts, ...first });
				if (gone) return made.destroy();
				player = made;
				drawn = true;
			} catch (e) {
				console.warn('[rive]', src, e);
				if (!gone) failed = true;
			}
		})();
		return () => {
			gone = true;
			made?.destroy();
			player = undefined;
		};
	});

	// Each change of the thing's values, or of the motion, is played (or settled) once.
	$effect(() => {
		const p = player;
		if (!p) return;
		p.motion(motion);
		p.set($state.snapshot(values) as RiveValues);
	});
</script>

<div
	class="rive"
	role="img"
	aria-label={label}
	style:max-width={`${width}px`}
	style:aspect-ratio={`${width} / ${height}`}
>
	{#if !drawn && children}<div class="instead">{@render children()}</div>{/if}
	{#if !failed}
		<canvas bind:this={canvas} class:hidden={!drawn} aria-hidden="true"></canvas>
	{/if}
</div>

<style>
	.rive {
		position: relative;
		width: 100%;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.hidden {
		visibility: hidden;
	}
	.instead {
		position: absolute;
		inset: 0;
	}
</style>
