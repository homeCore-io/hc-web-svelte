<!--
	A camera as a snapshot (the boards' rail, grid and roll): its newest
	frame (stills.svelte.ts), refreshed while it's on screen, else the still
	the plugin took last; its name, how old the picture is once it's stale,
	what it saw lately, and a live dot when it's the one playing large.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.js';
	import { fileUrl, type Cam } from './cameras.js';
	import { ageWord, stills } from './stills.svelte.js';

	let {
		cam,
		on = false,
		live = false,
		badge,
		small = false,
		fill = false,
		onpick
	}: {
		cam: Cam;
		/** The one picked. */
		on?: boolean;
		/** Playing large, live, elsewhere on the page. */
		live?: boolean;
		/** What it saw lately: "Person 4m". */
		badge?: string;
		/** Two across: smaller words, no age. */
		small?: boolean;
		/** Fills its cell (the grid), whatever its shape. */
		fill?: boolean;
		onpick: () => void;
	} = $props();

	let box = $state<HTMLElement>();
	let seen = $state(false);
	$effect(() => {
		if (!box) return;
		const io = new IntersectionObserver((es) => (seen = !!es[es.length - 1]?.isIntersecting));
		io.observe(box);
		return () => io.disconnect();
	});
	// Asked for only while on screen and not playing large already.
	$effect(() => {
		const s = cam.stream;
		if (!s || !seen || live) return;
		return stills.use(s);
	});

	const shot = $derived(cam.stream ? stills.shots[cam.stream] : undefined);
	const still = $derived(cam.snapshot ? fileUrl(cam.device.plugin_id, cam.snapshot) : undefined);
	const src = $derived(shot?.url ?? still);
	const at = $derived(shot?.at ?? (cam.snapshotAt ? Date.parse(cam.snapshotAt) : undefined));
	const age = $derived(live ? 'live' : src ? ageWord(at, clock.now) : 'no image');
	const stale = $derived(!live && age !== '');
</script>

<button
	type="button"
	class="thumb"
	class:on
	class:small
	class:fill
	class:stale
	aria-label={cam.name}
	aria-pressed={on}
	bind:this={box}
	onclick={onpick}
>
	{#if src}<img {src} alt="" />{:else}<span class="none">No picture yet</span>{/if}
	{#if !cam.device.available}<span class="off">Offline</span>{/if}
	{#if badge}<span class="ev">{badge}</span>{/if}
	{#if live}<span class="lv" aria-hidden="true"></span>{/if}
	<span class="tl">{cam.name}</span>
	{#if age && !small}<span class="age">{age}</span>{/if}
</button>

<style>
	.thumb {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		padding: 0;
		border: 0;
		border-radius: 12px;
		overflow: hidden;
		background: #05060a;
		cursor: pointer;
		text-align: left;
		color: #fff;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.thumb.fill {
		height: 100%;
		aspect-ratio: auto;
	}
	.thumb.small {
		border-radius: 9px;
	}
	.thumb.on {
		box-shadow: 0 0 0 2px #ffc46b;
	}
	.thumb:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: opacity 0.2s;
	}
	.stale img {
		opacity: 0.45;
	}
	.tl {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 7px;
		font-size: 12px;
		font-weight: 700;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.small .tl {
		left: 6px;
		bottom: 5px;
		font-size: 10.5px;
	}
	.age {
		position: absolute;
		right: 8px;
		top: 8px;
		font: 500 10.5px var(--font-num);
		color: #ffd9a0;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
	}
	.ev {
		position: absolute;
		left: 8px;
		top: 7px;
		padding: 2px 7px;
		border-radius: 999px;
		background: rgba(255, 196, 107, 0.92);
		color: #1a0f05;
		font-size: 10.5px;
		font-weight: 700;
	}
	.small .ev {
		left: 5px;
		top: 5px;
		padding: 1px 5px;
		font-size: 9.5px;
	}
	.lv {
		position: absolute;
		right: 8px;
		top: 9px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff4d4d;
		box-shadow: 0 0 10px #ff4d4d;
	}
	.none {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 11px;
		color: #7d8594;
	}
	.off {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(5, 6, 10, 0.6);
		font-size: 12px;
		font-weight: 600;
		color: #ffb3a8;
	}
</style>
