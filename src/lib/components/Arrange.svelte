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
		children: Snippet;
	} = $props();

	const mode = $derived(view.mode(page));

	// Just added from Add: it went to its section's end, so bring it into view and mark it.
	let box = $state<HTMLElement>();
	let fresh = $state(false);
	$effect(() => {
		if (adding.added !== ref || !box) return;
		adding.added = null;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		box.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
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
		<div class="quiet" inert>{@render children()}</div>
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
	.arrange.wide {
		grid-column: span 2;
	}
	.arrange > .quiet {
		display: grid;
		/* A card's one-line text must not set its width (a room's summary). */
		grid-template-columns: minmax(0, 1fr);
		outline: 2px dashed var(--line);
		outline-offset: 2px;
		border-radius: var(--radius);
	}
	.shared > .quiet {
		outline-color: var(--accent);
	}
	.hidden > .quiet {
		opacity: 0.4;
	}
	.fresh > .quiet {
		outline-style: solid;
		outline-color: var(--accent);
		transition: outline-color 0.6s;
	}
</style>
