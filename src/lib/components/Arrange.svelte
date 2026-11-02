<!--
	Wraps something that can be arranged. Normally it is just the thing; in
	Customise or Edit the thing goes quiet (it can't be operated) with its
	tools under it, and a hidden thing shows faded so it can be brought back.
	Edit's frame is the accent colour, so the household's page never looks
	like one's own (N6).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Form } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Tools from './Tools.svelte';

	let {
		page,
		ref,
		name,
		shown,
		hidden = false,
		star = true,
		form,
		wide = false,
		list = 'page',
		added = false,
		renamed = false,
		settings,
		moveTo,
		addBefore,
		addAfter,
		axis = 'x',
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
		children: Snippet;
	} = $props();

	const mode = $derived(view.mode(page));

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
	<div
		bind:this={box}
		class="arrange"
		class:hidden
		class:wide
		class:fresh
		class:shared={mode === 'edit'}
	>
		<div class="card">
			<div class="quiet" inert>{@render children()}</div>
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
