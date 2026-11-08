<!-- A title (14 §6): big words for a page or an area of it, and a line under them. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { TITLE_BUILT_IN } from '#lib/options.js';

	let { card, page, options }: KindProps<'title'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'title', card.ref, TITLE_BUILT_IN));
	const text = $derived(String(o.text ?? '').trim() || 'Title');
	const sub = $derived(String(o.sub ?? '').trim());
</script>

<header class="title span-all">
	<h2>{text}</h2>
	{#if sub}<p>{sub}</p>{/if}
</header>

<style>
	/* Its words grow with its place (14 §7). */
	.title {
		container-type: size;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 2px;
		min-height: 48px;
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: clamp(22px, 60cqh, 56px);
		line-height: 1.1;
		font-weight: 750;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	p {
		margin: 0;
		color: var(--ink-muted);
		font-size: 14px;
	}
	.title:has(p) h2 {
		font-size: clamp(20px, 40cqh, 48px);
	}
</style>
