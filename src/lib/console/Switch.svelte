<!--
	A switch on the console (the Controls board): Precision, a weighted knob
	that springs across; Keypad, a button like a Lutron keypad's with its LED;
	or Off · On, both states named and a lit thumb. Each is one button with
	the switch role, so it reads as a switch whichever way it's drawn.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SwitchStyle } from './style.js';

	let {
		on,
		label,
		sub,
		style = 'precision',
		named = true,
		disabled = false,
		waiting = false,
		onchange,
		tag
	}: {
		on: boolean;
		/** The thing's name, and the switch's. */
		label: string;
		/** A second line under the name (where it's from). */
		sub?: string;
		style?: SwitchStyle;
		/** Shows the name beside the switch; a keypad button always shows it. */
		named?: boolean;
		disabled?: boolean;
		/** A command is on its way: shown until the device answers. */
		waiting?: boolean;
		onchange: (on: boolean) => void;
		/** Under the name: a room's "moved here" (Moved). */
		tag?: Snippet;
	} = $props();
</script>

{#if style === 'keypad'}
	<button
		type="button"
		class="sw keypad"
		class:on
		class:waiting
		role="switch"
		aria-checked={on}
		aria-busy={waiting || undefined}
		{disabled}
		onclick={() => onchange(!on)}
	>
		<span class="led" aria-hidden="true"></span>
		<span class="nm"
			><span class="lb">{label}</span>{#if sub}<small>{sub}</small>{/if}{@render tag?.()}</span
		>
		<small class="word" aria-hidden="true">{on ? 'On' : 'Off'}</small>
	</button>
{:else}
	<div class="trow" class:waiting>
		{#if named}<span class="nm" aria-hidden="true"
				><span class="lb">{label}</span>{#if sub}<small>{sub}</small>{/if}{@render tag?.()}</span
			>{/if}
		<button
			type="button"
			class="sw {style}"
			class:on
			role="switch"
			aria-checked={on}
			aria-label={label}
			aria-busy={waiting || undefined}
			{disabled}
			onclick={() => onchange(!on)}
		>
			{#if style === 'precision'}
				<span class="k" aria-hidden="true"
					><svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"><path d="M12 4v8" /></svg
					></span
				>
			{:else}
				<span class="th" aria-hidden="true"></span>
				<span class="seg" class:cur={!on} aria-hidden="true">OFF</span>
				<span class="seg" class:cur={on} aria-hidden="true">ON</span>
			{/if}
		</button>
	</div>
{/if}

<style>
	.sw,
	.trow {
		--lo: var(--track-on);
		--hi: color-mix(in srgb, var(--track-on) 55%, #fff);
		--glow: color-mix(in srgb, var(--track-on) 45%, transparent);
		--well-a: #0c0d11;
		--well-b: #1a1d24;
	}
	:global(:root[data-theme='light']) .sw,
	:global(:root[data-theme='light']) .trow {
		--well-a: #cfcac0;
		--well-b: #e6e2d9;
	}
	.sw {
		position: relative;
		flex: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	.sw:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.sw:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.trow {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}
	.nm {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
	/* A long name takes a second line rather than being cut short. */
	.lb {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.nm small {
		display: block;
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---- Precision: a weighted knob that springs across ---- */
	.precision {
		width: 66px;
		height: 38px;
		border-radius: 999px;
		background: linear-gradient(180deg, var(--well-a), var(--well-b));
		box-shadow:
			inset 0 2px 5px rgba(0, 0, 0, 0.8),
			inset 0 -1px 0 rgba(255, 255, 255, 0.06);
		transition:
			background 0.25s,
			box-shadow 0.25s;
	}
	.precision.on {
		background: linear-gradient(180deg, var(--lo), var(--hi));
		box-shadow:
			inset 0 2px 4px rgba(120, 50, 0, 0.45),
			0 0 22px var(--glow);
	}
	.k {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: linear-gradient(180deg, #ffffff, #d9dce2);
		box-shadow:
			0 3px 8px rgba(0, 0, 0, 0.55),
			inset 0 -1px 0 rgba(0, 0, 0, 0.15);
		color: #9aa0ab;
		transition:
			left 0.25s cubic-bezier(0.3, 1.4, 0.5, 1),
			color 0.25s;
	}
	.on .k {
		left: 32px;
		color: var(--lo);
	}

	/* ---- Keypad: a button with its status LED ---- */
	.keypad {
		width: 100%;
		min-width: 0;
		height: 58px;
		border-radius: 14px;
		padding: 0 18px;
		display: flex;
		align-items: center;
		gap: 14px;
		text-align: left;
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 600 13.5px var(--font);
		letter-spacing: 0.01em;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--surface) 80%, #fff 6%),
			var(--surface)
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.09),
			0 1px 0 rgba(0, 0, 0, 0.6),
			0 8px 18px -10px rgba(0, 0, 0, 0.9);
		transition:
			box-shadow 0.15s,
			transform 0.1s;
	}
	.keypad:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7);
	}
	.keypad.on {
		color: var(--ink);
	}
	.led {
		width: 10px;
		height: 10px;
		flex: none;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 14%, var(--surface));
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
		transition:
			background 0.2s,
			box-shadow 0.2s;
	}
	.on .led {
		background: var(--hi);
		box-shadow:
			0 0 6px var(--hi),
			0 0 16px var(--glow);
	}
	.word {
		margin-left: auto;
		flex: none;
		font: 500 11px var(--font);
		color: var(--ink-muted);
	}

	/* ---- Off · On: both states named, a lit thumb ---- */
	.offon {
		display: grid;
		grid-template-columns: 1fr 1fr;
		width: 128px;
		height: 38px;
		padding: 3px;
		border-radius: 12px;
		background: linear-gradient(180deg, var(--well-a), var(--well-b));
		box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8);
	}
	.th {
		position: absolute;
		top: 3px;
		bottom: 3px;
		left: 3px;
		width: 61px;
		border-radius: 9px;
		background: linear-gradient(180deg, #3a3e48, #2a2d35);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			0 3px 8px rgba(0, 0, 0, 0.5);
		transition:
			left 0.22s cubic-bezier(0.3, 1.3, 0.5, 1),
			background 0.22s;
	}
	.offon.on .th {
		left: 64px;
		background: linear-gradient(180deg, var(--hi), var(--lo));
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			0 0 18px var(--glow);
	}
	.seg {
		position: relative;
		display: grid;
		place-items: center;
		color: var(--ink-muted);
		font: 700 12px var(--font);
		letter-spacing: 0.04em;
	}
	.seg.cur {
		color: #fff;
	}
	.offon.on .seg.cur {
		color: color-mix(in srgb, var(--lo) 25%, #1a0b00);
	}

	/* Waiting for the device: it breathes. */
	.waiting .sw,
	.keypad.waiting {
		animation: breathe 1.2s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.6;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.precision,
		.k,
		.th,
		.keypad,
		.led {
			transition: none;
		}
		.waiting .sw,
		.keypad.waiting {
			animation: none;
			opacity: 0.75;
		}
	}
</style>
