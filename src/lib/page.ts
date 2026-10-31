/**
 * A page as one document (G1, 11 §2): sections of cards, the same shape for
 * Home, a room's page and — later — pages the household builds. Home and the
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
import { apply, cardRef, ref, type Change, type Form, type Layered } from './layers.js';
import { byRoom, roomSections, type Chip } from './summary.js';

/** How a section lays its cards out (G3). */
export type Layout = 'grid' | 'row' | 'list' | 'field' | 'tiles';

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
	);

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
}

export interface Page {
	/** `home`, `room:<id>` — the key the layers are kept under. */
	id: string;
	sections: Section[];
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

/** Something a ref names, as a card — or nothing, if the house no longer has it. */
function cardOf(
	r: string,
	h: Pick<HomeInput, 'devices' | 'scenes' | 'pluginCard'>,
	extra: Partial<Base> = {}
): Card | undefined {
	if (r.startsWith('device:')) {
		const d = h.devices[r.slice(7)];
		return d ? deviceCard(d, extra) : undefined;
	}
	if (r.startsWith('scene:')) {
		const s = h.scenes.find((x) => x.id === r.slice(6));
		return s ? { ref: r, kind: 'scene', id: s.id, name: s.name, ...extra } : undefined;
	}
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
			.map(({ r, devices }): Card => ({
				ref: ref.room(r.id),
				kind: 'room',
				id: r.id,
				name: r.name,
				href: `/rooms/${r.id}`,
				devices
			})),
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
				cards:
					h.chips.length > 0 ? [{ ref: 'piece:chips/home', kind: 'chips', chips: h.chips }] : []
			},
			{
				id: 'summary',
				title: 'At a glance',
				layout: 'list',
				headless: true,
				hiddenUnlessShown: true,
				cards: [{ ref: 'piece:summary/home', kind: 'summary' }]
			},
			{
				id: 'pinned',
				title: 'Pinned',
				layout: 'grid',
				cards: h.added.flatMap((r) => cardOf(r, h, { added: true }) ?? []),
				hint: edit ? 'Cards added with Add appear here.' : undefined
			},
			{
				id: 'favourites',
				title: 'Favourites',
				layout: 'grid',
				favourites: true,
				// Favourites are each person's own; the shared page has none.
				cards: edit ? [] : h.favourites.flatMap((r) => cardOf(r, h) ?? []),
				hint: edit
					? 'Each person’s favourites show here.'
					: 'Star anything — here or in a room — and it appears in Favourites at the top of Home.'
			},
			{
				id: 'scenes',
				title: 'Scenes & modes',
				layout: 'row',
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
				cards: rooms
			}
		]
	};
}

// ---- a room's page (N4) ----

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
		show: 'always',
		cards: s.cards.map((c) => asCard(h.devices[c.id]!))
	}));

	const extra = h.added
		.filter((r) => r.startsWith('device:'))
		.map((r) => h.devices[r.slice(7)])
		.filter((d): d is CoreDevice => d !== undefined && !inRoom.includes(d))
		.map((d) => ({ ...asCard(d, { added: true, group: 'devices' }), form: undefined }));
	const plugins = h.added
		.filter((r) => cardRef(r) !== undefined)
		.map((r) =>
			cardOf(
				r,
				{ devices: {}, scenes: [], pluginCard: h.pluginCard },
				{ added: true, group: 'cards' }
			)!
		);
	if (extra.length > 0 || plugins.length > 0)
		sections.push({
			id: 'added',
			title: 'Also here',
			layout: 'grid',
			show: 'always',
			cards: [...extra, ...plugins]
		});

	return { id: `room:${id}`, sections, cardTools: true };
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
	o: { arranging: boolean } = { arranging: false }
): Shown {
	// A card moved into another section (G5) leaves its own first.
	const into = new Map<string, string>();
	for (const c of changes) if (c.op === 'move' && c.into !== undefined) into.set(c.ref, c.into);
	const ids = new Set(page.sections.map((s) => s.id));
	const moved = new Map<string, Card>();
	let sections = page.sections.map((s) => ({
		...s,
		cards: s.cards.filter((c) => {
			const to = into.get(c.ref);
			if (to === undefined || to === s.id || !ids.has(to) || s.fixed || s.favourites) return true;
			moved.set(c.ref, c);
			return false;
		})
	}));
	sections = sections.map((s) => ({
		...s,
		cards: [...s.cards, ...[...moved].filter(([r]) => into.get(r) === s.id).map(([, c]) => c)]
	}));

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
			const given = layered.config(sectionRef(s.id))?.layout;
			const layout = s.layouts?.find((l) => l === given) ?? s.layout;
			return {
				section: s,
				title: name ?? s.title,
				renamed: name !== undefined,
				hidden,
				layout,
				groups
			};
		})
	};
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
