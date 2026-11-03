<!--
	A thing as a chip (13 §13.1, Mushroom): a pill with its symbol, tinted in
	its own color when on, its name and its state or reading. The symbol
	switches it (where it switches); the name opens it.
-->
<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { CardSymbol } from '#lib/card.js';

	let {
		name,
		words,
		icon,
		on,
		ink,
		alarm = false,
		reading = false,
		flip,
		open
	}: {
		name: string;
		/** Its state, or its reading. */
		words: string;
		icon: CardSymbol;
		on: boolean;
		/** Its tint when on: its own color, or the theme's. */
		ink: string;
		alarm?: boolean;
		/** A reading: its value in figures. */
		reading?: boolean;
		/** Switches it; none for something that doesn't switch. */
		flip?: () => void;
		open: () => void;
	} = $props();
</script>

<span class="chip" class:on class:alarm style:--tint={ink}>
	{#if flip}
		<button class="symbol" onclick={flip} aria-label={`Turn ${name} ${on ? 'off' : 'on'}`}
			><Icon name={icon} size={16} /></button
		>
	{:else}
		<span class="symbol"><Icon name={icon} size={16} /></span>
	{/if}
	<button class="words" onclick={open}><b>{name}</b><span class:num={reading}>{words}</span></button
	>
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		max-width: 100%;
		height: 40px;
		padding: 0 4px 0 5px;
		box-sizing: border-box;
		border-radius: 999px;
		border: 1px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
		transition:
			border-color var(--feel-slow),
			background var(--feel-slow);
	}
	.chip.on {
		border-color: color-mix(in srgb, var(--tint) 55%, transparent);
		background: color-mix(in srgb, var(--tint) 12%, var(--surface));
	}
	.chip.alarm {
		border-color: var(--alert-line);
		background: var(--alert-bg);
	}
	.symbol {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.on .symbol {
		background: color-mix(in srgb, var(--tint) 35%, transparent);
		color: var(--ink);
	}
	.alarm .symbol {
		color: var(--alert);
	}
	.words {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		padding: 0 10px 0 6px;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		white-space: nowrap;
	}
	b {
		font-size: 13.5px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.words span {
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.words .num {
		font-family: var(--font-num);
		font-size: 13.5px;
		color: var(--ink);
	}
</style>
