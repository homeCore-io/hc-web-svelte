/**
 * A page as one document (G1, 11 §2): sections of cards, the same shape for
 * Home, a room's page and pages people make (G27). Home and the
 * rooms are computed into it from the house every time (D1); the layers then
 * apply to the document (M2), and one renderer draws it (`PageView`).
 *
 * Everything here is plain data and functions, so what a page shows — and
 * what the household's and a person's changes do to it — can be tested
 * without drawing anything.
 */
import { cardFor, kindOf } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import type { Room } from './house.js';
import { apply, cardRef, kindRef, ref, type Change, type Form, type Layered } from './layers.js';
import { byRoom, roomSections, type Chip } from './summary.js';

/**
 * How a section lays its cards out (G3). A look's grouping (13 §8) adds three:
 * `swatches` (scenes in a row of swatches), `lines` (one box of short lines:
 * Watching), `fold` (folded away until opened: More) and `panel` (switches,
 * packed into a panel).
 */
export type Layout =
	| 'grid'
	| 'row'
	| 'list'
	| 'field'
	| 'tiles'
	| 'swatches'
	| 'lines'
	| 'fold'
	| 'panel'
	| 'chips'
	| 'joined';

interface Base {
	/** What the layers call it: `device:…`, `scene:…`, `room:…`, `card:…`, `piece:…`. */
	ref: string;
	/** Added to the page by the household, rather than generated on it. */
	added?: boolean;
	/** Cards of a section are laid out — and ordered — in runs of the same group. */
	group?: string;
}

export type Card = Base &
	(
		| { kind: 'device'; device: CoreDevice; scene: boolean; form?: Form }
		| { kind: 'scene'; id: string; name: string }
		| { kind: 'room'; id: string; name: string; href: string; devices: CoreDevice[] }
		| { kind: 'plugin'; label: string; forms?: Form[] }
		| { kind: 'alerts'; count: number }
		| { kind: 'chips'; chips: Chip[] }
		| { kind: 'modes' }
		/** The big numbers across the top of Home (G-b). */
		| { kind: 'summary' }
		/** The app's own cards, added with Add (G-c). */
		| { kind: 'heading' }
		| { kind: 'text' }
		| { kind: 'worth' }
		| { kind: 'playing' }
		| { kind: 'weather' }
		| { kind: 'chart' }
		/** A room's header in a look that has one (13 §7): its name, readings, glow. */
		| { kind: 'roomhead'; id: string; name: string; devices: CoreDevice[] }
		/** What in a room needs someone, each with its fix (13 §7). */
		| { kind: 'needs'; id: string; devices: CoreDevice[] }
		| { kind: 'batteries'; id: string; devices: CoreDevice[] }
		/** Lights that belong together, one card ("Holiday Lights 1" to "4"). */
		| { kind: 'lampgroup'; name: string; devices: CoreDevice[] }
	);

/** The app's own cards Add offers (G21), in the order offered. */
export const APP_KINDS = ['heading', 'text', 'worth', 'playing', 'weather', 'chart'] as const;
export type AppKind = (typeof APP_KINDS)[number];
const isAppKind = (k: string): k is AppKind => (APP_KINDS as readonly string[]).includes(k);

export interface Section {
	id: string;
	title: string;
	layout: Layout;
	/** The layouts it may be given (a `config` change); none, only its own. */
	layouts?: Layout[];
	cards: Card[];
	/** Always first, can't be hidden or renamed (G6). */
	fixed?: boolean;
	/** Drawn as they are — no heading, no layout box, no card tools. */
	bare?: boolean;
	/** No heading but while arranging; its cards are arranged as usual. */
	headless?: boolean;
	/** Hidden until someone shows it, or picks a style that does (G11). */
	hiddenUnlessShown?: boolean;
	/** Drawn above the cards and not arranged with them (Home's modes). */
	lead?: Card;
	/** The person's favourites: their own list's order, and only their sizes. */
	favourites?: boolean;
	/** Shown while arranging when it has nothing, so it can still be found. */
	hint?: string;
	/** `always`: shown even with no cards, as a room's sections are. */
	show?: 'cards' | 'always';
	/** Add can put things in it (G20). */
	accepts?: boolean;
	/** A section someone made (G17): the household's, or this person's own. */
	own?: 'house' | 'person';
	/**
	 * Where the room field style draws it (G32, mockup A): the band across the
	 * top, the side column, the main column under the rooms, or not at all.
	 * `movable`: a `column` setting may put it in the other column. `only`:
	 * drawn in that style alone. Unsaid: the main column, movable.
	 */
	field?: { column: Column; movable?: boolean; only?: boolean };
}

