<!--
	A thing as a row (13 §13.1, Multiple Entity Row): its symbol, its name and
	state, and its control at the end: a slider for a light that dims, and its
	switch. The name opens it. Made for a section laid out as a list.
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
		level = null,
		flip,
		setLevel,
		open
	}: {
		name: string;
		words: string;
		icon: CardSymbol;
		on: boolean;
		ink: string;
		/** How bright, 0 to 100, for a light that dims. */
		level?: number | null;
		flip: () => void;
		/** Sent once, when the slider is let go. */
		setLevel?: (v: number) => void;
		open: () => void;
	} = $props();

	// Follows the finger; sent once, on letting go.
	let held = $state<number | null>(null);
	const shown = $derived(held ?? (on ? (level ?? 0) : 0));
</script>

<div class="row" class:on style:--tint={ink}>
	<span class="symbol"><Icon name={icon} size={16} /></span>
	<button class="words" onclick={open}><b>{name}</b><small>{words}</small></button>
	{#if level !== null && setLevel}
		<input
			type="range"
			min="0"
			max="100"
			value={shown}
			aria-label={`${name}, brightness`}
			oninput={(e) => (held = Number(e.currentTarget.value))}
			onchange={(e) => {
				setLevel(Number(e.currentTarget.value));
				held = null;
			}}
		/>
	{:else}
		<span class="grow"></span>
	{/if}
	<button
		class="switch"
		role="switch"
		aria-checked={on}
		aria-label={`${name}, ${on ? 'on' : 'off'}`}
		onclick={flip}><span></span></button
	>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 14px;
		box-sizing: border-box;
		border-radius: var(--feel-box-radius, 12px);
		border: 1px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
	}
	.symbol {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.on .symbol {
		background: color-mix(in srgb, var(--tint) 35%, transparent);
		color: var(--ink);
	}
	.words {
		flex: 0 1 180px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	b {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	input[type='range'] {
		flex: 1;
		min-width: 70px;
		accent-color: var(--tint);
	}
	.grow {
		flex: 1;
	}
	.switch {
		position: relative;
		width: 42px;
		height: 24px;
		flex: none;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--track-off);
	}
	.switch span {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: #fff;
		transition: left var(--feel-slow);
	}
	.on .switch {
		background: var(--track-on);
	}
	.on .switch span {
		left: 21px;
	}
</style>
