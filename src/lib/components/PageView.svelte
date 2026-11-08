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
	import { readStack, stackable, stackBase, stackRows } from '#lib/stack.js';
	import { grouped, putIn, setStack, takeOut } from '#lib/stacking.js';
	import { fieldPlan, roomBox, type Plot } from '#lib/roomBox.js';
	import { homeStyle } from '#lib/styles.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { added, newId, ref as refOf, type Change, type Form, type Layered } from '#lib/layers.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Arrange from './Arrange.svelte';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import SectionTools from './SectionTools.svelte';
	import KindView from './KindView.svelte';
	import { adding } from '#lib/adding.svelte.js';
	import { drag } from '#lib/drag.svelte.js';
	import { refusal } from '#lib/drag/rules.js';
	import {
		COLS,
		fit,
		freeze,
		land,
		layout as freeLayout,
		narrow,
		step as stepIn,
		tidy,
		where,
		type Box,
		type Placed
	} from '#lib/free.js';
	import type { CellsHost } from '#lib/drag/cells.js';
	import { lookHere } from '#lib/look.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import {
		areaFor,
		areasOf,
		narrowArea,
		sizeOf,
		type AreaAt,
		type Family,
		type Rule
	} from '#lib/looks/model.js';
	/** The family a look draws a device as, by its kind (13 §6), for its drawing's range. */
	const familyOf = (scene: boolean, kind: string): Family | null =>
		scene
			? 'scenes'
			: kind === 'light'
				? 'lights'
				: ['switch', 'outlet', 'fan'].includes(kind)
					? 'switches'
					: ['door', 'window', 'garage', 'gate', 'contact_sensor', 'lock'].includes(kind)
						? 'doors'
						: ['temperature_sensor', 'weather_station'].includes(kind)
							? 'readings'
							: ['media_player', 'tv', 'speaker'].includes(kind)
								? 'media'
								: null;
	import {
		FORM_CELLS,
		formFor,
		headingRef,
		hiddenIn,
		piecesOf,
		rangeOf,
		within,
		type Range,
		type Size
	} from '#lib/freePage.js';

	let {
		page,
		base = [],
		making = $bindable(false)
	}: {
		page: Page;
		/** Changes it starts from, before anyone's: a look editor's preview of Home (13 §11). */
		base?: Change[];
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
	const changes = $derived(base.length ? [...base, ...view.changes(key)] : view.changes(key));
	const full = $derived(withOwn(page, changes, mine));
	// Home in the room field style (G32), or a page that asks for them (a Lit
	// room, 13 §8.2): drawn in columns.
	const field = $derived(
		!!page.columns ||
			(page.id.endsWith('home') && homeStyle(changes, kindOptions.shellRooms(key)) === 'field')
	);
	const shown = $derived(applyPage(full, changes, mine, { arranging, field }));

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
	// A stack (13 §13.2): the rows of the grid it takes while arranging, and
	// for its sheet, the page's other stacks and what it draws as cards.
	const stackOf = (card: Card, large: boolean) =>
		card.kind === 'stack'
			? readStack(kindOptions.of(key, 'stack', card.ref, stackBase(card)), large)
			: undefined;
	const stackRowsOf = (card: Card, large: boolean) => {
		const s = stackOf(card, large);
		return s && card.kind === 'stack'
			? stackRows(s, card.held?.length ?? s.things.length)
			: undefined;
	};
	const allCards = $derived(
		shown.sections.flatMap((s) => s.groups.flatMap((g) => [...g.shown, ...g.hidden]))
	);
	const stacksHere = $derived(
		allCards
			.filter((c) => c.kind === 'stack')
			.map((c) => ({
				ref: c.ref,
				name: readStack(kindOptions.of(key, 'stack', c.ref, stackBase(c))).name || 'Stack'
			}))
	);
	// What a look's grouping put in its stacks, for putting things in and out of them.
	$effect(() => {
		for (const c of allCards) if (c.kind === 'stack' && c.things) grouped.set(c.ref, c.things);
	});
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
	// Where "Goes here" shows: where a dragged card would land (13 §9.2), else
	// where the Add sheet will add.
	const spot = $derived(
		drag.page === key && drag.ref !== null
			? drag.into !== null
				? { into: drag.into, before: drag.before }
				: null
			: adding.page === key
				? { into: adding.into ?? home, before: adding.before }
				: null
	);
	const ghostIn = (sec: string) => spot?.into === sec;

	// ---- dragging (13 §9.2): the pointer work loads only while arranging ----
	let root = $state<HTMLElement>();
	$effect(() => {
		if (!arranging || !root) return;
		const el = root;
		let stop: (() => void) | undefined;
		let gone = false;
		if (freeHere)
			void import('#lib/drag/cells.js').then((m) => {
				if (!gone) stop = m.start(el, cellsHost);
			});
		else
			void import('#lib/drag/controller.js').then((m) => {
				if (!gone) stop = m.start(el, host);
			});
		return () => {
			gone = true;
			stop?.();
		};
	});
	const cardName = (ref: string) => {
		for (const s of shown.sections)
			for (const g of s.groups) {
				const c = [...g.shown, ...g.hidden].find((x) => x.ref === ref);
				if (c) return g.name(c.ref) ?? kindOf(c).name(c);
			}
		return 'It';
	};
	const host = {
		get page() {
			return key;
		},
		/** Why a section won't take a card (13 §9.4); null when it will. */
		refuses(section: string, _ref: string, kind: string, from: string): string | null {
			const s = shown.sections.find((x) => x.section.id === section);
			return refusal(s && { ...s.section, title: s.title }, kind, from);
		},
		dropCard(ref: string, into: string, before: string | null) {
			view.change(key, { op: 'move', ref, before, into });
			adding.added = ref;
			const title = shown.sections.find((x) => x.section.id === into)?.title ?? '';
			drag.said = `${cardName(ref)} moved ${before ? 'before ' + cardName(before) : 'to the end'} in ${title}.`;
		},
		dropSection(id: string, before: string | null, column: string | undefined) {
			const s = shown.sections.find((x) => x.section.id === id);
			view.change(key, {
				op: 'move',
				ref: sectionRef(id),
				before: before ? sectionRef(before) : null
			});
			// Into the other column, where it may go (G32).
			const movable = s && (s.section.field?.movable ?? s.section.field === undefined);
			if (field && s && movable && (column === 'main' || column === 'side') && column !== s.column)
				view.change(key, { op: 'config', ref: sectionRef(id), config: { ...s.config, column } });
			drag.said = `${s?.title ?? 'The section'} moved.`;
		},
		stackable,
		dropInStack(ref: string, stack: string, from?: string) {
			// From the Add sheet or another room's: into the stack, with no card of its own.
			putIn(key, stack, ref, { from });
			adding.added = stack;
			const name = stacksHere.find((x) => x.ref === stack)?.name ?? 'the stack';
			drag.said = `${cardName(ref) === 'It' ? 'It' : cardName(ref)} put in ${name}.`;
		},
		dropOut(ref: string, stack: string, into: string, before: string | null) {
			takeOut(key, stack, ref);
			// Its own card where it was let go: moved, if the page has one, else added there.
			if (presentRefs(full).has(ref)) view.change(key, { op: 'move', ref, before, into });
			else view.change(key, { op: 'add', ref, into, before });
			adding.added = ref;
			const title = shown.sections.find((x) => x.section.id === into)?.title ?? '';
			drag.said = `Taken out of the stack, into ${title}.`;
		},
		dropAdd(row: HTMLElement, into: string, before: string | null) {
			adding.spot(into, before);
			row.click();
			const title = shown.sections.find((x) => x.section.id === into)?.title ?? '';
			drag.said = `${row.dataset.addName ?? 'It'} added to ${title}.`;
		}
	};
	// What just happened shows for a moment, and is read out.
	$effect(() => {
		if (!drag.said) return;
		const t = setTimeout(() => (drag.said = ''), 3500);
		return () => clearTimeout(t);
	});
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
	// A device or a scene can go into a stack on the page too (13 §13.2).
	// A free page has no sections to move a card to (N1): only its stacks.
	const moveTargets = (card: Card, from: string) =>
		card.kind === 'room'
			? []
			: [
					...(freeHere ? [] : targets.filter((t) => t.id !== from)),
					...(stackable(card.ref)
						? stacksHere.map((s) => ({ id: `stack:${s.ref}`, title: `Into stack: ${s.name}` }))
						: [])
				];
	// ---- free layout (14): a room's page and a made page are one grid ----
	// A room's page and a made page (14 §3), a look's grouped rooms too (L1).
	// Home and displays too (step 6, P6), and the look editor's previews of them (N2).
	const freeHere = $derived(/^(preview\|)?(home$|room:|page:)/.test(key));
	const here = lookHere();
	/**
	 * Where a grouped room's section starts (14 §8, A1 to A3): the area of the
	 * look its rule names; what no rule took, the last. Null: not drawn here.
	 * A page that isn't grouped has the whole width.
	 */
	function areaOf(s: ShownSection): AreaAt | null | undefined {
		if (!page.columns && !field) return undefined;
		if (s.column === 'none') return null;
		// Home's room field (G32): its band, main column and side column are Lit's areas.
		if (!page.columns) return areaFor({}, { place: s.column } as Rule);
		const g = here.def.grouping;
		return areaFor(
			g,
			g.room?.find((r) => r.id === s.section.id)
		);
	}
	/** The area a section starts in, with whether its cards are one a row (A3). */
	const areaHere = (s: ShownSection) => {
		const a = areaOf(s);
		return a ? { x: a.x, w: a.w, row: a.row, beside: narrowArea(a) } : a;
	};
	/** How a grouped room draws a section's cards: one a row in a narrow area, or across the top. */
	const placeOf = (s: ShownSection): Place | undefined => {
		const a = areaOf(s);
		return a && narrowArea(a)
			? 'side'
			: (page.columns || field) && s.column === 'band'
				? 'band'
				: undefined;
	};
	/** A grouped room's sections, a row of areas at a time (A2); in order within each. */
	const inAreaOrder = (list: ShownSection[]) =>
		page.columns || field
			? [...list].sort((x, y) => (areaOf(x)?.row ?? 0) - (areaOf(y)?.row ?? 0))
			: list;
	/**
	 * Home's room field on the grid (step 6): each room its own card, the
	 * busiest biggest, as the field plans them (G32).
	 */
	const roomPlots = $derived.by(() => {
		const rooms = shown.sections.find((s) => s.section.id === 'rooms');
		if (!freeHere || rooms?.layout !== 'field') return new Map<string, Plot>();
		return new Map(planned(rooms.groups.flatMap(listOf)).map((p) => [p.card.ref, p.plot]));
	});
	/** A room's box in cells: the busiest three rows tall, the next two, the rest two by two. */
	const roomCells = (p: Plot) => (p.big ? { w: 4, h: p.rows } : { w: 2, h: 2 });
	/** A card's size in cells (14 §7): across the page, a stack's own, a button's, by its form. */
	function cellsOf(card: Card, g: Layered<Card>, layout: Layout, as?: Form) {
		const k = kindOf(card);
		if (card.kind === 'divider') return { w: COLS, h: 1 };
		if (k.wide) return { w: COLS, h: card.kind === 'heading' ? 1 : 2 };
		// Widgets (14 §6): their usual sizes.
		if (card.kind === 'picture') return { w: 4, h: 4 };
		if (card.kind === 'clock') return { w: 3, h: 2 };
		// A forecast reads across: four wide, its rows as it needs them.
		if (card.kind === 'weather') return { w: 4, h: 4 };
		if (card.kind === 'link' || card.kind === 'space') return { w: 2, h: 1 };
		const plot = card.kind === 'room' && layout === 'field' ? roomPlots.get(card.ref) : undefined;
		if (plot) return roomCells(plot);
		const form = as ?? k.form(card, g.form(card.ref));
		if (card.kind === 'stack') {
			const large = form === 'large';
			return {
				w: Math.min(COLS, 2 * (stackOf(card, large)?.width ?? 1)),
				h: 2 * (stackRowsOf(card, large) ?? 2),
				// Its settings' width and height size it again.
				sizedBy: ['form', 'config'] as Change['op'][]
			};
		}
		if (card.kind === 'scene' || (card.kind === 'device' && card.scene) || layout === 'row')
			return form ? FORM_CELLS[form] : { w: 2, h: 1 };
		// A thermostat's dial needs room, as it has in a section's grid.
		if (card.kind === 'device' && cardFor(card.device, clock.now).kind === 'thermostat')
			return form === 'large' ? { w: 6, h: 4 } : { w: 4, h: 4 };
		return FORM_CELLS[form ?? 'standard'];
	}
	/**
	 * Rows a card's drawing needs beyond its usual size (14 §7), measured on
	 * the twelve-column grid: where it starts, and where a new one lands, it
	 * gets them, so a tall drawing (a forecast) doesn't stretch the rows
	 * beside it. Only ever grows, so it settles.
	 */
	let natural = $state<Record<string, number>>({});
	function fits(node: HTMLElement, ref: string) {
		const ro = new ResizeObserver(() => {
			const cells = node.parentElement;
			if (!cells || node.classList.contains('held')) return;
			const css = getComputedStyle(cells);
			if (css.gridTemplateColumns.split(' ').length !== COLS) return;
			const gap = parseFloat(css.rowGap) || 0;
			const rows = Math.ceil((node.offsetHeight + gap) / (56 + gap) - 0.05);
			const h = Number(node.style.getPropertyValue('--h'));
			if (rows > h && rows > (natural[ref] ?? 0)) natural = { ...natural, [ref]: rows };
		});
		ro.observe(node);
		return { destroy: () => ro.disconnect() };
	}
	const freePage = $derived.by(() => {
		if (!freeHere) return null;
		const { items, pieces } = piecesOf(
			inAreaOrder(shown.sections),
			cellsOf,
			// Rooms in the sidebar (G3) aren't on the page but while arranging.
			(s) => drawn(s, arranging) && !(s.section.id === 'rooms' && sideRooms && !arranging),
			arranging,
			areaHere,
			(s) => hiddenIn(changes, headingRef(s.section.id))
		);
		for (const it of items) it.h = Math.max(it.h, natural[it.ref] ?? 0);
		const laid = freeLayout(items, changes);
		// A look's areas read one at a time on narrower screens (N6): the area of
		// its own row whose columns it sits in, else the one it started in.
		const started = new Map(items.map((i) => [i.ref, i.area]));
		const rows = page.columns || field ? areasOf(page.columns ? here.def.grouping : {}) : [];
		const areaAt = (p: Placed) => {
			const a = started.get(p.ref);
			const row = a?.row ?? 0;
			const at = rows.find((r) => r.row === row && r.x <= p.x && p.x < r.x + r.w);
			return { row, x: at?.x ?? a?.x ?? 0 };
		};
		const by = rows.length > 0 ? areaAt : undefined;
		const heads = new Set([...pieces].filter(([, p]) => p.kind !== 'card').map(([ref]) => ref));
		return { pieces, laid, eight: narrow(laid, 8, by, heads), four: narrow(laid, 4, by, heads) };
	});

	/** A card's drawings and their usual sizes, smallest first (14 §7). */
	function formsOf(card: Card, g: Layered<Card>, layout: Layout) {
		return kindOf(card)
			.forms(card)
			.map((form) => ({ form, size: cellsOf(card, g, layout, form) as Size }));
	}
	/** How small and large a card on this page can be (14 §7). */
	function rangeHere(ref: string): Range | undefined {
		const it = freePage?.pieces.get(ref);
		if (!it) return undefined;
		if (it.kind !== 'card') return rangeOf({ ref, kind: 'heading' }, undefined, []);
		const usual = formsOf(it.card, it.g, it.section.layout).map((f) => f.size);
		const device = it.card.kind === 'device' ? cardFor(it.card.device, clock.now).kind : undefined;
		const r = rangeOf(it.card, device, usual);
		// Drawn by a drawing made in the look editor: the range it says (L4).
		const fam = it.card.kind === 'device' ? familyOf(it.card.scene, device ?? '') : null;
		const made = fam && here.def.made.find((m) => m.id === here.draws(fam) && m.family === fam);
		if (!made) return r;
		const { min, max } = sizeOf(made);
		return { ...r, min: { w: min[0], h: min[1] }, max: { w: max[0], h: max[1] }, snap: false };
	}
	/** Which drawing a card shows in its place: the largest that fits (14 §7). Not a stack's. */
	function formIn(card: Card, g: Layered<Card>, layout: Layout, place: Size): Form | undefined {
		if (card.kind === 'stack') return undefined;
		// A room's box in the field: big where there's room for its number and lines.
		if (card.kind === 'room' && layout === 'field')
			return place.w >= 4 && place.h >= 2 ? 'large' : 'compact';
		const forms = formsOf(card, g, layout);
		return forms.length > 1 ? formFor(place, forms) : undefined;
	}

	// ---- arranging a free page (14 §5) ----
	/** What a drag would make of the page, as it goes, and where the card would land. */
	let preview = $state<{ laid: Placed[] | null; foot: (Box & { label?: string }) | null }>({
		laid: null,
		foot: null
	});
	const drawnLaid = $derived(preview.laid ?? freePage?.laid ?? []);
	const boxOf = (ref: string) => freePage?.laid.find((p) => p.ref === ref);
	/** Every card's place, as one save: the first place on a page places them all (14 §4). */
	function placeAll(next: Placed[]) {
		view.changeAll(key, freeze(next));
	}
	const pieceName = (ref: string) => {
		const it = freePage?.pieces.get(ref);
		if (!it) return cardName(ref);
		if (it.kind !== 'card') return it.section.title;
		const named = it.g.name(ref) ?? stacksHere.find((x) => x.ref === ref)?.name;
		return named ?? kindOf(it.card).name(it.card);
	};
	/** Moved a cell, or sized a cell, from the keyboard; where it is now, said. */
	function cellKey(ref: string, dx: number, dy: number, size: boolean): string | undefined {
		const b = boxOf(ref);
		if (!b || !freePage) return;
		const r = rangeHere(ref);
		let to = fit(size ? { ...b, w: b.w + dx, h: b.h + dy } : { ...b, x: b.x + dx, y: b.y + dy });
		if (size && r) to = { ...to, ...within(r, to) };
		if (size) to.w = Math.min(to.w, COLS - b.x);
		const next = land(freePage.laid, ref, to, dx);
		placeAll(next);
		const at = next.find((p) => p.ref === ref)!;
		return size ? `${at.w} wide, ${at.h} tall` : where(at);
	}
	function stepCard(ref: string, by: -1 | 1) {
		if (!freePage) return;
		const next = stepIn(freePage.laid, ref, by);
		placeAll(next);
		const at = next.find((p) => p.ref === ref);
		if (at) drag.said = `${pieceName(ref)}: ${where(at)}.`;
	}
	/** The other rooms, for a room's Layout menu (L3). */
	const otherRooms = $derived(
		rooms.list
			.filter((r) => `room:${r.id}` !== key)
			.map((r) => ({ key: `room:${r.id}`, name: r.name }))
	);
	/**
	 * Add a title (N1): a title widget across the bottom of the page, its
	 * settings open to name it. The first place on a page places them all.
	 */
	function addTitle() {
		if (!freePage) return;
		const r = refOf.kind('title', newId());
		const laid = freePage.laid;
		const y = laid.reduce((n, p) => Math.max(n, p.y + p.h), 0);
		view.changeAll(key, [
			...freeze(laid),
			{ op: 'add', ref: r, into: home },
			{ op: 'place', ref: r, x: 0, y, w: COLS, h: 1 }
		]);
		adding.settle = r;
		drag.said = 'A title added at the bottom of the page. Name it, then move it where it goes.';
	}
	/** Tidy (P5): every card up as far as it goes. */
	function tidyPage() {
		if (!freePage) return;
		placeAll(tidy(freePage.laid));
		drag.said = 'Tidied: every card moved up as far as it goes.';
	}
	const cellsHost: CellsHost = {
		get page() {
			return key;
		},
		laid: () => freePage?.laid ?? [],
		range: rangeHere,
		preview(next, foot) {
			preview = { laid: next, foot };
		},
		commit(next, moved, sized) {
			placeAll(next);
			const at = next.find((p) => p.ref === moved);
			if (at)
				drag.said = sized
					? `${pieceName(moved)} is ${at.w} wide and ${at.h} tall.`
					: `${pieceName(moved)} moved: ${where(at)}.`;
		},
		stepSize(ref) {
			const it = freePage?.pieces.get(ref);
			if (it?.kind !== 'card') return;
			const k = kindOf(it.card);
			// A stack fits its things again; another card takes its next usual size.
			if (it.card.kind === 'stack') {
				setStack(key, ref, { height: 'fit' });
				drag.said = `${pieceName(ref)} fits its things.`;
				return;
			}
			const forms = k.forms(it.card);
			const form = k.form(it.card, it.g.form(ref));
			if (forms.length < 2 || !form) return;
			const next = forms[(forms.indexOf(form) + 1) % forms.length]!;
			view.change(key, { op: 'form', ref, form: next });
			drag.said = `${pieceName(ref)} is ${next} now.`;
		},
		stackable,
		taking(stack) {
			drag.page = stack ? key : drag.page;
			drag.stack = stack;
		},
		dropInStack(ref, stack) {
			// Named before it goes: in the stack, it has no card of its own.
			const name = pieceName(ref);
			host.dropInStack(ref, stack);
			const into = stacksHere.find((x) => x.ref === stack)?.name ?? 'the stack';
			drag.said = `${name} put in ${into}.`;
		},
		takeOut(thing, stack, next) {
			const it = freePage?.pieces.get(stack);
			const into = it?.kind === 'card' ? it.section.section.id : home;
			takeOut(key, stack, thing);
			if (presentRefs(full).has(thing))
				view.change(key, { op: 'move', ref: thing, before: null, into });
			else view.change(key, { op: 'add', ref: thing, into, before: null });
			placeAll(next);
			adding.added = thing;
			drag.said = `Taken out of the stack.`;
		},
		say(words) {
			drag.said = words;
		},
		name: pieceName
	};

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
	sized?: Form,
	cells?: Size
)}
	{@const kind = kindOf(card)}
	{@const label = g?.name(card.ref)}
	{@const form = kind.form(card, g?.form(card.ref))}
	<!-- Beside the rooms, a card is as wide as the column: never Large (G32). -->
	{@const drawnAs = sized ?? (place === 'side' && form === 'large' ? 'standard' : form)}
	{@const name = label ?? kind.name(card)}
	{@const at =
		from !== undefined &&
		layout !== 'field' &&
		g !== undefined &&
		!g.hidden.includes(card) &&
		!freePage
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
			forms={kind.forms(card)}
			kind={card.kind}
			wide={drawnAs === 'large' && card.kind !== 'stack'}
			span={stackOf(card, drawnAs === 'large')?.width}
			rows={card.kind === 'stack' ? stackRowsOf(card, drawnAs === 'large') : undefined}
			list={favourites ? 'favourites' : 'page'}
			added={card.added ?? false}
			renamed={label !== undefined}
			moveTo={from !== undefined ? moveTargets(card, from) : undefined}
			settings={hasSettings(card, layout) ? () => (setting = { card, name, form }) : undefined}
			addBefore={at.addBefore}
			addAfter={at.addAfter}
			axis={layout === 'list' || (place === 'side' && layout !== 'row') ? 'y' : 'x'}
			cells={freePage ? (dx, dy, size) => cellKey(card.ref, dx, dy, size) : undefined}
			step={freePage ? (by) => stepCard(card.ref, by) : undefined}
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
				{cells}
			/>
		</Arrange>
	{/if}
{/snippet}

{#snippet ghost()}
	<div class="ghost" use:seen><Plus size={14} aria-hidden="true" />Goes here</div>
{/snippet}

{#snippet gap(id: string)}
	{#if drag.page === key && drag.section !== null && drag.sectionBefore === id}<div
			class="secgap"
		></div>{/if}
{/snippet}
{#snippet gapEnd(column: string | undefined)}
	{#if drag.page === key && drag.section !== null && drag.sectionBefore === null && drag.column === column}<div
			class="secgap"
		></div>{/if}
{/snippet}

{#snippet sectionHead(s: ShownSection, titleOff = false, asTitle = false)}
	{@const sec = s.section}
	<!-- On a free page a title alone is hidden (N1); a section hidden before still hides what it held. -->
	{@const hidden = s.hidden || titleOff}
	<div class="head" data-sec-handle title="Drag to move this section">
		<span class="grip" aria-hidden="true">⋮⋮</span>
		<h2 class="section-label" class:faded={hidden}>
			{s.title}{#if hidden}<span class="note"> · hidden</span>{/if}
		</h2>
		{#if drag.refused?.section === sec.id}<span class="why">{drag.refused.why}</span>{/if}
		<SectionTools
			page={key}
			ref={sectionRef(sec.id)}
			title={s.title}
			shown={freePage ? [] : peers(s)}
			{hidden}
			hideRef={asTitle && !s.hidden ? headingRef(sec.id) : undefined}
			renamed={s.renamed}
			add={sec.accepts && !freePage ? () => adding.open(key, sec.id) : undefined}
			// On a free page a heading holds nothing (N1): how its cards are grouped is
			// the look’s to say. Home’s rooms keep their style.
			layouts={freePage && sec.id !== 'rooms' ? [] : sec.layouts}
			layout={s.layout}
			config={s.config}
			// On a free page a look’s areas say where things start (N2, N3).
			column={field && !freePage && (sec.field?.movable ?? sec.field === undefined)
				? s.column
				: undefined}
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
{/snippet}

{#snippet block(s: ShownSection, place?: Place)}
	{@const sec = s.section}
	<section
		aria-label={sec.bare || arranging ? s.title : undefined}
		class:in-sidebar={sec.id === 'rooms' && sideRooms && !arranging}
		class:alerts={field && sec.id === 'alerts'}
		class:refused={drag.refused?.section === sec.id}
		data-sec={arranging ? sec.id : undefined}
		data-col={arranging ? s.column : undefined}
	>
		{#if arranging && !sec.fixed}
			{@render sectionHead(s)}
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
			{:else if s.layout === 'grid' && s.groups.length > 1}
				<!-- Its runs ("Also here"'s things, then its cards) in one grid, so a card of
				     one sits beside a card of the other: a stack among things (13 §13.2). -->
				<div class="grid">
					{#each s.groups as g (g)}
						{#each listOf(g) as card (card.ref)}
							{#if ghostIn(sec.id) && spot?.before === card.ref}{@render ghost()}{/if}
							{@render piece(
								card,
								g,
								sec.favourites,
								s.layout,
								sec.accepts ? sec.id : undefined,
								place
							)}
						{/each}
					{/each}
					{#if ghostIn(sec.id) && spot?.before === null}{@render ghost()}{/if}
				</div>
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
											{#if ghostIn(sec.id) && spot?.before === card.ref}{@render ghost()}{/if}
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
									{#if ghostIn(sec.id) && spot?.before === null && lastGroup && j === runs.length - 1}
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

<div class="drag-root" bind:this={root}>
	{#if field && !freePage}
		<!-- The room field (mockup A): the band, then the rooms with what's beside them. -->
		<div class="fieldpage">
			{#each inColumn('band') as s (s.section.id)}{@render gap(s.section.id)}{@render block(
					s,
					'band'
				)}{/each}
			{#if briefAlerts && !arranging}
				<div class="brief">
					{@render piece(briefAlerts, undefined, false, 'grid', undefined, 'brief')}
				</div>
			{/if}
			<div class="cols">
				<div class="column">
					{#each inColumn('main') as s (s.section.id)}{@render gap(s.section.id)}{@render block(
							s
						)}{/each}
					{@render gapEnd('main')}
				</div>
				<div class="column side" role="complementary" aria-label="Beside the rooms">
					{#each inColumn('side') as s (s.section.id)}{@render gap(s.section.id)}{@render block(
							s,
							'side'
						)}{/each}
					{@render gapEnd('side')}
				</div>
			</div>
		</div>
	{:else if freePage}
		<!-- What's always first (Needs attention, G6) stays above the grid. -->
		{#each shown.sections.filter((s) => s.section.fixed && drawn(s, arranging)) as s (s.section.id)}
			{@render block(s)}
		{/each}
		<!-- One grid (14 §3): each card at its place; narrower, in reading order (P4). -->
		<div class="free">
			<div class="cells">
				{#each drawnLaid as p (p.ref)}
					{@const it = freePage.pieces.get(p.ref)}
					{@const e = freePage.eight.get(p.ref) ?? p}
					{@const f = freePage.four.get(p.ref) ?? p}
					{#if it}
						<div
							class="slot"
							use:fits={p.ref}
							class:heading={it.kind === 'heading'}
							class:arranging
							class:held={it.kind === 'card' && it.card.kind === 'stack'}
							class:side={placeOf(it.section) === 'side'}
							data-ref={arranging ? p.ref : undefined}
							data-stack={arranging && it.kind === 'card' && it.card.kind === 'stack'
								? ''
								: undefined}
							style={`--x: ${p.x + 1}; --y: ${p.y + 1}; --w: ${p.w}; --h: ${p.h}; --x8: ${e.x + 1}; --y8: ${e.y + 1}; --w8: ${e.w}; --x4: ${f.x + 1}; --y4: ${f.y + 1}; --w4: ${f.w}`}
						>
							{#if it.kind === 'heading' && arranging}
								{@render sectionHead(it.section, it.hidden, true)}
							{:else if it.kind === 'heading'}
								<h2 class="section-label">{it.section.title}</h2>
							{:else if it.kind === 'whole'}
								{@render block(it.section, placeOf(it.section))}
							{:else}
								{@render piece(
									it.card,
									it.g,
									it.section.section.favourites ?? false,
									it.section.layout,
									it.section.section.accepts ? it.section.section.id : undefined,
									placeOf(it.section),
									formIn(it.card, it.g, it.section.layout, p),
									{ w: p.w, h: p.h }
								)}
							{/if}
						</div>
					{/if}
				{/each}
				{#if preview.foot}
					{@const b = preview.foot}
					<div
						class="foot"
						aria-hidden="true"
						style={`--x: ${b.x + 1}; --y: ${b.y + 1}; --w: ${b.w}; --h: ${b.h}`}
					>
						{b.label ?? ''}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		{#each shown.sections as s (s.section.id)}
			{#if drawn(s, arranging)}{@render gap(s.section.id)}{@render block(s)}{/if}
		{/each}
		{@render gapEnd(undefined)}
	{/if}
</div>
{#if arranging && drag.said}<p class="said" role="status">{drag.said}</p>{/if}

{#if arranging}
	<div class="page-tools">
		{#if freePage}
			<!-- No sections on a free page (N1): a title is a widget like any other. -->
			<button class="new-section" onclick={addTitle}
				><Plus size={16} aria-hidden="true" />Add a title</button
			>
		{:else}
			<button class="new-section" onclick={() => (making = true)}
				><Plus size={16} aria-hidden="true" />New section</button
			>
		{/if}
		{#if freePage}
			<!-- Gaps stay where they're left (P5); Tidy closes them up. -->
			<button class="new-section" onclick={tidyPage}>Tidy</button>
		{/if}
		{#if freePage && key.startsWith('room:')}
			{#await import('./LayoutMenu.svelte') then { default: LayoutMenu }}
				<LayoutMenu
					page={key}
					edit={mode === 'edit'}
					rooms={otherRooms}
					said={(words) => (drag.said = words)}
				/>
			{/await}
		{/if}
	</div>
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
			<AddCard
				{key}
				sections={freePage ? into.filter((s) => s.id === home) : into}
				{home}
				free={!!freePage}
				close={() => adding.close()}
			/>
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
{#if setting?.card.kind === 'stack'}
	{#await import('./StackSettings.svelte') then { default: StackSettings }}
		{#if setting}
			<StackSettings
				page={key}
				card={setting.card}
				form={setting.form}
				others={stacksHere.filter((x) => x.ref !== setting?.card.ref)}
				onPage={new Set(allCards.map((c) => c.ref))}
				close={() => (setting = null)}
			/>
		{/if}
	{/await}
{:else if setting}
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
		gap: var(--feel-gap);
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: var(--feel-box-radius);
		background: color-mix(in srgb, var(--bg) 60%, var(--surface));
	}
	/* A look's layouts (13 §8): scenes as a row of swatches; one box of short
	   lines (Watching); folded away (More), a box of lines once opened. */
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 12px;
	}
	/* Things drawn as chips (13 §13.1): a line of pills, wrapping. */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	/* A joined section (13 §13.1, vertical-stack-in-card): its things as one card, a line each. */
	.lines,
	.joined,
	.fold {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--feel-card-radius);
		background: var(--surface);
		overflow: hidden;
	}
	.lines > :global(* + *),
	.joined > :global(* + *) {
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
	/* Dragging (13 §9.2). */
	.drag-root {
		display: contents;
	}
	@media (pointer: fine) {
		.drag-root :global(.arrange[data-list='page']),
		.head[data-sec-handle] {
			cursor: grab;
		}
	}
	:global(html[data-dragging]),
	:global(html[data-dragging] *) {
		cursor: grabbing !important;
		user-select: none;
	}
	.grip {
		color: var(--ink-muted);
		letter-spacing: -2px;
		font-weight: 700;
		cursor: grab;
	}
	section.refused {
		opacity: 0.45;
		outline: 1px dashed var(--alert);
		outline-offset: 4px;
		border-radius: var(--radius);
	}
	.why {
		color: var(--alert);
		font-size: 12px;
	}
	.secgap {
		height: 6px;
		border-radius: 6px;
		background: var(--accent);
	}
	.said {
		position: fixed;
		left: 50%;
		bottom: calc(84px + env(safe-area-inset-bottom));
		z-index: 30;
		translate: -50% 0;
		margin: 0;
		padding: 8px 16px;
		border-radius: 999px;
		background: var(--ink);
		color: var(--bg);
		font-size: 13px;
		font-weight: 600;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
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
	/* Free layout (14 §3): twelve columns of 56px rows from a 1080px page;
	   narrower, eight and then a phone's four, laid out again in reading order. A card taller
	   than its rows makes them taller rather than spilling. */
	.free {
		container: free / inline-size;
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-auto-rows: minmax(56px, auto);
		gap: var(--feel-gap, 10px);
		max-width: 1600px;
	}
	/* At least its cells, from the top of them: a drawing taller than its place
	   grows its own rows, never stretching the cards beside it (14 §7). */
	.slot {
		display: flex;
		flex-direction: column;
		align-self: start;
		min-height: calc(var(--h) * 56px + (var(--h) - 1) * var(--feel-gap, 10px));
		min-width: 0;
		/* Its width, for a drawing to fit its words to (a light at 2 × 1). */
		container: slot / inline-size;
		grid-column: var(--x4) / span var(--w4);
		grid-row: var(--y4) / span var(--h);
	}
	.slot > :global(*) {
		flex: 1 1 auto;
	}
	/* A stack keeps to its place's height and scrolls what doesn't fit (14 §7). */
	.slot.held {
		height: calc(var(--h) * 56px + (var(--h) - 1) * var(--feel-gap, 10px));
	}
	/* A card fills its place (14 §7), arranging as well. */
	.slot > :global(.arrange > .card) {
		flex: 1 1 auto;
	}
	.slot > :global(*),
	.slot > :global(.arrange > .card > .quiet) {
		min-height: 0;
	}
	.slot.heading {
		justify-content: flex-end;
	}
	.slot.heading.arranging {
		justify-content: center;
	}
	/* Where a dragged card lands (14 §5), with its size as it's sized. */
	.foot {
		z-index: 3;
		display: grid;
		place-items: center;
		grid-column: var(--x) / span var(--w);
		grid-row: var(--y) / span var(--h);
		border: 2px dashed var(--accent);
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
		font-weight: 700;
		pointer-events: none;
	}
	@media (pointer: fine) {
		.slot.arranging:not(.heading) {
			cursor: grab;
		}
	}
	/* A card's tools float over its foot while it's pointed at or chosen, so
	   the page arranges as it will look (14 §5). */
	.slot.arranging {
		position: relative;
	}
	.slot.arranging :global(.arrange > .tools) {
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 6px;
		z-index: 4;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.12s;
	}
	.slot.arranging:hover :global(.arrange > .tools),
	.slot.arranging :global(.arrange:focus-within > .tools) {
		opacity: 1;
		pointer-events: auto;
	}
	:global(html[data-dragging]) .slot.arranging :global(.arrange > .tools) {
		opacity: 0;
		pointer-events: none;
	}
	.page-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.slot.heading > h2 {
		flex: none;
		margin: 0;
	}
	@container free (min-width: 600px) {
		.cells {
			grid-template-columns: repeat(8, minmax(0, 1fr));
		}
		.slot {
			grid-column: var(--x8) / span var(--w8);
			grid-row: var(--y8) / span var(--h);
		}
	}
	@container free (min-width: 1080px) {
		.cells {
			grid-template-columns: repeat(12, minmax(0, 1fr));
		}
		.slot {
			grid-column: var(--x) / span var(--w);
			grid-row: var(--y) / span var(--h);
		}
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
