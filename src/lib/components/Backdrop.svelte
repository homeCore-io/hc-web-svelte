<!--
	A picture behind words (design 15): a room's photo behind its header or its
	box, at the part chosen to stay in view and darkened as chosen so the words
	read. A video plays silent and looping where `play` says (P6), and shows
	its first frame elsewhere. It sits under its parent's content, which must
	be positioned and isolated (`isolation: isolate`), so this sits under it all.
-->
<script lang="ts">
	import type { Photo } from '#lib/layers.js';
	import { FOCUS, isVideo, sized } from '#lib/pictures.svelte.js';

	let {
		photo,
		play = false,
		size = 'screen',
		shade = 'side'
	}: {
		photo: Photo & { src: string };
		play?: boolean;
		/** A small place takes the tile. */
		size?: 'tile' | 'screen';
		/** Darker on the words' side (a header), or evenly (a box with words top and bottom). */
		shade?: 'side' | 'all';
	} = $props();

	const video = $derived(isVideo(photo.src));
	const pos = $derived(FOCUS[photo.focus ?? 4] ?? FOCUS[4]);
	const dim = $derived(Math.max(0, Math.min(70, photo.dim ?? 35)) / 100);
</script>

<div
	class="backdrop"
	class:all={shade === 'all'}
	aria-hidden="true"
	style:--pos={pos}
	style:--dim={dim}
>
	{#if video && play}
		<video
			src={photo.src}
			poster={sized(photo.src, 'poster')}
			autoplay
			muted
			loop
			playsinline
			disablepictureinpicture
		></video>
	{:else}
		<img
			src={sized(photo.src, video ? (size === 'tile' ? 'tile' : 'poster') : size)}
			alt=""
			decoding="async"
		/>
	{/if}
</div>

<style>
	.backdrop {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		border-radius: inherit;
		pointer-events: none;
	}
	img,
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--pos);
		display: block;
	}
	.backdrop::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			rgba(10, 12, 16, var(--dim)),
			rgba(10, 12, 16, calc(var(--dim) / 2.5))
		);
	}
	.all::after {
		background: rgba(10, 12, 16, calc(0.15 + var(--dim)));
	}
</style>
