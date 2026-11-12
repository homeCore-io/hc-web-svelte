<!--
	A room's photo (photo.ts): the household's picture of the room, cropped to
	cover its header or its tile on Home, with each light spot's glow laid
	over it, bright as its device is. The spots sit on the photo, not the
	box, so they stay on their lights however it's cropped. A photo with no
	light on is drawn dimmer, as a drawing's room is.
-->
<script lang="ts">
	import { sized } from '#lib/pictures.svelte.js';
	import { coverFrame, photoLit, type SpotGlow } from './photo.js';

	let {
		src,
		focus = 4,
		glow,
		size = 'screen',
		shade = true
	}: {
		src: string;
		/** Which part stays in view (`FOCUS`): the middle unless the household chose. */
		focus?: number;
		glow: SpotGlow[];
		/** The library's copy to show: a screen wide, or a tile's. */
		size?: 'screen' | 'tile';
		/** Dim it when no light is on. Home dims its tiles itself. */
		shade?: boolean;
	} = $props();

	let w = $state(0);
	let h = $state(0);
	let img = $state({ w: 0, h: 0 });
	const frame = $derived(coverFrame({ w, h }, img, focus));
</script>

<span
	class="pic"
	aria-hidden="true"
	bind:clientWidth={w}
	bind:clientHeight={h}
	style:--h={`${h}px`}
>
	<span
		class="frame"
		style:left={`${frame.left}px`}
		style:top={`${frame.top}px`}
		style:width={`${frame.width}px`}
		style:height={`${frame.height}px`}
	>
		<img
			src={sized(src, size)}
			alt=""
			onload={(e) => {
				const i = e.currentTarget as HTMLImageElement;
				img = { w: i.naturalWidth, h: i.naturalHeight };
			}}
		/>
		{#if shade}<span class="dark" class:off={!photoLit(glow)}></span>{/if}
		{#each glow as s, i (i)}
			<span
				class="glow"
				style:left={`${s.x}%`}
				style:top={`${s.y}%`}
				style:--k={s.scale}
				style:background={`radial-gradient(circle, ${s.color} 0, transparent 70%)`}
				style:opacity={s.opacity}
			></span>
		{/each}
	</span>
</span>

<style>
	.pic {
		position: absolute;
		inset: 0;
		overflow: hidden;
		line-height: 0;
		background: #0c0d12;
	}
	.frame {
		position: absolute;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.dark {
		position: absolute;
		inset: 0;
		background: rgba(5, 6, 10, 0.2);
		transition: background 0.4s ease;
	}
	.dark.off {
		background: rgba(5, 6, 10, 0.55);
	}
	.glow {
		position: absolute;
		height: calc(var(--h) * 1.1 * var(--k));
		aspect-ratio: 1;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		mix-blend-mode: screen;
		pointer-events: none;
		transition: opacity 0.4s ease;
	}
</style>
