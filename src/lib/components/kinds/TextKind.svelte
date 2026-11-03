<!-- A note on a page (G-c): the household's, or a person's own. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { TEXT_BUILT_IN } from '#lib/options.js';

	let { card, page, label, options }: KindProps<'text'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'text', card.ref, TEXT_BUILT_IN));
	const text = $derived(String(o.text ?? '').trim());
</script>

<article class="piece" aria-label={label ?? 'Note'}>
	{#if label}<h3>{label}</h3>{/if}
	{#if text}
		<p>{text}</p>
	{:else}
		<p class="quiet">An empty note. Its words are in its settings.</p>
	{/if}
</article>

<style>
	.piece {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: 1.4;
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
