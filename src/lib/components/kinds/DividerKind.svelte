<!-- A line between areas of a page (14 §6), with words in it if it has some. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { DIVIDER_BUILT_IN } from '#lib/options.js';

	let { card, page, options }: KindProps<'divider'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'divider', card.ref, DIVIDER_BUILT_IN));
	const text = $derived(String(o.text ?? '').trim());
</script>

<div class="divider span-all" role="separator" aria-label={text || undefined}>
	{#if text}<span>{text}</span>{/if}
</div>

<style>
	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 24px;
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line);
	}
	.divider:not(:has(span))::after {
		display: none;
	}
	span {
		flex: none;
	}
</style>
