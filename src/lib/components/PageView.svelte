<!--
	A page drawn from its document (G1): each section — its heading, what
	leads it, its cards in its layout — with the layers applied. Home and the
	rooms are both drawn here, so what one can be arranged into, so can the
	other.

	While arranging, each card goes quiet with its tools (`Arrange`), hidden
	cards show faded, and a section with nothing in it says what goes there.
-->
<script lang="ts">
	import { applyPage, drawn, presentRefs, sectionRef, type Card, type Page } from '#lib/page.js';
	import { kindOf } from '#lib/kinds.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import type { Layered } from '#lib/layers.js';
	import Arrange from './Arrange.svelte';
	import SectionTools from './SectionTools.svelte';

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

	// The sections that can move, as they are drawn — for up and down.
	const movable = $derived(
		shown.sections
			.filter((s) => !s.hidden && !s.section.fixed && drawn(s, arranging))
			.map((s) => sectionRef(s.section.id))
	);
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
		<section aria-label={sec.bare ? s.title : undefined}>
			{#if arranging && !sec.fixed}
				<div class="head">
					<h2 class="section-label" class:faded={s.hidden}>
						{s.title}{#if s.hidden}<span class="note"> · hidden</span>{/if}
					</h2>
					<SectionTools
						page={key}
						ref={sectionRef(sec.id)}
						title={s.title}
						shown={movable}
						hidden={s.hidden}
						renamed={s.renamed}
					/>
				</div>
			{:else if !sec.bare}
				<h2 class="section-label">{s.title}</h2>
			{/if}
			{#if s.hidden}
				<!-- Hidden: only its heading, to bring it back. -->
			{:else if sec.bare}
				{#each s.groups as g, i (i)}
					{#each listOf(g) as card (card.ref)}{@render piece(card)}{/each}
				{/each}
			{:else}
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
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.head h2 {
		margin: 0;
	}
	.faded {
		opacity: 0.5;
	}
	.note {
		text-transform: none;
		letter-spacing: 0;
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
