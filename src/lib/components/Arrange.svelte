<!--
	Wraps something a person can arrange. Normally it is just the thing; in
	Customise mode the thing goes quiet (it can't be operated) with its tools
	under it, and a hidden thing shows faded so it can be brought back.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Form } from '#lib/layers.js';
	import { customise } from '#lib/customise.svelte.js';
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
		children: Snippet;
	} = $props();

	const active = $derived(customise.on(page));
</script>

{#if active}
	<div class="arrange" class:hidden class:wide>
		<div class="quiet" inert>{@render children()}</div>
		<Tools {page} {ref} {name} {shown} {hidden} {star} {form} {list} />
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
	.hidden > .quiet {
		opacity: 0.4;
	}
</style>
