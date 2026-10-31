<!--
	A page drawn from its document (G1): each section — its heading, what
	leads it, its cards in its layout — with the layers applied. Home and the
	rooms are both drawn here, so what one can be arranged into, so can the
	other.

	While arranging, each card goes quiet with its tools (`Arrange`), hidden
	cards show faded, and a section with nothing in it says what goes there.
-->
<script lang="ts">
	import { applyPage, drawn, presentRefs, type Card, type Page } from '#lib/page.js';
	import { kindOf } from '#lib/kinds.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import type { Layered } from '#lib/layers.js';
	import Arrange from './Arrange.svelte';

	let { page }: { page: Page } = $props();

	pluginUis.ensure();
	const key = $derived(page.id);
	const mode = $derived(view.mode(key));
	const arranging = $derived(mode !== null);
	// A person's own changes size their favourites; Edit shows the household's alone.
	const mine = $derived(mode === 'edit' ? [] : personal.changes(key));
	const shown = $derived(applyPage(page, view.changes(key), mine, { arranging }));

	$effect(() => {
		if (editing.on(key)) editing.present = presentRefs(page);
	});

	const listOf = (g: Layered<Card>) => (arranging ? [...g.shown, ...g.hidden] : g.shown);
</script>

{#snippet piece(card: Card, g?: Layered<Card>, favourites = false)}
	{@const kind = kindOf(card)}
	{@const label = g?.name(card.ref)}
	{@const form = kind.form(card, g?.form(card.ref))}
	{@const Draw = kind.component}
	{#if g === undefined}
		<Draw {card} page={key} cardTools={page.cardTools} />
	{:else}
		<Arrange
			page={key}
			ref={card.ref}
			name={label ?? kind.name(card)}
			shown={g.shown.map((c) => c.ref)}
			hidden={g.hidden.includes(card)}
			star={kind.star}
			form={kind.forms(card).length > 0 ? form : undefined}
			wide={form === 'large'}
			list={favourites ? 'favourites' : 'page'}
			added={card.added ?? false}
			renamed={label !== undefined}
		>
			<Draw
				{card}
				{form}
				{label}
				page={key}
				cardTools={page.cardTools}
				config={g.config(card.ref)}
			/>
		</Arrange>
	{/if}
{/snippet}

{#each shown.sections as s (s.section.id)}
	{#if drawn(s, arranging)}
		{@const sec = s.section}
		<section class:faded={s.hidden} aria-label={sec.bare ? s.title : undefined}>
			{#if sec.bare}
				{#each s.groups as g, i (i)}
					{#each listOf(g) as card (card.ref)}{@render piece(card)}{/each}
				{/each}
			{:else}
				<h2 class="section-label">{s.title}</h2>
				{#if sec.lead}{@render piece(sec.lead)}{/if}
				{#if arranging && sec.hint && s.groups.every((g) => listOf(g).length === 0)}
					<p class="hint">{sec.hint}</p>
				{:else}
					{#each s.groups.length > 0 ? s.groups : [null] as g, i (i)}
						<div class={sec.layout}>
							{#if g}
								{#each listOf(g) as card (card.ref)}
									{@render piece(card, g, sec.favourites)}
								{/each}
							{/if}
						</div>
					{/each}
				{/if}
			{/if}
		</section>
	{/if}
{/each}

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.faded {
		opacity: 0.5;
	}
	.hint {
		color: var(--ink-muted);
		margin: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		align-items: start;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	@media (min-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
		.row {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
		.list {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
</style>
