<!--
	A page drawn from its document (G1): each section — its heading, what
	leads it, its cards in its layout — with the layers applied. Home and the
	rooms are both drawn here, so what one can be arranged into, so can the
	other.

	While arranging, each card goes quiet with its tools (`Arrange`), hidden
	cards show faded, and a section with nothing in it says what goes there.
-->
<script lang="ts">
	import {
		applyPage,
		drawn,
		presentRefs,
		sectionRef,
		type Card,
		type Layout,
		type Page
	} from '#lib/page.js';
	import { kindOf } from '#lib/kinds.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import type { Layered } from '#lib/layers.js';
	import Arrange from './Arrange.svelte';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
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

	// A kind's settings sheet, for one card (G2). A room's settings are its box's.
	let setting = $state<{ card: Card; name: string } | null>(null);
	// Every room's box, from the Rooms section's tools.
	let everyRoom = $state<{ rooms: Card[]; names: Record<string, string> } | null>(null);
	// Rooms in the sidebar, with their status (G3): their boxes' settings show there.
	const sideRooms = $derived(page.id === 'home' && kindOptions.shellRooms(key) === 'status');
	const hasSettings = (card: Card, layout: Layout) =>
		kindOf(card).options !== null && (card.kind !== 'room' || layout !== 'list' || sideRooms);
</script>

{#snippet piece(card: Card, g?: Layered<Card>, favourites = false, layout: Layout = 'grid')}
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
			settings={hasSettings(card, layout)
				? () => (setting = { card, name: label ?? kind.name(card) })
				: undefined}
		>
			<Draw
				{card}
				{form}
				{label}
				page={key}
				cardTools={page.cardTools}
				config={g.config(card.ref)}
				{layout}
			/>
		</Arrange>
	{/if}
{/snippet}

{#each shown.sections as s (s.section.id)}
	{#if drawn(s, arranging)}
		{@const sec = s.section}
		<section
			aria-label={sec.bare ? s.title : undefined}
			class:in-sidebar={sec.id === 'rooms' && sideRooms && !arranging}
		>
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
						settings={sec.id === 'rooms' && (s.layout !== 'list' || sideRooms)
							? {
									label: 'Every room’s box',
									open: () =>
										(everyRoom = {
											rooms: s.groups.flatMap((g) => [...g.shown, ...g.hidden]),
											names: Object.fromEntries(
												s.groups.flatMap((g) =>
													[...g.shown, ...g.hidden].map((c) => [
														c.ref,
														g.name(c.ref) ?? kindOf(c).name(c)
													])
												)
											)
										})
								}
							: undefined}
					/>
				</div>
			{:else if !sec.bare && !sec.headless}
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
						<div class={s.layout}>
							{#if g}
								{#each listOf(g) as card (card.ref)}
									{#if s.layout === 'field'}
										<div class={`cell s${kindOf(card).span?.(card) ?? 1}`}>
											{@render piece(card, g, sec.favourites, s.layout)}
										</div>
									{:else}
										{@render piece(card, g, sec.favourites, s.layout)}
									{/if}
								{/each}
							{/if}
						</div>
					{/each}
				{/if}
			{/if}
		</section>
	{/if}
{/each}

<!-- The settings sheets load when first opened: they aren't Home's first paint (06 V5). -->
{#if everyRoom}
	{#await import('./EveryRoom.svelte') then { default: EveryRoom }}
		{#if everyRoom}
			<EveryRoom
				page={key}
				rooms={everyRoom.rooms.filter((c) => c.kind === 'room')}
				names={everyRoom.names}
				close={() => (everyRoom = null)}
			/>
		{/if}
	{/await}
{/if}
{#if setting}
	{#await import('./CardOptions.svelte') then { default: CardOptions }}
		{#if setting}
			<CardOptions
				page={key}
				card={setting.card}
				name={setting.name}
				close={() => (setting = null)}
			/>
		{/if}
	{/await}
{/if}

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* Where the sidebar lists the rooms with their status, Home doesn't again (G12). */
	@media (min-width: 1100px) {
		:global(html:not([data-sidebar='folded'])) .in-sidebar {
			display: none;
		}
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
	/* The big numbers take the whole width, whatever the list's columns. */
	.list > :global(.clip),
	.list > :global(.arrange:has(.clip)) {
		grid-column: 1 / -1;
	}
	/* The room field (G-b): boxes as wide as what's in them, rows filled. */
	.field {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.cell {
		display: grid;
		min-width: 0;
		height: 150px;
	}
	.cell.s1 {
		flex: 1 1 140px;
	}
	.cell.s2 {
		flex: 2 1 220px;
	}
	.cell.s3 {
		flex: 3 1 320px;
	}
	.field :global(.arrange),
	.cell:has(:global(.arrange)) {
		height: auto;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		grid-auto-rows: 150px;
		gap: 10px;
	}
	.tiles:has(:global(.arrange)) {
		grid-auto-rows: auto;
	}
	@media (min-width: 700px) {
		.tiles {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
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
