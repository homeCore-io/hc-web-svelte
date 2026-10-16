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
		children: Snippet;
	} = $props();

	const mode = $derived(view.mode(page));
</script>

{#if mode !== null}
	<div class="arrange" class:hidden class:wide class:shared={mode === 'edit'}>
		<div class="quiet" inert>{@render children()}</div>
		<Tools {page} {ref} {name} {shown} {hidden} {star} {form} {list} {added} {renamed} />
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
</style>
