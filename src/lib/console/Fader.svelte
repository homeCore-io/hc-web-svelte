<!--
	A fader on the console (the Controls board): Machined, a recessed channel
	with a light pipe and a metal cap; Glass pill, a pill that fills with the
	light; or Light bar, a slim lit track with a bead. A real range input lies
	over it, so keyboards and screen readers get a slider, and it sends once,
	on release, as BigBar does.

	Under it, the label: a pill the same size for every fader (104 by 42, or 92
	in a tight row), so a row of faders always lines up. Given `onpick`, the
	pill is a button that selects the fader (a lamp for a scene); given
	`onopen` instead, it opens the thing's details.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FaderStyle } from './style.js';

	let {
		label,
		value,
		min = 0,
		max = 100,
		step = 1,
		unit = '%',
		zero = 'Off',
		sub,
		pill,
		style = 'machined',
		height = 200,
		tight = false,
		color,
		selected = false,
		onpick,
		onopen,
		disabled = false,
		waiting = false,
		oncommit
	}: {
		/** The thing's name: on the pill, and the slider's name. */
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		/** After the number; `%` is written against it. */
		unit?: string;
		/** What the lowest value reads as: Off for a light. */
		zero?: string;
		/** A second line on the pill (the scene it's in). */
		sub?: string;
		/** The pill's words, in place of the label and `sub`. */
		pill?: Snippet;
		style?: FaderStyle;
		/** The channel's height in pixels, the pill and figure aside. */
		height?: number;
		/** A narrower pill, for a crowded row. */
		tight?: boolean;
		/** The light's own color, in place of the theme's. */
		color?: string;
		/** Whether the pill is selected, when it can be. */
		selected?: boolean;
		/** Makes the pill a button that selects this fader. */
		onpick?: () => void;
		/** Without `onpick`, makes the pill a button that opens the thing's details. */
		onopen?: () => void;
		disabled?: boolean;
		/** A command is on its way: shown until the device answers. */
		waiting?: boolean;
		oncommit: (value: number) => void;
	} = $props();

	let held = $state<number | null>(null);
	const shown = $derived(held ?? value);
	const p = $derived(max > min ? Math.max(0, Math.min(1, (shown - min) / (max - min))) : 0);
	const text = $derived(
		shown <= min && zero
			? zero
			: `${Number.isInteger(step) ? Math.round(shown) : shown.toFixed(1)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
	);
	const on = $derived(p > 0);
	// The glass pill's icon turns dark once the light behind it is bright enough.
	const deep = $derived(p > 0.12);
</script>

<div
	class="st {style}"
	class:waiting
	class:disabled
	class:tight
	style:--h={`${height}px`}
	style:--c={color}
	aria-busy={waiting || undefined}
>
	{#if style !== 'glass'}<span class="val" aria-hidden="true">{text}</span>{/if}
	<div class="ctl" class:on class:deep style:--p={p}>
		{#if style === 'machined'}
			<span class="tick" style:top="15%"></span><span class="tick" style:top="36%"></span><span
				class="tick"
				style:top="57%"
			></span><span class="tick" style:top="78%"></span>
			<span class="slot"></span><span class="pipe"></span><span class="cap"></span>
		{:else if style === 'glass'}
			<span class="lit"></span>
			<span class="pv" aria-hidden="true">{text}</span>
			<span class="ic" aria-hidden="true"
				><svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					><path
						d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"
					/></svg
				></span
			>
		{:else}
			<span class="tr"><i></i></span><span class="bead"></span>
		{/if}
		<input
			type="range"
			{min}
			{max}
			{step}
			value={shown}
			{disabled}
			aria-label={label}
			aria-valuetext={text}
			oninput={(e) => (held = Number(e.currentTarget.value))}
			onchange={(e) => {
				const v = Number(e.currentTarget.value);
				held = null;
				oncommit(v);
			}}
		/>
	</div>
	{#if onpick}
		<button
			type="button"
			class="lab pick"
			aria-pressed={selected}
			class:sel={selected}
			onclick={onpick}
			>{#if pill}{@render pill()}{:else}<span class="ln">{label}</span>{#if sub}<small>{sub}</small
					>{/if}{/if}</button
		>
	{:else if onopen}
		<button type="button" class="lab pick" title={`Open ${label}`} onclick={onopen}
			>{#if pill}{@render pill()}{:else}<span class="ln">{label}</span>{#if sub}<small>{sub}</small
					>{/if}{/if}</button
		>
	{:else}
		<span class="lab" aria-hidden="true"
			>{#if pill}{@render pill()}{:else}<span class="ln">{label}</span>{#if sub}<small>{sub}</small
					>{/if}{/if}</span
		>
	{/if}
</div>

<style>
	.st {
		/* The light: the thing's own color, else the theme's. */
		--lo: var(--c, var(--track-on));
		--hi: color-mix(in srgb, var(--lo) 30%, #fff);
		--glow: color-mix(in srgb, var(--lo) 60%, transparent);
		--well-a: #090a0d;
		--well-b: #15171d;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		flex: none;
	}
	:global(:root[data-theme='light']) .st {
		--well-a: #cfcac0;
		--well-b: #e6e2d9;
	}
	.val {
		font: 600 14px var(--font-num);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	.ctl {
		position: relative;
		flex: none;
		height: var(--h);
		touch-action: none;
	}
	.ctl:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	/* The slider itself, over the drawing: up is more. */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: ns-resize;
		writing-mode: vertical-lr;
		direction: rtl;
	}
	.disabled input {
		cursor: default;
	}
	.disabled .ctl {
		opacity: 0.5;
	}

	/* ---- Machined: a recessed channel, a light pipe, a metal cap ---- */
	.machined .ctl {
		width: 58px;
		border-radius: 18px;
		background: linear-gradient(180deg, var(--well-a), var(--well-b));
		box-shadow:
			inset 0 3px 8px rgba(0, 0, 0, 0.85),
			inset 0 -1px 0 rgba(255, 255, 255, 0.07),
			0 1px 0 rgba(255, 255, 255, 0.05);
	}
	.tick {
		position: absolute;
		left: 8px;
		right: 8px;
		height: 1px;
		background: rgba(255, 255, 255, 0.07);
	}
	.slot,
	.pipe {
		position: absolute;
		left: 25px;
		width: 8px;
		border-radius: 4px;
	}
	.slot {
		top: 14px;
		bottom: 14px;
		background: #050608;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.9);
	}
	.pipe {
		bottom: 14px;
		height: calc((100% - 28px) * var(--p));
		background: linear-gradient(0deg, var(--lo), var(--hi));
		box-shadow:
			0 0 12px 2px var(--glow),
			0 0 30px 6px color-mix(in srgb, var(--lo) 25%, transparent);
		transition: height 0.12s;
	}
	.cap {
		position: absolute;
		left: 5px;
		right: 5px;
		bottom: calc(10px + (100% - 54px) * var(--p));
		height: 34px;
		border-radius: 10px;
		background: linear-gradient(180deg, #fafbfc 0%, #d5d8de 46%, #b4b8c1 54%, #e4e6ea 100%);
		box-shadow:
			0 8px 14px rgba(0, 0, 0, 0.65),
			0 2px 3px rgba(0, 0, 0, 0.5),
			inset 0 1px 0 #fff,
			inset 0 -1px 0 rgba(0, 0, 0, 0.25);
		transition: bottom 0.12s;
	}
	/* The cap's line glows the light's color while it's on. */
	.cap::after {
		content: '';
		position: absolute;
		left: 10px;
		right: 10px;
		top: 16px;
		height: 2px;
		border-radius: 1px;
		background: #8a8f99;
	}
	.on .cap::after {
		background: var(--lo);
	}

	/* ---- Glass pill: the whole pill is the control, the fill is the light ---- */
	.glass .ctl {
		width: 72px;
		height: calc(var(--h) + 22px);
		border-radius: 30px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 0 0 1px rgba(255, 255, 255, 0.04),
			0 20px 40px -18px rgba(0, 0, 0, 0.9);
	}
	.lit {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: calc(var(--p) * 100%);
		background: linear-gradient(0deg, color-mix(in srgb, var(--lo) 55%, #fff), var(--hi));
		transition: height 0.12s;
	}
	.on .lit {
		box-shadow: 0 -10px 30px var(--glow);
	}
	.lit::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0));
	}
	.ic {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 16px;
		display: grid;
		place-items: center;
		color: var(--ink-muted);
	}
	.deep .ic {
		color: color-mix(in srgb, var(--lo) 30%, #1a0f05);
	}
	.pv {
		position: absolute;
		left: 0;
		right: 0;
		top: 16px;
		text-align: center;
		font-weight: 700;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	.deep .pv {
		color: #fff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
	}

	/* ---- Light bar: a slim lit track and a bead with a halo ---- */
	.lightbar .ctl {
		width: 46px;
	}
	.tr {
		position: absolute;
		left: 20px;
		width: 6px;
		top: 12px;
		bottom: 12px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.tr i {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: calc(var(--p) * 100%);
		border-radius: 3px;
		background: linear-gradient(0deg, var(--lo), var(--hi));
		box-shadow: 0 0 16px 3px var(--glow);
		transition: height 0.12s;
	}
	.bead {
		position: absolute;
		left: 9px;
		bottom: calc((100% - 28px) * var(--p));
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 35%, #fff, #e9e3d8);
		box-shadow:
			0 0 0 6px color-mix(in srgb, var(--ink) 8%, transparent),
			0 6px 14px rgba(0, 0, 0, 0.6);
		transition: bottom 0.12s;
	}
	.on .bead {
		box-shadow:
			0 0 0 6px color-mix(in srgb, var(--lo) 28%, transparent),
			0 6px 14px rgba(0, 0, 0, 0.6);
	}

	/* ---- The label: one size for every fader ---- */
	.lab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		width: 104px;
		height: 42px;
		box-sizing: border-box;
		padding: 4px 8px;
		border: 0;
		border-radius: 12px;
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 600 11.5px var(--font);
		line-height: 1.15;
		text-align: center;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--ink) 9%, transparent),
			color-mix(in srgb, var(--ink) 4%, transparent)
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 2px 6px -2px rgba(0, 0, 0, 0.6);
		transition:
			background 0.2s,
			box-shadow 0.2s,
			color 0.2s;
	}
	.tight .lab {
		width: 92px;
	}
	.lab .ln,
	.lab small {
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lab small {
		font-size: 10px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.pick {
		cursor: pointer;
	}
	.pick:hover {
		color: var(--ink);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--ink) 14%, transparent),
			color-mix(in srgb, var(--ink) 6%, transparent)
		);
	}
	.sel {
		color: var(--ink);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cool) 34%, transparent),
			color-mix(in srgb, var(--cool) 18%, transparent)
		);
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--cool) 70%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.25),
			0 0 14px color-mix(in srgb, var(--cool) 35%, transparent);
	}

	/* Waiting for the device: the label breathes. */
	.waiting .lab {
		animation: breathe 1.2s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pipe,
		.cap,
		.lit,
		.tr i,
		.bead {
			transition: none;
		}
		.waiting .lab {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
