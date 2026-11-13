<!--
	A lamp's glass sheet on the phone (the PhonePlan board), from its fader's
	name: a big bar across for its brightness, dragged or stepped with the
	keys; a strip from warm to cool white where the lamp has one; its
	group's scenes that set it, each shown in this lamp alone (lamps.ts,
	hueScenes.ts); then where it shows (the "⋯" picker) and its details.
	From "All", the same for the whole group, its scenes shown in all of it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import Placer from '../Placer.svelte';
	import { placer } from '../placer.svelte.js';
	import { shortName, type LightColumn } from '../room.js';
	import { appliesTo, onLabel, sceneNameOf, swatchOf, takesScenes } from '../hueScenes.js';
	import {
		activeIn,
		allLevel,
		level,
		sending,
		setAll,
		setLevel,
		show,
		showIn,
		wantOf,
		waiting
	} from '../lamps.js';
	import Sheet from './Sheet.svelte';
	import { levelAt, warmthOf, whiteAt, whiteFor } from './phone.js';

	let {
		col,
		lamp,
		room,
		may,
		onclose
	}: {
		col: LightColumn;
		/** The lamp; none for the group's "All". */
		lamp?: CoreDevice;
		room: string;
		may: boolean;
		onclose: () => void;
	} = $props();

	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	/** The device this sheet is about: the lamp, else the group's own, when it has one. */
	const target = $derived(lamp ?? col.group);
	const title = $derived(lamp ? nameOf(lamp) : col.title);
	const can = $derived(may && (lamp ? lamp.available : true));

	// ---- brightness: held while a finger is on the bar, sent on letting go ----
	const value = $derived(lamp ? level(lamp) : allLevel(col));
	let held = $state<number | null>(null);
	const shown = $derived(held ?? value);
	function commit(v: number) {
		held = null;
		if (lamp) setLevel(lamp, v);
		else setAll(col, v);
	}
	const word = $derived.by(() => {
		if (lamp && !lamp.available) return 'Offline';
		if (shown <= 0) return 'Off';
		const scene = lamp ? sceneNameOf(lamp) : undefined;
		return [`On · ${shown}%`, scene].filter(Boolean).join(' · ');
	});

	/** A bar dragged across: `set` follows the finger, `done` gets where it was let go. */
	function drag(set: (at: number) => void, done: () => void) {
		return (e: PointerEvent) => {
			if (!can) return;
			const bar = e.currentTarget as HTMLElement;
			bar.setPointerCapture(e.pointerId);
			const at = (ev: PointerEvent) => {
				const r = bar.getBoundingClientRect();
				return levelAt(ev.clientX, r.left, r.width) / 100;
			};
			set(at(e));
			const move = (ev: PointerEvent) => set(at(ev));
			const up = () => {
				bar.removeEventListener('pointermove', move);
				bar.removeEventListener('pointerup', up);
				bar.removeEventListener('pointercancel', up);
				done();
			};
			bar.addEventListener('pointermove', move);
			bar.addEventListener('pointerup', up);
			bar.addEventListener('pointercancel', up);
		};
	}
	const brightDown = $derived(
		drag(
			(at) => (held = Math.round(at * 100)),
			() => held !== null && commit(held)
		)
	);
	/** Arrows step by 5, Page Up and Down by 10, Home and End to the ends. */
	function stepOf(e: KeyboardEvent): number | 'lo' | 'hi' | undefined {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return 5;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -5;
		if (e.key === 'PageUp') return 10;
		if (e.key === 'PageDown') return -10;
		if (e.key === 'Home') return 'lo';
		if (e.key === 'End') return 'hi';
		return undefined;
	}
	function brightKey(e: KeyboardEvent) {
		const by = stepOf(e);
		if (by === undefined || !can) return;
		e.preventDefault();
		commit(by === 'lo' ? 0 : by === 'hi' ? 100 : Math.max(0, Math.min(100, shown + by)));
	}

	// ---- white, warm to cool, where it has one ----
	const warmth = $derived(target ? warmthOf(target) : undefined);
	const whiteNow = $derived.by(() => {
		if (!target || !warmth) return undefined;
		const v = { ...target.attributes, ...wantOf(target) }[warmth.attr];
		return typeof v === 'number' ? v : undefined;
	});
	let whiteHeld = $state<number | null>(null);
	const whiteShown = $derived(
		whiteHeld ?? (warmth && whiteNow !== undefined ? whiteAt(warmth, whiteNow) : undefined)
	);
	function setWhite(at: number) {
		whiteHeld = null;
		if (!target || !warmth) return;
		void commands.set(
			target.device_id,
			'light',
			{ on: true, [warmth.attr]: whiteFor(warmth, at) },
			target.attributes
		);
	}
	const whiteDown = $derived(
		drag(
			(at) => (whiteHeld = at),
			() => whiteHeld !== null && setWhite(whiteHeld)
		)
	);
	function whiteKey(e: KeyboardEvent) {
		const by = stepOf(e);
		if (by === undefined || !can) return;
		e.preventDefault();
		const now = whiteShown ?? 0.5;
		setWhite(by === 'lo' ? 0 : by === 'hi' ? 1 : now + by / 100);
	}
	const kelvin = (at: number | undefined) =>
		warmth && at !== undefined ? `${whiteFor(warmth, at)} K` : 'unknown';

	// ---- its scenes: the lamp's part of each that sets it, else the group's ----
	const active = $derived(activeIn(col, lamp));
	const scenes = $derived(lamp ? col.scenes.filter((s) => appliesTo(s, lamp)) : col.scenes);
	const scenesNote = $derived(
		!lamp || col.scenes.length === 0
			? undefined
			: !takesScenes(lamp)
				? 'It can’t take a scene alone. The group’s scenes are under the faders.'
				: scenes.length === 0
					? 'None of the group’s scenes sets it.'
					: undefined
	);

	// ---- where it shows, and its details ----
	const p = placer();
	const mayPlace = $derived(session.can('content:write'));
	let box = $state<HTMLElement>();
	const placingHere = $derived(!!p?.open && !!box?.contains(p.open.from));
	$effect(() => () => p?.close());
	function details() {
		if (!target) return;
		const id = target.device_id;
		onclose();
		openDevice(id, page.url);
	}
