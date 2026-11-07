<!--
	Wraps something that can be arranged. Normally it is just the thing; in
	Customise or Edit the thing goes quiet (it can't be operated) with its
	tools under it, and a hidden thing shows faded so it can be brought back.
	Edit's frame is the accent color, so the household's page never looks
	like one's own (N6).

	It can be dragged (13 §9: drag/controller.ts finds it by `data-ref`), moved
	with the keyboard (Space picks it up, the arrows move it, Space or Escape
	puts it down), and resized from its corner, snapping between its sizes.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Form } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import { drag } from '#lib/drag.svelte.js';
	import { nudge } from '#lib/layers.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Tools from './Tools.svelte';
	import { CARD_GAP, CARD_ROW } from '#lib/stack.js';
	import { setStack } from '#lib/stacking.js';

	let {
		page,
		ref,
		name,
		shown,
		hidden = false,
		star = true,
		form,
		wide = false,
		rows,
		span,
		list = 'page',
		added = false,
		renamed = false,
		settings,
		moveTo,
		addBefore,
		addAfter,
		axis = 'x',
		forms = [],
		kind = '',
		children
	}: {
		page: string;
		ref: string;
		name: string;
		shown: string[];
		hidden?: boolean;
		star?: boolean;
		form?: Form;
		wide?: boolean;
		/** Card rows of its grid it takes: a stack (13 §13.2). */
		rows?: number;
		/** Columns of its grid it takes, by a number of its own: a stack (13 §13.2). */
		span?: number;
		list?: 'page' | 'favourites';
		added?: boolean;
		renamed?: boolean;
		/** Opens its settings sheet, where its kind has settings. */
		settings?: () => void;
		/** Other sections it can be moved into (G22). */
		moveTo?: { id: string; title: string }[];
		/** Add in front of it (G-f): a + in the gap before it. */
		addBefore?: { label: string; pick: () => void };
		/** Add after it, for the last in its section: a + in the gap after it. */
		addAfter?: { label: string; pick: () => void };
		/** Which way its section runs: across (grid, row) or down (list). */
		axis?: 'x' | 'y';
		/** The sizes it can be, for resizing from its corner. */
		forms?: Form[];
		/** Its kind of card, so dragging knows where it may go (a room stays among the rooms). */
		kind?: string;
		children: Snippet;
	} = $props();

	const mode = $derived(view.mode(page));
	const held = $derived(drag.page === page && drag.ref === ref);
	// A stack a held thing would go in (13 §13.2).
	const taking = $derived(drag.page === page && drag.stack === ref);

	// ---- the keyboard (13 §9.3): Space picks it up, the arrows move it ----
	let picked = $state(false);
	function key(e: KeyboardEvent) {
		if (e.target !== box || list !== 'page') return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			picked = !picked;
			drag.said = picked
				? `${name} picked up. Arrow keys move it; Space puts it down.`
				: `${name} put down.`;
		} else if (e.key === 'Escape' && picked) {
			picked = false;
			drag.said = `${name} put down.`;
		} else if (picked && ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
			e.preventDefault();
			const by = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
			const change = nudge(shown, ref, by);
			if (!change) return;
			view.change(page, change);
			drag.said = `${name} moved ${by === -1 ? 'earlier' : 'later'}.`;
			// Focus stays with it as it moves.
			queueMicrotask(() => box?.focus());
		}
	}

	// ---- resizing from the corner (13 §9.5): snaps between its sizes ----
	// The size shown while the corner is dragged: a form, or a stack's "One wide · 3 tall".
	let sizing = $state<string | null>(null);
	/**
	 * A stack's corner sizes it both ways (13 §13.2): across, one to four cards
	 * wide; down or up, one to six cards tall. A click without a drag fits its
	 * height to its things again.
	 */
	function resizeStack(e: PointerEvent) {
		const [x0, y0] = [e.clientX, e.clientY];
		const from = { width: span ?? 1, rows: rows ?? 1 };
		let to = { ...from };
		let moved = false;
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		// A card's width and height in its grid, with the gap: one step each way.
		const across = (box?.getBoundingClientRect().width ?? 200) / from.width + CARD_GAP;
		const down = CARD_ROW + CARD_GAP;
		const WORDS = ['', 'One', 'Two', 'Three', 'Four'];
		const move = (m: PointerEvent) => {
			const [dx, dy] = [m.clientX - x0, m.clientY - y0];
			if (Math.hypot(dx, dy) > 6) moved = true;
			to = {
				width: Math.max(1, Math.min(4, from.width + Math.round(dx / across))),
				rows: Math.max(1, Math.min(6, from.rows + Math.round(dy / down)))
			};
			sizing = `${WORDS[to.width]} wide · ${to.rows} tall`;
		};
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			sizing = null;
			if (!moved) {
				setStack(page, ref, { height: 'fit' });
				drag.said = `${name} fits its things.`;
				return;
			}
			setStack(page, ref, {
				...(to.width !== from.width ? { width: to.width } : {}),
				...(to.rows !== from.rows ? { height: String(to.rows) } : {})
			});
			drag.said = `${name} is ${WORDS[to.width]!.toLowerCase()} wide and ${to.rows} tall now.`;
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
		e.preventDefault();
		e.stopPropagation();
	}

	function resize(e: PointerEvent) {
		if (kind === 'stack') return resizeStack(e);
		if (!form || forms.length < 2) return;
		const start = e.clientX + e.clientY;
		const from = forms.indexOf(form);
		let moved = false;
		const handle = e.currentTarget as HTMLElement;
		handle.setPointerCapture(e.pointerId);
		const move = (m: PointerEvent) => {
			const d = m.clientX + m.clientY - start;
			if (Math.abs(d) > 6) moved = true;
			const to = Math.max(0, Math.min(forms.length - 1, from + Math.round(d / 90)));
			sizing = forms[to] ?? form ?? null;
		};
		const up = () => {
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			// A click without a drag steps to the next size.
			const next = (moved ? sizing : forms[(from + 1) % forms.length]) as Form | null;
			sizing = null;
			if (next && next !== form) {
				view.change(page, { op: 'form', ref, form: next });
				drag.said = `${name} is ${next} now.`;
			}
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
		e.preventDefault();
		e.stopPropagation();
	}

	// Just added from Add: bring it into view and mark it.
	let box = $state<HTMLElement>();
	let fresh = $state(false);
	$effect(() => {
		if (adding.added !== ref || !box) return;
		adding.added = null;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		box.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
		fresh = true;
		// No cleanup: clearing `added` above re-runs this, which must not cut the mark short.
		setTimeout(() => (fresh = false), 2000);
	});
</script>

{#if mode !== null}
	<!-- A card you can move from the keyboard (13 §9.3): focusable, with its own keys. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={box}
		class="arrange"
		class:hidden
		class:wide
		style:grid-row={rows ? `span ${rows}` : undefined}
		data-span={span && span > 1 ? span : undefined}
		class:fresh
		class:held
		class:picked
		class:taking
		class:shared={mode === 'edit'}
		data-ref={ref}
		data-kind={kind}
		data-list={list}
		tabindex={list === 'page' ? 0 : undefined}
		role="group"
		aria-roledescription="card you can move"
		aria-label={name}
		onkeydown={key}
	>
		<div class="card">
			<div class="quiet" inert>{@render children()}</div>
			{#if sizing}<span class="sizing" aria-hidden="true">{sizing}</span>{/if}
			{#if taking}<span class="sizing" aria-hidden="true">Goes in here</span>{/if}
			{#if form && forms.length > 1}<button
					class="resize"
					aria-label={`${name}: size ${form}. Change size`}
					title="Drag to change its size"
					onpointerdown={resize}>◢</button
				>{/if}
			{#if addBefore}<button
					class="slot before {axis}"
					aria-label={addBefore.label}
					title={addBefore.label}
					onclick={addBefore.pick}><Plus size={13} strokeWidth={3} aria-hidden="true" /></button
				>{/if}
			{#if addAfter && axis === 'x'}<button
					class="slot after x"
					aria-label={addAfter.label}
					title={addAfter.label}
					onclick={addAfter.pick}><Plus size={13} strokeWidth={3} aria-hidden="true" /></button
				>{/if}
		</div>
		<Tools
			{page}
			{ref}
			{name}
			{shown}
			{hidden}
			{star}
			{form}
			{list}
			{added}
			{renamed}
			{settings}
			{moveTo}
		/>
		<!-- Down a column, after the last goes under its tools, not on them. -->
		{#if addAfter && axis === 'y'}<button
				class="slot after y"
				aria-label={addAfter.label}
				title={addAfter.label}
				onclick={addAfter.pick}><Plus size={13} strokeWidth={3} aria-hidden="true" /></button
			>{/if}
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.arrange {
		position: relative;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* Brought into view when just added: clear of the bottom bar, and of Add's sheet on a phone. */
	.arrange {
		scroll-margin: 24px 24px 96px;
	}
	@media (max-width: 899px) {
		.arrange {
			scroll-margin-bottom: calc(55dvh + 24px);
		}
	}
	.arrange.wide {
		grid-column: span 2;
	}
	.card {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.card > .quiet {
		display: grid;
		/* A card's one-line text must not set its width (a room's summary). */
		grid-template-columns: minmax(0, 1fr);
		outline: 2px dashed var(--line);
		outline-offset: 2px;
		border-radius: var(--radius);
	}
	.shared .quiet {
		outline-color: var(--accent);
	}
	.hidden .quiet {
		opacity: 0.4;
	}
	.fresh .quiet {
		outline-style: solid;
		outline-color: var(--accent);
		box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 35%, transparent);
		transition:
			outline-color 0.6s,
			box-shadow 0.6s;
	}
	/* The + in the gap beside a card (G-f): centred in the gap, over both
	   neighbours' edges, a ring inside a target big enough to tap. */
	/* Held: where it was, faded; picked up from the keyboard: ringed. */
	.held .card {
		opacity: 0.35;
	}
	.taking .quiet {
		outline: 2px solid var(--accent);
		box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.picked .quiet {
		outline: 2px solid var(--accent);
	}
	.arrange:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
		border-radius: var(--radius);
	}
	.resize {
		position: absolute;
		right: 2px;
		bottom: 2px;
		z-index: 2;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font-size: 14px;
		line-height: 1;
		cursor: nwse-resize;
		touch-action: none;
	}
	.sizing {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: grid;
		place-items: center;
		border-radius: var(--radius);
		outline: 2px solid var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		font-weight: 700;
		text-transform: capitalize;
		pointer-events: none;
	}
	.slot {
		position: absolute;
		z-index: 2;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
	}
	.slot::before {
		content: '';
		position: absolute;
		inset: 4px;
		border: 1.5px solid var(--accent);
		border-radius: 999px;
		background: var(--surface);
		z-index: -1;
	}
	.slot:hover::before,
	.slot:focus-visible::before {
		background: var(--accent);
	}
	.slot:hover,
	.slot:focus-visible {
		color: var(--accent-ink);
	}
	.slot.x {
		top: 50%;
		translate: 0 -50%;
	}
	.slot.x.before {
		left: -20px;
	}
	.slot.x.after {
		right: -20px;
	}
	.slot.y {
		left: 50%;
		translate: -50% 0;
	}
	.slot.y.before {
		top: -19px;
	}
	.slot.y.after {
		bottom: -24px;
	}
</style>
