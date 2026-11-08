<!-- A picture on a page (14 §6): uploaded to the app's own server, filling its place or shown whole. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { PICTURE_BUILT_IN } from '#lib/options.js';

	let { card, page, label, options }: KindProps<'picture'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'picture', card.ref, PICTURE_BUILT_IN));
	// Only the app's own pictures: never an address someone typed.
	const src = $derived(
		/^\/ui\/pictures\/[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(String(o.src)) ? String(o.src) : ''
	);
	const caption = $derived(String(o.caption ?? '').trim());
	const fit = $derived(o.fit === 'contain' ? 'contain' : 'cover');
</script>

<figure class="picture" aria-label={label ?? (caption || 'Picture')}>
	{#if src}
		<img {src} alt={caption} style:object-fit={fit} loading="lazy" decoding="async" />
	{:else}
		<p class="quiet">No picture yet. Choose one in its settings.</p>
	{/if}
	{#if caption && src}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
	.picture {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 96px;
		height: 100%;
		margin: 0;
		overflow: hidden;
		border: 1px solid var(--card-line);
		border-radius: var(--feel-card-radius, var(--radius));
		background: var(--surface);
	}
	img {
		flex: 1;
		width: 100%;
		min-height: 0;
		display: block;
	}
	figcaption {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 18px 12px 8px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
		color: #fff;
		font-size: 13px;
		font-weight: 600;
	}
	.quiet {
		margin: auto;
		padding: 12px;
		color: var(--ink-muted);
		text-align: center;
		font-size: 13px;
	}
</style>