</script>

<Sheet label={title} {onclose}>
	{#snippet head()}
		<span class="tag" data-brand={col.brand.toLowerCase()}>{col.brand}</span>
	{/snippet}
	<div class="lamp" bind:this={box}>
		<p class="st" aria-live="polite">
			{lamp ? word : `${word} · ${onLabel(col.group, active && nameOf(active))}`}
		</p>

		<div
			class="big"
			class:waiting={lamp ? waiting(lamp) : col.group ? waiting(col.group) : false}
			class:off={!can}
			role="slider"
			tabindex={can ? 0 : -1}
			aria-label={`${title} brightness`}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={shown}
			aria-valuetext={shown <= 0 ? 'Off' : `${shown}%`}
			aria-disabled={!can || undefined}
			onpointerdown={brightDown}
			onkeydown={brightKey}
		>
			<span class="fill" style:width={`${shown}%`}></span>
			<span class="pc" class:lo={shown <= 25}>{shown <= 0 ? 'Off' : `${shown}%`}</span>
		</div>

		{#if warmth}
			<div
				class="ct"
				class:off={!can}
				role="slider"
				tabindex={can ? 0 : -1}
				aria-label={`${title} white, warm to cool`}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round((whiteShown ?? 0.5) * 100)}
				aria-valuetext={kelvin(whiteShown)}
				aria-disabled={!can || undefined}
				onpointerdown={whiteDown}
				onkeydown={whiteKey}
			>
				{#if whiteShown !== undefined}<i style:left={`${whiteShown * 100}%`}></i>{/if}
			</div>
			<p class="ends" aria-hidden="true"><span>Warm</span><span>Cool</span></p>
		{/if}

		{#if col.scenes.length > 0}
			<h3 class="lbl">{lamp ? 'Scene for this lamp' : 'Scenes'}</h3>
			{#if scenesNote}<p class="note">{scenesNote}</p>{/if}
			<div class="scn" role="group" aria-label={lamp ? `Scenes for ${title}` : `${title} scenes`}>
				{#each scenes as s (s.device_id)}
					<button
						type="button"
						class="chip"
						class:on={active?.device_id === s.device_id}
						class:wait={sending(lamp, s)}
						aria-pressed={active?.device_id === s.device_id}
						disabled={!can || !s.available}
						onclick={() => (lamp ? showIn(lamp, s) : show(s))}
						><i style:background={swatchOf(s)} aria-hidden="true"></i>{nameOf(s)}</button
					>
				{/each}
			</div>
		{/if}

		{#if target}
			<div class="foot">
				{#if p && mayPlace}
					<button
						type="button"
						aria-haspopup="dialog"
						aria-expanded={p.open?.id === target.device_id}
						data-placer={target.device_id}
						onclick={(e) => p.toggle(target.device_id, e.currentTarget)}>Where it shows</button
					>
				{/if}
				<button type="button" onclick={details}>Details</button>
			</div>
		{/if}
		{#if p && placingHere}<Placer {p} />{/if}
	</div>
</Sheet>

<style>
	.tag {
		flex: none;
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 6px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.tag[data-brand='hue'] {
		background: rgba(127, 184, 255, 0.15);
		color: #a9cdff;
	}
	.tag[data-brand='lutron'] {
		background: rgba(255, 196, 107, 0.15);
		color: #ffd48a;
	}
	.st {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 500;
	}
	/* ---- the bars: brightness, then white ---- */
	.big {
		position: relative;
		height: 64px;
		margin-top: 16px;
		border-radius: 20px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		touch-action: none;
		cursor: pointer;
	}
	.big:focus-visible,
	.ct:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: linear-gradient(90deg, #ff9f43, #ffd48a);
	}
	.pc {
		position: absolute;
		left: 18px;
		top: 50%;
		transform: translateY(-50%);
		font: 800 22px var(--font-num);
		color: #1a0f05;
	}
	.pc.lo {
		color: var(--ink);
	}
	.waiting .fill {
		opacity: 0.7;
	}
	.off {
		opacity: 0.5;
		cursor: default;
	}
	.ct {
		position: relative;
		height: 36px;
		margin-top: 14px;
		border-radius: 12px;
		background: linear-gradient(90deg, #ff9a3c, #ffe1b0, #f4f7ff, #a9cdff);
		touch-action: none;
		cursor: pointer;
	}
	.ct i {
		position: absolute;
		top: -4px;
		width: 6px;
		height: 44px;
		margin-left: -3px;
		border-radius: 3px;
		background: #fff;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4);
	}
	.ends {
		display: flex;
		justify-content: space-between;
		margin: 4px 2px 0;
		color: var(--ink-muted);
		font-size: 11px;
	}
	@media (prefers-reduced-motion: no-preference) {
		.fill {
			transition: width 0.08s;
		}
	}
	/* ---- scenes ---- */
	.lbl {
		margin: 18px 0 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.note {
		margin: 0 0 8px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.scn {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		min-height: 40px;
		padding: 0 12px 0 6px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 600 13px var(--font);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip i {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
	.chip.on {
		box-shadow: inset 0 0 0 1.5px var(--ink);
		color: var(--ink);
	}
	.chip.wait {
		opacity: 0.7;
	}
	.chip:disabled {
		opacity: 0.45;
	}
	/* ---- where it shows, and details ---- */
	.foot {
		display: flex;
		gap: 8px;
		margin-top: 20px;
	}
	.foot button {
		flex: 1;
		min-height: 46px;
		border: 0;
		border-radius: 13px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font: 600 14px var(--font);
	}
	.foot button[aria-expanded='true'] {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
	}
</style>
