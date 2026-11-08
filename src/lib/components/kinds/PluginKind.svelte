<!-- A plugin's own card, added to the page, with its settings here (D9b). -->
<script lang="ts">
	import { FORM_CELLS } from '#lib/freePage.js';
	import type { KindProps } from '#lib/kinds.js';
	import PluginCard from '../PluginCard.svelte';

	let { card, form, config, cells }: KindProps<'plugin'> = $props();

	// Its element draws only its forms (14 §7): in a place bigger than its
	// largest, it keeps that size, centered, rather than stretching.
	const cap = $derived.by(() => {
		// Its forms in any order: the largest is the last of ours it has.
		const has = (['compact', 'standard', 'large'] as const).filter(
			(f) => !card.forms?.length || card.forms.includes(f)
		);
		const largest = FORM_CELLS[has.at(-1) ?? 'large'];
		return cells && (cells.w > largest.w || cells.h > largest.h) ? largest : undefined;
	});
</script>

{#if cap && cells}
	<div
		class="capped"
		style={`--cw: ${cells.w}; --mw: ${Math.min(cap.w, cells.w)}`}
	>
		<PluginCard cardId={card.ref} {form} {config} />
	</div>
{:else}
	<PluginCard cardId={card.ref} {form} {config} />
{/if}

<style>
	.capped {
		display: grid;
		place-items: center;
	}
	/* Its largest form's columns, out of the ones it has, the gaps between them
	   counted; its own height, so a taller drawing still gets its rows. */
	.capped > :global(*) {
		width: calc(
			(100% + var(--feel-gap, 10px)) * var(--mw) / var(--cw) - var(--feel-gap, 10px)
		);
	}
</style>
