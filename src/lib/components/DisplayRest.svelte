<!--
	A display at rest (design 15): a picture frame from an album of the
	household's, a clock, or dark, over everything until a touch wakes it. A
	video plays once through, silent, then the frame moves on (P6). Only
	everyone's pictures: a display sees no one's own.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Rest } from '#lib/display.js';
	import { clock } from '#lib/clock.svelte.js';
	import { pictures, sized, type Picture } from '#lib/pictures.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { degrees, outsideTemperature } from '#lib/roomBox.js';

	let { rest, wake }: { rest: Required<Rest>; wake: () => void } = $props();

	onMount(() => {
		if (rest.show === 'frame') void pictures.load();
	});

	const frame = $derived(
		pictures.items.filter((p) => p.shared && (rest.album === '' || p.albums.includes(rest.album)))
	);
	let at = $state(0);
	const shown = $derived<Picture | undefined>(frame.length ? frame[at % frame.length] : undefined);
	const next = () => (at = (at + 1) % Math.max(1, frame.length));

	// A picture shows its while; a video, until it ends.
	$effect(() => {
		if (rest.show !== 'frame' || !shown || shown.kind === 'video') return;
		const t = setTimeout(next, Math.max(5, rest.every) * 1000);
		return () => clearTimeout(t);
	});

	const time = $derived(
		new Date(clock.now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
	);
	const day = $derived(
		new Date(clock.now).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		})
	);
	// Under the day, when the house can tell: "Sunday, November 8 · 56° outside".
	const outside = $derived(degrees(outsideTemperature(devices.byId, 'auto', clock.now)));
	const line = $derived(outside ? `${day} · ${outside} outside` : day);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="rest"
	class:dark={rest.show === 'dark'}
	role="button"
	tabindex="-1"
	aria-label="Wake the display"
	onpointerdown={(e) => {
		e.preventDefault();
		e.stopPropagation();
		wake();
	}}
>
	{#if rest.show === 'frame' && shown}
		{#key shown.id}
			{#if shown.kind === 'video'}
				<video
					src={shown.url}
					poster={sized(shown.url, 'poster')}
					autoplay
					muted
					playsinline
					onended={next}
					onerror={next}
				></video>
			{:else}
				<img src={sized(shown.url, 'screen')} alt="" />
			{/if}
		{/key}
		<div class="shade"></div>
		{#if rest.time}
			<div class="time">
				<span class="t">{time}</span>
				<span class="d">{line}</span>
			</div>
		{/if}
		{#if frame.length > 1}
			<div class="dots" aria-hidden="true">
				{#each frame as p, i (p.id)}<span class:on={i === at % frame.length}></span>{/each}
			</div>
		{/if}
	{:else if rest.show !== 'dark'}
		<div class="clock">
			<span class="t">{time}</span>
			<span class="d">{line}</span>
		</div>
	{/if}
</div>

<style>
	.rest {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: #05070a;
		color: #fff;
		overflow: hidden;
		cursor: pointer;
	}
	img,
	video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: fade 1.2s ease;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(5, 7, 10, 0.45),
			transparent 35%,
			transparent 70%,
			rgba(5, 7, 10, 0.5)
		);
	}
	.time {
		position: absolute;
		left: 4vw;
		top: 4vh;
		display: flex;
		flex-direction: column;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
	}
	.t {
		font-size: clamp(48px, 9vw, 140px);
		font-weight: 300;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.d {
		font-size: clamp(15px, 1.8vw, 26px);
		color: rgba(255, 255, 255, 0.85);
	}
	.clock {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
	.clock .d {
		color: rgba(255, 255, 255, 0.6);
	}
	.dots {
		position: absolute;
		right: 4vw;
		bottom: 4vh;
		display: flex;
		gap: 6px;
	}
	.dots span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.4);
	}
	.dots span.on {
		background: #fff;
	}
	.dark {
		background: #000;
	}
</style>
