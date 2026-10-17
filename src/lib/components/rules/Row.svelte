<!--
	One part of a rule in the editor (A3): its sentence, and its form when
	opened. Move it up or down, or take it out.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';
	import type { Phrase } from '#lib/ruleWords.js';
	import Words from './Words.svelte';

	let {
		words,
		open = $bindable(false),
		number,
		off = false,
		onremove,
		onup,
		ondown,
		children
	}: {
		words: Phrase;
		open?: boolean;
		number?: number;
		off?: boolean;
		onremove?: () => void;
		onup?: () => void;
		ondown?: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="row" class:open class:off>
	<div class="head">
		{#if number !== undefined}<span class="n">{number}</span>{/if}
		<button type="button" class="say" aria-expanded={open} onclick={() => (open = !open)}>
			<Words {words} />{#if off}<em> — turned off</em>{/if}
		</button>
		<span class="tools">
			{#if onup}<button type="button" aria-label="Move up" onclick={onup}
					><ArrowUp size={16} aria-hidden="true" /></button
				>{/if}
			{#if ondown}<button type="button" aria-label="Move down" onclick={ondown}
					><ArrowDown size={16} aria-hidden="true" /></button
				>{/if}
			{#if onremove}<button type="button" aria-label="Take it out" onclick={onremove}
					><X size={16} aria-hidden="true" /></button
				>{/if}
		</span>
	</div>
	{#if open}
		<div class="form">{@render children()}</div>
	{/if}
</div>

<style>
	.row {
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.row.open {
		border-color: var(--accent);
	}
	.row.off .say {
		opacity: 0.6;
	}
	.head {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: 6px 6px 6px var(--space-3);
	}
	.n {
		flex: none;
		width: 22px;
		height: 22px;
		margin-top: 9px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--ink-muted);
		font-family: var(--font-num);
		font-size: 12px;
	}
	.say {
		flex: 1;
		min-width: 0;
		min-height: 40px;
		padding: 8px 0;
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		line-height: 1.45;
	}
	em {
		font-style: normal;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.tools {
		display: flex;
		flex: none;
	}
	.tools button {
		width: 36px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		color: var(--ink-muted);
		border-radius: 8px;
	}
	.tools button:hover {
		background: var(--surface-2);
	}
	.form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
		padding: var(--space-3);
		border-top: 1px solid var(--line);
	}
</style>
