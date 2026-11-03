<!--
	How a UI extension looks, before or after it's installed: its preview, a
	picture or a short silent video. A video plays on a loop, unless the
	device asks for less motion or it's a small one in a list: then it shows
	its first frame, and plays when asked.
-->
<script lang="ts">
	let {
		src,
		name,
		label,
		small = false
	}: {
		src: string;
		/** The preview's own file name, which says whether it's a video. */
		name: string;
		label: string;
		small?: boolean;
	} = $props();

	const video = $derived(/\.(mp4|webm)$/i.test(name));
	const still = $derived(
		small ||
			(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
	);
	let failed = $state(false);
	// The first time, the server fetches and checks it before it arrives.
	let ready = $state(false);
</script>

{#if !failed}
	<figure class="preview" class:small class:ready>
		{#if !ready && !small}<span class="wait" aria-hidden="true">Loading…</span>{/if}
		{#if video}
			<video
				{src}
				muted
				loop
				playsinline
				preload={still ? 'metadata' : 'auto'}
				autoplay={!still}
				controls={still && !small}
				aria-label={`How ${label} looks`}
				onerror={() => (failed = true)}
				onloadedmetadata={() => (ready = true)}
				onloadeddata={() => (ready = true)}
			></video>
		{:else}
			<img
				{src}
				alt={`How ${label} looks`}
				loading="lazy"
				onerror={() => (failed = true)}
				onload={() => (ready = true)}
			/>
		{/if}
	</figure>
{/if}

<style>
	.preview {
		margin: 0;
		align-self: flex-start;
		width: 100%;
		max-width: 240px;
		aspect-ratio: 1;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface-2);
		border: 1px solid var(--card-line);
	}
	.preview.small {
		width: 48px;
		height: 48px;
		flex: none;
		border-radius: 10px;
	}
	.preview {
		position: relative;
	}
	.wait {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 13px;
		color: var(--ink-muted);
	}
	video,
	img {
		display: block;
		opacity: 0;
		transition: opacity 0.3s;
	}
	.ready video,
	.ready img,
	.small video,
	.small img {
		opacity: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		video,
		img {
			transition: none;
		}
	}
	video,
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
