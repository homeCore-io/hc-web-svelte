<!--
	A person: their picture from the library (design 15), or their initial.
-->
<script lang="ts">
	import { isLibrary, isVideo, sized } from '#lib/pictures.svelte.js';

	let { name, photo, size = 22 }: { name: string; photo?: unknown; size?: number } = $props();
	const initial = $derived((name || '?').slice(0, 1).toUpperCase());
	const src = $derived(
		isLibrary(photo) ? sized(photo, isVideo(photo) ? 'poster' : size > 120 ? 'screen' : 'tile') : ''
	);
</script>

<span class="avatar" aria-hidden="true" style:--size={`${size}px`}>
	{#if src}<img {src} alt="" />{:else}{initial}{/if}
</span>

<style>
	.avatar {
		width: var(--size);
		height: var(--size);
		flex: none;
		border-radius: 50%;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--ink);
		font-size: calc(var(--size) / 2);
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