export type Column = 'band' | 'side' | 'main' | 'none';
const SIDE = { column: 'side', movable: true } as const;

/** Layouts for a section of cards (G19); field and tiles are for rooms. */
export const CARD_LAYOUTS: Layout[] = ['grid', 'row', 'list'];

export interface Page {
	/** `home`, `room:<id>`, `page:<id>` — the key the layers are kept under. */
	id: string;
	sections: Section[];
	/**
	 * Drawn in columns, as Home's room field is (G32): the band across the top,
	 * then a main column and one beside it, each section where its `field` says.
	 */
	columns?: boolean;
	/** Device cards carry their own Hide (room pages). */
	cardTools: boolean;
}

export const sectionRef = (id: string) => `section:${id}`;

// ---- Home (D1) ----

export interface HomeInput {
	devices: Devices;
	rooms: Room[];
	scenes: { id: string; name: string }[];
	/** This person's starred refs, in their order. */
	favourites: string[];
	/** Refs the household added to Home (`add`), in the order added. */
	added: string[];
	/** A plugin card's name and sizes, if its plugin has said. */
	pluginCard: (ref: string) => { label: string; forms?: Form[] } | undefined;
	alerts: number;
	chips: Chip[];
	mode: 'edit' | 'customise' | null;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** A device as a card on Home, wherever it appears. */
function deviceCard(d: CoreDevice, extra: Partial<Base> = {}): Card {
	return {
		ref: ref.device(d.device_id),
		kind: 'device',
		device: d,
		scene: kindOf(d) === 'scene',
		...extra
	};
}

/** A room as a card: its box, or its line in a list. */
const roomCard = (r: Room, devices: CoreDevice[], extra: Partial<Base> = {}): Card => ({
	ref: ref.room(r.id),
	kind: 'room',
	id: r.id,
	name: r.name,
	href: `/rooms/${r.id}`,
	devices,
	...extra
});

/** Something a ref names, as a card — or nothing, if the house no longer has it. */
function cardOf(
	r: string,
	h: Pick<HomeInput, 'devices' | 'scenes' | 'pluginCard'> & { rooms?: Room[] },
	extra: Partial<Base> = {}
): Card | undefined {
	if (r.startsWith('room:') && h.rooms) {
		// A page someone made holds rooms' boxes too (G27).
		const room = h.rooms.find((x) => x.id === r.slice(5));
		return room ? roomCard(room, byRoom(h.devices, h.rooms).get(room.id) ?? [], extra) : undefined;
	}
	if (r.startsWith('device:')) {
		const d = h.devices[r.slice(7)];
		return d ? deviceCard(d, extra) : undefined;
	}
	if (r.startsWith('scene:')) {
		const s = h.scenes.find((x) => x.id === r.slice(6));
		return s ? { ref: r, kind: 'scene', id: s.id, name: s.name, ...extra } : undefined;
	}
	const own = kindRef(r);
	if (own) return isAppKind(own.kind) ? { ref: r, kind: own.kind, ...extra } : undefined;
	if (cardRef(r)) {
		// Kept even while its plugin is away, so it can be taken off.
		const found = h.pluginCard(r);
		return {
			ref: r,
			kind: 'plugin',
			label: found?.label ?? 'A plugin’s card',
			forms: found?.forms,
			...extra
		};
	}
	return undefined;
}

/**
 * The generated Home: what needs attention, what's on, the household's
 * pinned cards, this person's favourites, the scenes and modes that belong to
 * no room, then every room (C5).
 */
export function homePage(h: HomeInput): Page {
	const grouped = byRoom(h.devices, h.rooms);
	const loose = grouped.get('') ?? [];
	const isScene = (d: CoreDevice) => kindOf(d) === 'scene';
	const hasModes = Object.values(h.devices).some((d) => kindOf(d) === 'mode');

	// homeCore's scenes and plugins' alike, by name.
	const scenes = [
		...h.scenes.map((s) => ({
			name: s.name,
			card: { ref: ref.scene(s.id), kind: 'scene', id: s.id, name: s.name } as Card
		})),
		...loose.filter(isScene).map((d) => ({ name: displayName(d), card: deviceCard(d) }))
	]
		.sort(byName)
		.map((s) => s.card);

	const strays = loose.filter((d) => !isScene(d) && kindOf(d) !== 'mode');
	const rooms: Card[] = [
		...h.rooms
			.map((r) => ({ r, devices: grouped.get(r.id) ?? [] }))
			.filter((x) => x.devices.length > 0)
			.map(({ r, devices }) => roomCard(r, devices)),
		...(strays.length > 0
			? [
					{
						ref: ref.room('none'),
						kind: 'room' as const,
						id: 'none',
						name: 'Not in a room',
						href: '/rooms/none',
						devices: strays
					}
				]
			: [])
	];

	const edit = h.mode === 'edit';
	return {
		id: 'home',
		cardTools: false,
		sections: [
			{
				id: 'alerts',
				title: 'Needs attention',
				layout: 'list',
				fixed: true,
				bare: true,
				field: { column: 'side' },
				cards:
					h.alerts > 0 && !edit
						? [{ ref: 'piece:alerts/home', kind: 'alerts', count: h.alerts }]
						: []
			},
			{
				id: 'chips',
				title: 'What’s going on',
				layout: 'list',
				bare: true,
				// The band says the same in the room field.
				field: { column: 'none' },
				cards:
					h.chips.length > 0 ? [{ ref: 'piece:chips/home', kind: 'chips', chips: h.chips }] : []
			},
			{
				id: 'summary',
				title: 'At a glance',
				layout: 'list',
				headless: true,
				hiddenUnlessShown: true,
				field: { column: 'band' },
				cards: [{ ref: 'piece:summary/home', kind: 'summary' }]
			},
			{
				id: 'pinned',
				title: 'Pinned',
				layout: 'grid',
				layouts: CARD_LAYOUTS,
				accepts: true,
				field: SIDE,
				cards: h.added.flatMap((r) => cardOf(r, h, { added: true }) ?? []),
				hint: 'What’s added with Add, and not put in another section, appears here.'
			},
			{
				id: 'favourites',
				title: 'Favorites',
				layout: 'grid',
				layouts: CARD_LAYOUTS,
				favourites: true,
				// Under the rooms until moved beside them (the user's choice, 2026-11-01).
				field: { column: 'main', movable: true },
				// Favourites are each person's own; the shared page has none.
				cards: edit ? [] : h.favourites.flatMap((r) => cardOf(r, h) ?? []),
				hint: edit
					? 'Each person’s favorites show here.'
					: 'Star anything — here or in a room — and it appears in Favorites at the top of Home.'
			},
			// Beside the rooms in the room field (mockup A); not drawn in other styles.
			{
				id: 'worth',
				title: 'Worth knowing',
				layout: 'list',
				field: { ...SIDE, only: true },
				cards: [{ ref: 'piece:worth/home', kind: 'worth' }]
			},
			{
				id: 'playing',
				title: 'Playing',
				layout: 'list',
				field: { ...SIDE, only: true },
				cards: [{ ref: 'piece:playing/home', kind: 'playing' }]
			},
			{
				id: 'scenes',
				title: 'Scenes & modes',
				layout: 'row',
				layouts: ['row', 'grid', 'list'],
				accepts: true,
				field: SIDE,
				lead: hasModes ? { ref: 'piece:modes/home', kind: 'modes' } : undefined,
				show: hasModes ? 'always' : 'cards',
				cards: scenes
			},
			{
				id: 'rooms',
				title: 'Rooms',
				layout: 'list',
				layouts: ['list', 'field', 'tiles'],
				show: 'always',
				field: { column: 'main' },
				cards: rooms
			}
		]
	};
}

// ---- a room's page (N4) ----

const ROOM_LAYOUTS: Layout[] = ['grid', 'list'];

export interface RoomInput {
	devices: Devices;
	rooms: Room[];
	/** Refs the household added to this room's page. */
	added: string[];
	pluginCard: (ref: string) => { label: string; forms?: Form[] } | undefined;
	now?: number;
}

/**
 * A generated room page: things to use, its scenes, its readings, then
 * infrastructure (C6) — and what the household added, under "Also here".
 * `id` is a room's id, or `none` for the devices in no room.
 */
export function roomPage(id: string, h: RoomInput): Page {
	const inRoom = byRoom(h.devices, h.rooms).get(id === 'none' ? '' : id) ?? [];
	const scene = (d: CoreDevice) =>
		kindOf(d) === 'scene' && (d.schema?.actions?.some((a) => a.id === 'activate') ?? false);
	const asCard = (d: CoreDevice, extra: Partial<Base> = {}): Card => ({
		ref: ref.device(d.device_id),
		kind: 'device',
		device: d,
		scene: scene(d),
		form: kindOf(d) === 'media_player' ? 'large' : undefined,
		...extra
	});
	const sections: Section[] = roomSections(inRoom.map((d) => cardFor(d, h.now))).map((s) => ({
		id: `devices:${s.key}`,
		title: s.title,
		layout: 'grid',
		layouts: ROOM_LAYOUTS,
		accepts: true,
		// Drawn with cards; emptied by moving them elsewhere (G22), only while
		// arranging, so something can be moved back in.
		hint: 'Nothing here now. Move a card in from another section.',
		cards: s.cards.map((c) => asCard(h.devices[c.id]!))
	}));

	const extra = h.added
		.filter((r) => r.startsWith('device:'))
		.map((r) => h.devices[r.slice(7)])
		.filter((d): d is CoreDevice => d !== undefined && !inRoom.includes(d))
		.map((d) => ({ ...asCard(d, { added: true, group: 'devices' }), form: undefined }));
	const plugins = h.added
		.filter((r) => cardRef(r) !== undefined || kindRef(r) !== undefined)
		.map((r) =>
			cardOf(
				r,
				{ devices: {}, scenes: [], pluginCard: h.pluginCard },
				{ added: true, group: 'cards' }
			)
		)
		.filter((c): c is Card => c !== undefined);
	if (extra.length > 0 || plugins.length > 0)
		sections.push({
			id: 'added',
			title: 'Also here',
			layout: 'grid',
			layouts: ROOM_LAYOUTS,
			accepts: true,
			// Empty once what was added here is put in another section.
			hint: 'What’s added with Add, and not put in another section, appears here.',
			cards: [...extra, ...plugins]
		});

	return { id: `room:${id}`, sections, cardTools: true };
}

// ---- a page someone made (G27) ----

export interface BuiltInput {
	devices: Devices;
	rooms: Room[];
	scenes: { id: string; name: string }[];
	/** Refs added to the page, in the order added: everything on it. */
	added: string[];
	pluginCard: (ref: string) => { label: string; forms?: Form[] } | undefined;
}

/**
 * A page someone made: nothing generated. What's on it is what its layer
 * added, into the sections it made; what was added into no section is in
 * "Cards", headed only while arranging.
 */
export function builtPage(id: string, h: BuiltInput): Page {
	return {
		id: `page:${id}`,
		cardTools: false,
		sections: [
			{
				id: 'cards',
				title: 'Cards',
				layout: 'grid',
				layouts: CARD_LAYOUTS,
				accepts: true,
				headless: true,
				cards: h.added.flatMap((r) => cardOf(r, h, { added: true }) ?? []),
				hint: 'What’s added with Add, and not put in another section, appears here.'
			}
		]
	};
}

// ---- sections of one's own (G17) ----

/** Layouts for rooms (G3); a section of one's own holding them keeps them (G29). */
const ROOM_LAYOUTS_ALL: Layout[] = ['list', 'field', 'tiles'];

/** The own sections the changes make, in the order made: the last of `section`/`remove` per ref wins. */
function ownSections(changes: Change[], mine: Change[]): Section[] {
	const made = new Map<string, Extract<Change, { op: 'section' }>>();
	for (const c of changes) {
		if (!c.ref.startsWith('section:own-')) continue;
		if (c.op === 'section') made.set(c.ref, c);
		if (c.op === 'remove') made.delete(c.ref);
	}
	return [...made.values()].map((c) => {
		const rooms = c.layout === 'field' || c.layout === 'tiles';
		const layouts = rooms ? ROOM_LAYOUTS_ALL : CARD_LAYOUTS;
		return {
			id: c.ref.slice('section:'.length),
			title: c.title,
			layout: (layouts as string[]).includes(c.layout) ? (c.layout as Layout) : 'grid',
			layouts,
			accepts: true,
			own: mine.includes(c) ? 'person' : 'house',
			cards: [],
			hint: 'Nothing here yet. Add here puts something in it, or move a card in from another section.'
		};
	});
}

/**
 * The page with the sections the changes made (G17), after its own — where
 * they go is an ordinary `move`. `mine` are the person's changes (none in
 * Edit), to tell whose a section is.
 */
export function withOwn(page: Page, changes: Change[] = [], mine: Change[] = []): Page {
	const own = ownSections(changes, mine);
	return own.length === 0 ? page : { ...page, sections: [...page.sections, ...own] };
}

// ---- the layers, applied (M2, G5, G6) ----

export interface ShownSection {
	section: Section;
	/** Its heading on this page: renamed, or as generated. */
	title: string;
	renamed: boolean;
	hidden: boolean;
	/** Its layout on this page: one it was given, if it may take it, else its own. */
	layout: Layout;
	/** Its cards in runs of one group each, with the layers applied. */
	groups: Layered<Card>[];
	/** Its settings on this page: its layout, its column. */
	config?: Record<string, unknown>;
	/** Where the room field style draws it (G32). */
	column: Column;
}

export interface Shown {
	/** In the page's order; hidden ones only while arranging. */
	sections: ShownSection[];
}

/** Runs of cards that share a group, in the order each group first appears. */
function groupsOf(cards: Card[]): Card[][] {
	const runs = new Map<string, Card[]>();
	for (const c of cards) {
		const g = c.group ?? '';
		runs.set(g, [...(runs.get(g) ?? []), c]);
	}
	return [...runs.values()];
}

/**
 * The page with changes on top. `changes` are what this screen shows (the
 * household's, then the person's — or Edit's draft); `mine` are the person's
 * own, which alone size their favourites.
 */
export function applyPage(
	page: Page,
	changes: Change[] = [],
	mine: Change[] = [],
	o: { arranging: boolean; field?: boolean } = { arranging: false }
): Shown {
	// What only the room field draws is left out of the other styles (G32).
	if (!o.field && page.sections.some((s) => s.field?.only))
		page = { ...page, sections: page.sections.filter((s) => !s.field?.only) };
	// Added into a section (G16): placed as a move would, ahead of the rest.
	changes = [
		...changes.flatMap((c): Change[] =>
			c.op === 'add' && c.into !== undefined
				? [{ op: 'move', ref: c.ref, before: c.before ?? null, into: c.into }]
				: []
		),
		...changes
	];
	// A card moved into another section (G5) leaves its own first. The last
	// move into a section the page still has wins: one into a section since
	// removed is skipped, so the card goes back where it was before — never lost.
	const ids = new Set(page.sections.map((s) => s.id));
	const into = new Map<string, string>();
	for (const c of changes)
		if (c.op === 'move' && c.into !== undefined && ids.has(c.into)) into.set(c.ref, c.into);
	const moved = new Map<string, Card>();
	let sections = page.sections.map((s) => ({
		...s,
		cards: s.cards.filter((c) => {
			const to = into.get(c.ref);
			if (to === undefined || to === s.id || !ids.has(to) || s.fixed || s.favourites) return true;
			// Its run belonged to the section it left (Also here's devices and cards):
			// in the new one it takes any place, not only after the cards there.
			moved.set(c.ref, { ...c, group: undefined });
			return false;
		})
	}));
	sections = sections.map((s) => ({
		...s,
		cards: [...s.cards, ...[...moved].filter(([r]) => into.get(r) === s.id).map(([, c]) => c)]
	}));

	// Where a card is placed within a section: moves into it, and moves that
	// name no section (up and down) — never one placing it in another section.
	const forSection = (s: Section) =>
		changes.filter((c) => c.op !== 'move' || c.into === undefined || c.into === s.id);
	const layered = apply(sections, (s) => sectionRef(s.id), [
		...sections
			.filter((s) => s.hiddenUnlessShown)
			.map((s): Change => ({ op: 'hide', ref: sectionRef(s.id) })),
		...changes
	]);
	const fixed = sections.filter((s) => s.fixed);
	const order = [
		...fixed.map((s) => ({ s, hidden: false })),
		...layered.shown.filter((s) => !s.fixed).map((s) => ({ s, hidden: false })),
		...(o.arranging ? layered.hidden.filter((s) => !s.fixed).map((s) => ({ s, hidden: true })) : [])
	];

	return {
		sections: order.map(({ s, hidden }) => {
			const name = s.fixed ? undefined : layered.name(sectionRef(s.id));
			const groups = groupsOf(s.cards).map((cards) =>
				s.favourites
					? apply(
							cards,
							(c) => c.ref,
							mine.filter((c) => c.op === 'form')
						)
					: apply(cards, (c) => c.ref, forSection(s))
			);
			const config = layered.config(sectionRef(s.id));
			const layout = s.layouts?.find((l) => l === config?.layout) ?? s.layout;
			return {
				section: s,
				title: name ?? s.title,
				renamed: name !== undefined,
				hidden,
				layout,
				groups,
				config,
				column: columnOf(s, config?.column)
			};
		})
	};
}

/** Where the room field draws a section: its column, or the one it was given if it may move (G32). */
export function columnOf(s: Section, given: unknown): Column {
	const f = s.field ?? { column: 'main', movable: true };
	return f.movable && (given === 'side' || given === 'main') ? given : f.column;
}

/** Everything the page names, for Edit's "refers to something that's gone" (M2). */
export function presentRefs(page: Page): Set<string> {
	const out = new Set<string>();
	for (const s of page.sections) {
		out.add(sectionRef(s.id));
		for (const c of s.cards) out.add(c.ref);
		if (s.lead) out.add(s.lead.ref);
	}
	return out;
}

/** Whether a section is drawn: with cards to show, or always, or — arranging — with a hint. */
export function drawn(s: ShownSection, arranging: boolean): boolean {
	const cards = s.groups.reduce(
		(n, g) => n + g.shown.length + (arranging ? g.hidden.length : 0),
		0
	);
	return (
		cards > 0 ||
		s.section.show === 'always' ||
		(arranging && (s.hidden || s.section.hint !== undefined))
	);
}

/** A scene's button: one line, run on a tap — what a row is made of. */
const isButton = (c: Card) => c.kind === 'scene' || (c.kind === 'device' && c.scene);

/**
 * A section's cards in the runs they're drawn in. A row lines up scenes'
 * buttons; anything else added into it (a light, a chart) is drawn in a grid
 * of its own between them, so the buttons keep their height rather than
 * stretching to a card's. Other layouts are one run.
 */
export function runsOf<C extends Card>(
	cards: C[],
	layout: Layout
): { layout: Layout; cards: C[] }[] {
	if (layout !== 'row') return [{ layout, cards }];
	const out: { layout: Layout; cards: C[] }[] = [];
	for (const c of cards) {
		const l: Layout = isButton(c) ? 'row' : 'grid';
		const last = out.at(-1);
		if (last && last.layout === l) last.cards.push(c);
		else out.push({ layout: l, cards: [c] });
	}
	return out.length > 0 ? out : [{ layout, cards }];
}
