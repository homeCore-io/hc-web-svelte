<!-- A way to another page (14 §6): a room, a page someone made, Home, Scenes, Alerts. -->
<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { linkTo } from '#lib/links.svelte.js';
	import { LINK_BUILT_IN } from '#lib/options.js';

	let { card, page, label, options }: KindProps<'link'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'link', card.ref, LINK_BUILT_IN));
	const to = $derived(linkTo(String(o.to ?? 'home')));
	const text = $derived(String(o.text ?? '').trim() || label || to?.label || 'Gone');
</script>

{#if to}
	<a class="link" href={to.href}>
		<span>{text}</span>
		<ArrowRight size={18} aria-hidden="true" />
	</a>
{:else}
	<p class="link gone">{text}: the page it opened is gone.</p>
{/if}

<style>
	.link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 48px;
		height: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 0 16px;
		border: 1px solid var(--card-line);
		border-radius: var(--feel-card-radius, var(--radius));
		background: var(--surface);
		color: var(--ink);
		font-weight: 650;
		text-decoration: none;
	}
	.link:hover {
		border-color: var(--accent);
	}
	.link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gone {
		color: var(--ink-muted);
		font-weight: 500;
		font-size: 13px;
	}
</style>
