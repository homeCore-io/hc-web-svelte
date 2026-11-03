<!--
	A page drawn from its document (G1): each section — its heading, what
	leads it, its cards in its layout — with the layers applied. Home and the
	rooms are both drawn here, so what one can be arranged into, so can the
	other.

	While arranging, each card goes quiet with its tools (`Arrange`), hidden
	cards show faded, and a section with nothing in it says what goes there.

	Home in the room field style (mockup A, G32) is drawn in three places: the
	big numbers across the top, the rooms' field with what's under it, and a
	column beside them (Needs attention first, G6). On a phone the column
	follows the field, and the alerts are one line after the numbers.
-->
<script lang="ts">
	import {
		applyPage,
		drawn,
		presentRefs,
		runsOf,
		sectionRef,
		withOwn,
		type Card,
		type Column,
		type Layout,
		type Page,
		type ShownSection
	} from '#lib/page.js';
	import { kindOf, type Place } from '#lib/kinds.js';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { fieldPlan, roomBox, type Plot } from '#lib/roomBox.js';
	import { homeStyle } from '#lib/styles.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { added, type Change, type Form, type Layered } from '#lib/layers.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Arrange from './Arrange.svelte';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import SectionTools from './SectionTools.svelte';
	import KindView from './KindView.svelte';
	import { adding } from '#lib/adding.svelte.js';

	let {
		page,
		making = $bindable(false)
	}: {
		page: Page;
		/** New section is open — also from outside, as an empty page offers it. */
		making?: boolean;
	} = $props();

	pluginUis.ensure();
	const key = $derived(page.id);
	const mode = $derived(view.mode(key));
	const arranging = $derived(mode !== null);
	// A person's own changes size their favourites; Edit shows the household's alone.
	const mine = $derived(mode === 'edit' ? [] : personal.changes(key));
	// The page with the sections people made (G17) — the household's, and in
	// Customise or normally the person's own too.
	const full = $derived(withOwn(page, view.changes(key), mine));
	// Home in the room field style (G32), or a page that asks for them (a Lit
	// room, 13 §8.2): drawn in columns.
	const field = $derived(
		!!page.columns ||
			(page.id === 'home' && homeStyle(view.changes(key), kindOptions.shellRooms(key)) === 'field')
	);
	const shown = $derived(applyPage(full, view.changes(key), mine, { arranging, field }));

	$effect(() => {
		if (editing.on(key)) editing.present = presentRefs(full);
	});

	// The sections that can move, as they are drawn — for up and down; in
	// the room field, among those in the same column.
	const movable = $derived(
		shown.sections.filter((s) => !s.hidden && !s.section.fixed && drawn(s, arranging))
	);
	// The rooms lead the main column: what's put there goes under them.
	const leads = (s: ShownSection) => field && s.section.id === 'rooms';
	const peers = (s: ShownSection) =>
		leads(s)
			? []
			: movable
					.filter((m) => !field || (m.column === s.column && !leads(m)))
					.map((m) => sectionRef(m.section.id));
	const inColumn = (c: Column) => {
		const here = shown.sections.filter((s) => s.column === c && drawn(s, arranging));
		return [...here.filter(leads), ...here.filter((s) => !leads(s))];
	};
	// The alerts, as the phone's one line after the numbers.
	const briefAlerts = $derived(
		shown.sections.find((s) => s.section.id === 'alerts')?.groups[0]?.shown[0]
	);
	/** A field's boxes in the field's plan: big or small, and how many columns and rows. */
	function planned(cards: Card[]): { card: Card; plot: Plot }[] {
		const plots = fieldPlan(
			cards.map((c) => ({
				ref: c.ref,
				box:
					c.kind === 'room'
						? roomBox(
								c.devices,
								c.devices.map((d) => cardFor(d, clock.now)),
								devices.byId,
								kindOptions.of(key, 'room', c.ref, ROOM_BUILT_IN)
							)
						: undefined
			}))
		);
		const byRef = new Map(plots.map((p) => [p.ref, p]));
		// While arranging, in the order up and down move them.
		return arranging
			? cards.map((card) => ({ card, plot: byRef.get(card.ref)! }))
			: plots.map((plot) => ({ card: cards.find((c) => c.ref === plot.ref)!, plot }));
	}
	const listOf = (g: Layered<Card>) => (arranging ? [...g.shown, ...g.hidden] : g.shown);

	// A kind's settings sheet, for one card (G2). A room's settings are its box's.
	let setting = $state<{ card: Card; name: string; form?: Form } | null>(null);
	// Every room's box, from the Rooms section's tools.
	let everyRoom = $state<{ rooms: Card[]; names: Record<string, string> } | null>(null);
	// Rooms in the sidebar, with their status (G3): their boxes' settings show there.
	const sideRooms = $derived(page.id === 'home' && kindOptions.shellRooms(key) === 'status');
	// Add (G-c): the sections it can add into, as headed here — and where
	// added things go when none is said, Pinned, a made page's Cards, or
	// "Also here", which a room doesn't have until something's in it.
	const home = $derived(
		page.id === 'home' ? 'pinned' : page.id.startsWith('page:') ? 'cards' : 'added'
	);
	// Each with its cards in order, for the sheet's spots (G-f).
	const into = $derived.by(() => {
		const out = shown.sections
			.filter((s) => s.section.accepts)
			.map((s) => ({
				id: s.section.id,
				title: s.title,
				cards: s.groups.flatMap((g) =>
					g.shown.map((c) => ({ ref: c.ref, name: g.name(c.ref) ?? kindOf(c).name(c) }))
				)
			}));
		return out.some((s) => s.id === home)
			? out
			: [{ id: home, title: 'Also here', cards: [] }, ...out];
	});
	// Add in place (G-f): a + in the gap before each card a section took, and
	// after its last; where the sheet will add shows as "Goes here".
	function spots(from: string, card: Card, name: string) {
		const sec = into.find((s) => s.id === from);
		if (!sec) return {};
		const at = (before: string | null) => () => adding.open(key, from, before);
		return {
			addBefore: { label: `Add to ${sec.title}, before ${name}`, pick: at(card.ref) },
			addAfter:
				sec.cards.at(-1)?.ref === card.ref
					? { label: `Add to ${sec.title}, after ${name}`, pick: at(null) }
					: undefined
		};
	}
	const ghostIn = (sec: string) => adding.page === key && (adding.into ?? home) === sec;
	/** The spot comes into view as it's chosen, from the page or the sheet. */
	function seen(node: HTMLElement) {
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		node.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
	}
	// The layer this screen changes (G18): the household's in Edit, the person's in Customise.
	const layer = $derived(mode === 'edit' ? view.changes(key) : personal.changes(key));
	const mineSection = (own: 'house' | 'person' | undefined) =>
		own !== undefined && own === (mode === 'edit' ? 'house' : 'person');
	/** An own section away, and what this layer added into it with it (G17). */
	function removeSection(id: string) {
		const r = sectionRef(id);
		const inside = layer.filter(
			(c): c is Extract<Change, { op: 'add' }> => c.op === 'add' && c.into === id
		);
		for (const c of inside)
			if (added(layer).includes(c.ref)) view.change(key, { op: 'remove', ref: c.ref });
		view.change(key, { op: 'remove', ref: r });
	}
	// Leaving Customise or Edit closes Add.
	$effect(() => {
		if (!arranging && adding.page === key) adding.close();
	});
	// A card just added that needs setting (a note, a chart): its settings open as it appears.
	$effect(() => {
		const r = adding.settle;
		if (r === null) return;
		const card = shown.sections
			.flatMap((s) => s.groups.flatMap((g) => [...g.shown, ...g.hidden]))
			.find((c) => c.ref === r);
		if (!card) return;
		adding.settle = null;
		setting = { card, name: kindOf(card).name(card) };
	});
	// Where a card can be moved (G22): another section shown here that takes
	// cards. A room's box stays among the rooms; favourites and the house's
	// own pieces don't leave theirs.
	const targets = $derived(
		shown.sections
			.filter((s) => s.section.accepts && !s.hidden)
			.map((s) => ({ id: s.section.id, title: s.title }))
	);
	const moveTargets = (card: Card, from: string) =>
		card.kind === 'room' ? [] : targets.filter((t) => t.id !== from);
	const hasSettings = (card: Card, layout: Layout) => {
		const k = kindOf(card);
		return (
			(k.settable ? k.settable(card) : k.options !== null) &&
			(card.kind !== 'room' || layout !== 'list' || sideRooms)
		);
	};
</script>

{#snippet piece(
	card: Card,
	g?: Layered<Card>,
	favourites = false,
	layout: Layout = 'grid',
	from?: string,
	place?: Place,
	sized?: Form
)}
	{@const kind = kindOf(card)}
	{@const label = g?.name(card.ref)}
	{@const form = kind.form(card, g?.form(card.ref))}
	<!-- Beside the rooms, a card is as wide as the column: never Large (G32). -->
	{@const drawnAs = sized ?? (place === 'side' && form === 'large' ? 'standard' : form)}
	{@const name = label ?? kind.name(card)}
	{@const at =
		from !== undefined && layout !== 'field' && g !== undefined && !g.hidden.includes(card)
			? spots(from, card, name)
			: {}}
	{#if g === undefined}
		<KindView {card} page={key} cardTools={page.cardTools} {place} />
	{:else}
		<Arrange
			page={key}
			ref={card.ref}
			{name}
			shown={g.shown.map((c) => c.ref)}
			hidden={g.hidden.includes(card)}
			star={kind.star}
			form={kind.forms(card).length > 0 ? form : undefined}
			wide={drawnAs === 'large'}
			list={favourites ? 'favourites' : 'page'}
			added={card.added ?? false}
			renamed={label !== undefined}
			moveTo={from !== undefined ? moveTargets(card, from) : undefined}
			settings={hasSettings(card, layout) ? () => (setting = { card, name, form }) : undefined}
			addBefore={at.addBefore}
			addAfter={at.addAfter}
			axis={layout === 'list' || (place === 'side' && layout !== 'row') ? 'y' : 'x'}
		>
			<KindView
				{card}
				form={drawnAs}
				{label}
				page={key}
				cardTools={page.cardTools}
				config={g.config(card.ref)}
				{layout}
				{place}
			/>
		</Arrange>
	{/if}
{/snippet}

{#snippet ghost()}
	<div class="ghost" use:seen><Plus size={14} aria-hidden="true" />Goes here</div>
{/snippet}

{#snippet block(s: ShownSection, place?: Place)}
	{@const sec = s.section}
	<section
		aria-label={sec.bare ? s.title : undefined}
		class:in-sidebar={sec.id === 'rooms' && sideRooms && !arranging}
		class:alerts={field && sec.id === 'alerts'}
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
					shown={peers(s)}
					hidden={s.hidden}
					renamed={s.renamed}
					add={sec.accepts ? () => adding.open(key, sec.id) : undefined}
					layouts={sec.layouts}
					layout={s.layout}
					config={s.config}
					column={field && (sec.field?.movable ?? sec.field === undefined) ? s.column : undefined}
					mine={mineSection(sec.own)}
					remove={sec.own ? () => removeSection(sec.id) : undefined}
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
		{:else if field && s.layout === 'field' && !arranging}
			<!-- The rooms' heading in the field, with what the glow means (mockup A). -->
			<div class="head">
				<h2 class="section-label">{s.title}</h2>
				<span class="legend">Brighter is more of it on <span class="ramp"></span></span>
			</div>
		{:else if (place === 'side' && sec.bare) || (!sec.bare && !sec.headless)}
			<h2 class="section-label">{s.title}</h2>
		{/if}
		{#if s.hidden}
			<!-- Hidden: only its heading, to bring it back. -->
		{:else if sec.bare}
			{#each s.groups as g, i (i)}
				{#each listOf(g) as card (card.ref)}{@render piece(
						card,
						undefined,
						false,
						'grid',
						undefined,
						place
					)}{/each}
			{/each}
		{:else}
			{#if sec.lead}{@render piece(sec.lead, undefined, false, 'grid', undefined, place)}{/if}
			{#if arranging && sec.hint && s.groups.every((g) => listOf(g).length === 0)}
				{#if ghostIn(sec.id)}<div class={s.layout}>{@render ghost()}</div>{/if}
				<p class="hint">{sec.hint}</p>
			{:else}
				{#each s.groups.length > 0 ? s.groups : [null] as g, i (i)}
					{@const runs = g ? runsOf(listOf(g), s.layout) : [{ layout: s.layout, cards: [] }]}
					{@const lastGroup = s.groups.length === 0 || i === s.groups.length - 1}
					{#each runs as run, j (j)}
						{#if g && run.layout === 'field'}
							<div class="fieldwrap">
								<div class="field" class:arranging>
									{#each planned(run.cards) as { card, plot } (card.ref)}
										<div
											class="cell"
											style={`--cols: ${plot.cols}; --rows: ${plot.rows}; --phone-cols: ${plot.phoneCols}; --phone-rows: ${plot.phoneRows}`}
										>
											{@render piece(
												card,
												g,
												sec.favourites,
												s.layout,
												sec.accepts ? sec.id : undefined,
												place,
												plot.big ? 'large' : 'compact'
											)}
										</div>
									{/each}
								</div>
							</div>
							{#if field && !arranging && sec.id === 'rooms'}
								{@const n = run.cards.filter((c) => c.kind === 'room').length}
								<p class="foot">
									Sized by what is in each room · {n}
									{n === 1 ? 'room' : 'rooms'} · tap one to open it
								</p>
							{/if}
						{:else}
							{#if run.layout === 'fold' && !arranging}
								<!-- Folded away until opened (13 §7, More): a line each when it is. -->
								<details class="fold">
									<summary
										>{s.title}<small>
											· {run.cards.length}
											{run.cards.length === 1 ? 'thing' : 'things'}</small
										></summary
									>
									<div class="lines">
										{#each run.cards as card (card.ref)}
											{#if g}{@render piece(card, g, false, 'lines', undefined, place)}{/if}
										{/each}
									</div>
								</details>
							{:else}
								<div class={run.layout}>
									{#each run.cards as card (card.ref)}
										{#if g}
											{#if ghostIn(sec.id) && adding.before === card.ref}{@render ghost()}{/if}
											{@render piece(
												card,
												g,
												sec.favourites,
												s.layout,
												sec.accepts ? sec.id : undefined,
												place
											)}
										{/if}
									{/each}
									{#if ghostIn(sec.id) && adding.before === null && lastGroup && j === runs.length - 1}
										{@render ghost()}
									{/if}
								</div>
							{/if}
						{/if}
					{/each}
				{/each}
			{/if}
		{/if}
	</section>
{/snippet}

{#if field}
	<!-- The room field (mockup A): the band, then the rooms with what's beside them. -->
	<div class="fieldpage">
		{#each inColumn('band') as s (s.section.id)}{@render block(s, 'band')}{/each}
		{#if briefAlerts && !arranging}
			<div class="brief">
				{@render piece(briefAlerts, undefined, false, 'grid', undefined, 'brief')}
			</div>
		{/if}
		<div class="cols">
			<div class="column">
				{#each inColumn('main') as s (s.section.id)}{@render block(s)}{/each}
			</div>
			<div class="column side" role="complementary" aria-label="Beside the rooms">
				{#each inColumn('side') as s (s.section.id)}{@render block(s, 'side')}{/each}
			</div>
		</div>
	</div>
{:else}
	{#each shown.sections as s (s.section.id)}
		{#if drawn(s, arranging)}{@render block(s)}{/if}
	{/each}
{/if}

{#if arranging}
	<button class="new-section" onclick={() => (making = true)}
		><Plus size={16} aria-hidden="true" />New section</button
	>
{/if}

<!-- The sheets load when first opened: they aren't Home's first paint (06 V5). -->
{#if making && arranging}
	{#await import('./NewSection.svelte') then { default: NewSection }}
		<NewSection
			page={key}
			order={shown.sections
				.filter((s) => !s.hidden && !s.section.fixed && drawn(s, arranging))
				.map((s) => ({ ref: sectionRef(s.section.id), title: s.title }))}
			close={() => (making = false)}
		/>
	{/await}
{/if}
{#if adding.page === key && arranging}
	{#await import('./AddCard.svelte') then { default: AddCard }}
		{#if adding.page === key}
			<AddCard {key} sections={into} {home} close={() => adding.close()} />
		{/if}
	{/await}
{/if}
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
				form={setting.form}
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
	.new-section {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		border: 1px dashed var(--accent);
		border-radius: 999px;
		background: none;
		color: var(--accent);
		font-weight: 700;
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
	/* Switches packed into a panel, as many to a row as fit (13 §8). */
	.panel {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 8px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 20px;
		background: color-mix(in srgb, var(--bg) 60%, var(--surface));
	}
	/* A look's layouts (13 §8): scenes as a row of swatches; one box of short
	   lines (Watching); folded away (More), a box of lines once opened. */
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 12px;
	}
	.lines,
	.fold {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: 18px;
		background: var(--surface);
		overflow: hidden;
	}
	.lines > :global(* + *) {
		border-top: 1px solid var(--line);
	}
	details.fold summary {
		padding: 12px 16px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
	}
	details.fold summary small {
		color: var(--ink-muted);
		font-weight: 500;
	}
	details.fold .lines {
		border: none;
		border-top: 1px solid var(--line);
		border-radius: 0;
	}
	@media (max-width: 599px) {
		.swatches {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
		}
		.swatches > :global(*) {
			flex: none;
		}
	}
	/* Where Add will put what's picked next (G-f). */
	.ghost {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 72px;
		box-sizing: border-box;
		border: 2px dashed var(--accent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		color: var(--accent);
		font-size: 13px;
		font-weight: 700;
		/* Clear of the bottom bar; on a phone, of Add's sheet under the page too. */
		scroll-margin: 24px 24px 96px;
	}
	@media (max-width: 899px) {
		.ghost {
			scroll-margin-bottom: calc(55dvh + 24px);
		}
	}
	/* The big numbers take the whole width, whatever the list's columns. */
	.list > :global(.clip),
	.list > :global(.arrange:has(.clip)) {
		grid-column: 1 / -1;
	}
	/* A heading spans its section, whatever its layout (G-c). */
	.grid > :global(.span-all),
	.grid > :global(.arrange:has(.span-all)),
	.row > :global(.span-all),
	.row > :global(.arrange:has(.span-all)),
	.list > :global(.span-all),
	.list > :global(.arrange:has(.span-all)) {
		grid-column: 1 / -1;
	}
	/* The room field (mockup A): twelve columns of 84px rows, the busiest
	   rooms biggest; on a phone, four columns of 74px. */
	.fieldwrap {
		container: field / inline-size;
	}
	.field {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		grid-auto-rows: 84px;
		grid-auto-flow: row dense;
		gap: 8px;
	}
	.cell {
		display: grid;
		min-width: 0;
		grid-column: span var(--cols);
		grid-row: span var(--rows);
	}
	@container field (max-width: 559px) {
		.field {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			grid-auto-rows: 74px;
			gap: 7px;
		}
		.cell {
			grid-column: span var(--phone-cols);
			grid-row: span var(--phone-rows);
		}
	}
	/* While arranging, in order and the same size, with room for the tools. */
	.field.arranging {
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		grid-auto-rows: auto;
		grid-auto-flow: row;
	}
	.field.arranging .cell {
		grid-column: auto;
		grid-row: auto;
		min-height: 150px;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.ramp {
		width: 72px;
		height: 8px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: linear-gradient(
			90deg,
			var(--surface),
			color-mix(in srgb, var(--fill) 80%, transparent)
		);
	}
	.foot {
		margin: 0;
		font-size: 12px;
		color: var(--ink-muted);
	}
	/* Home in the room field: the band, then the rooms and the column beside them. */
	.fieldpage {
		container: fieldpage / inline-size;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.cols,
	.column {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}
	.side > section + section {
		padding-top: 18px;
		border-top: 1px solid var(--line);
	}
	/* On a phone the alerts are the one line after the numbers. */
	.side > .alerts {
		display: none;
	}
	.side > .alerts + section {
		padding-top: 0;
		border-top: none;
	}
	/* Beside the rooms: one card a row, scenes and modes as chips. */
	.side :global(:is(.grid, .list, .tiles)) {
		grid-template-columns: minmax(0, 1fr);
	}
	.side :global(.row) {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.side :global(.scene) {
		min-height: 34px;
		padding: 0 12px;
		border-radius: 11px;
		box-shadow: none;
		font-size: 13px;
		font-weight: 500;
	}
	.side :global(.scene .orb) {
		display: none;
	}
	.side :global(.modes) {
		gap: 6px;
	}
	.side :global(.mode) {
		height: 34px;
		padding: 0 12px;
		font-size: 13px;
	}
	.side :global(.mode svg) {
		display: none;
	}
	.side :global(.mode[aria-pressed='true']) {
		background: var(--lit-bg);
		border-color: var(--lit-card-line);
		color: var(--lit-ink);
	}
	@container fieldpage (min-width: 860px) {
		.cols {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
			gap: 28px;
			align-items: start;
		}
		.side {
			padding-left: 24px;
			border-left: 1px solid var(--line);
		}
		.side > .alerts {
			display: flex;
		}
		.side > .alerts + section {
			padding-top: 18px;
			border-top: 1px solid var(--line);
		}
		.brief {
			display: none;
		}
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
