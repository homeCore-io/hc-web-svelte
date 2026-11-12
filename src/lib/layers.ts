/**
 * Personal layers (M2–M4): a person's own changes on top of the generated
 * pages, as lists of small changes named by stable ids — never a copy of a
 * page. So a new device still appears in its room, and the changes survive.
 *
 * Ids name what a card is about: `device:{id}`, `room:{id}`, `scene:{id}`,
 * `card:{plugin}/{element}/{n}` for a plugin's own card added to a page, or
 * `kind:{kind}/{n}` for one of the app's own cards added to a page (G-c).
 * A change naming something that no longer exists is kept and skipped.
 *
 * Two owners, the same kind of list (04 §3): the household's edits, made in
 * Edit mode by people who may (`/ui/house`), and each person's own, made in
 * Customise (`/ui/prefs`, only theirs). A screen shows the generated page with
 * the household's changes and then the person's on top, so a person may show
 * again what the household hid (M3).
 */

import type { AvatarChoice } from './avatar.js';
import type { UnitsChoice } from './units.js';
import type { ConsoleHouse, ConsolePrefs } from './console/style.js';
import { allLooks, findLook, type Look } from './looks/model.js';

export type Form = 'compact' | 'standard' | 'large';

export type Change =
	| { op: 'hide'; ref: string }
	| { op: 'show'; ref: string }
	/** Within its own list; with `into`, to that section of the page (G5). */
	| { op: 'move'; ref: string; before: string | null; into?: string }
	| { op: 'form'; ref: string; form: Form }
	/** A card's label on this page — the device keeps its own name elsewhere. */
	| { op: 'rename'; ref: string; name: string }
	/** A card for something that isn't generated here, added to the page. */
	| { op: 'add'; ref: string; into?: string; before?: string | null }
	| { op: 'remove'; ref: string }
	/**
	 * A section of this layer's own (G17): `ref` is `section:own-<n>`. Taken
	 * away with `remove`; placed, renamed and hidden like any section.
	 */
	| { op: 'section'; ref: string; title: string; layout: string }
	/** Where a card is on a free page (14 §3): its column and row, its width and height in cells. */
	| { op: 'place'; ref: string; x: number; y: number; w: number; h: number }
	/**
	 * A card's settings on this page: a plugin card's, as its settings element
	 * made them; a room's or the big numbers', only what this layer set (G13);
	 * a section's `layout` (G3).
	 */
	| { op: 'config'; ref: string; config: Record<string, unknown> };

/** A page someone made (G27): its changes are kept at `pages['page:<id>']`. */
export interface BuiltPage {
	id: string;
	name: string;
	/** One of the rooms' symbols (`ROOM_ICONS`); none, a page's own. */
	icon?: string;
}

/** A picture from the library behind words (design 15, P3): which part stays in view, how dark. */
export interface Photo {
	src?: string;
	/** 0 to 8, left to right, top to bottom; 4, the middle. */
	focus?: number;
	/** How dark behind the words, 0 to 70 (percent). */
	dim?: number;
}

export interface PersonDoc {
	version: number;
	/** The document's shape (`SCHEMA`); `version` counts saves. Absent is 1. */
	schema?: number;
	/** Every-room settings, by kind of card (G4): the room box's, the big numbers'. */
	defaults?: Record<string, Record<string, unknown>>;
	/** The frame: the sidebar's rooms as names, or with their status (G3). */
	shell?: { rooms?: 'names' | 'status' };
	/** Their photo, from the library (design 15): their picture when they choose it. */
	photo?: string;
	/** How they show to everyone: their photo, initials or an icon on a color (avatar.ts). */
	avatar?: AvatarChoice;
	/** Starred cards, in the order they appear in Favourites on Home. */
	favourites?: string[];
	/** Changes per page: `home`, `room:{id}`, `page:{id}`. */
	pages?: Record<string, Change[]>;
	/** Pages that are just this person's (G28), in their order. */
	built?: BuiltPage[];
	/** The phone bar's destinations, More always last (N2). */
	bar?: string[];
	/** Light or dark, or follow the device (V2). */
	theme?: 'system' | 'light' | 'dark';
	/** A theme other than the house's (D9a). */
	palette?: string;
	/** A look other than the house's (12, L1): a built-in one's id, the house's, or their own. */
	look?: string;
	/** Looks of their own (13 §15), read with `readLook`. */
	looks?: unknown[];
	/** °F or °C, US measures or metric; unset, the browser's (`units.ts`). */
	units?: UnitsChoice;
	/** The console look's own choices: its sidebar, its faders' and switches' style. */
	console?: ConsolePrefs;
	/**
	 * The device a room plays through, by room id, over the household's: a
	 * device id, or `''` for none (console/media.ts). Set from the room's
	 * bar by a person who may not change the household's, or by anyone in
	 * Customize's "Just me".
	 */
	roomAudio?: Record<string, string>;
}

/** Whether to ask before a command: always, never, or as the device declares (D2). */
export type Ask = 'always' | 'never';

/** The household's presentation settings and shared edits (M1, 04 §4). */
export interface HouseDoc {
	version: number;
	/** The document's shape (`SCHEMA`); `version` counts saves. Absent is 1. */
	schema?: number;
	/** The household's edits per page: `home`, `room:{id}`, `page:{id}`. */
	pages?: Record<string, Change[]>;
	/** The house's own pages (G28), in their order. */
	built?: BuiltPage[];
	/** Every-room settings, by kind of card (G4): the room box's, the big numbers'. */
	defaults?: Record<string, Record<string, unknown>>;
	/** The frame: the sidebar's rooms as names, or with their status (G3). */
	shell?: { rooms?: 'names' | 'status' };
	/** Each room's icon, by room id (D10). */
	icons?: Record<string, string>;
	/** Each room's photo, by room id (design 15): behind its header and its box on Home. */
	photos?: Record<string, Photo>;
	/** The phone bar for anyone who hasn't chosen their own (N2). */
	bar?: string[];
	/** The house's theme (D9a). */
	palette?: string;
	/** The house's look (12, L1); absent is Classic (L3). */
	look?: string;
	/** The house's own looks (13 §15), read with `readLook`. */
	looks?: unknown[];
	/** Confirmation overrides (D2): by device id, and by kind. */
	confirm?: { devices?: Record<string, Ask>; kinds?: Record<string, Ask> };
	/** The console look's faders and switches for anyone who hasn't chosen their own. */
	console?: ConsoleHouse;
	/**
	 * The one device each room plays through, by room id: a device id, or `''`
	 * for none. Unset, the room's first screen, else its first speaker (console/media.ts).
	 */
	roomAudio?: Record<string, string>;
}

export const ref = {
	device: (id: string) => `device:${id}`,
	room: (id: string) => `room:${id}`,
	scene: (id: string) => `scene:${id}`,
	/** A new plugin card: its own `n`, so the same card can be added twice. */
	card: (pluginId: string, element: string, n: string) => `card:${pluginId}/${element}/${n}`,
	/** One of the app's own cards, added to a page (G-c): its own `n`, as a plugin card's. */
	kind: (kind: string, n: string) => `kind:${kind}/${n}`
};

/** An app card's ref, read back. */
export function kindRef(r: string): { kind: string; n: string } | undefined {
	const m = /^kind:([a-z]+)\/([^/]+)$/.exec(r);
	return m ? { kind: m[1]!, n: m[2]! } : undefined;
}

/** A short id for something new: a card's `n`, an own section's. */
export const newId = () => Math.random().toString(36).slice(2, 10);

/** A plugin card's ref, read back. */
export function cardRef(r: string): { pluginId: string; element: string; n: string } | undefined {
	const m = /^card:([^/]+)\/([^/]+)\/([^/]+)$/.exec(r);
	return m ? { pluginId: m[1]!, element: m[2]!, n: m[3]! } : undefined;
}

/**
 * Add a change to a page's list, dropping the earlier ones it supersedes so
 * the list stays the size of what the person actually changed: hiding then
 * showing a card leaves one `show`; moving it twice leaves the last move.
 */
export function addChange(list: Change[] = [], change: Change): Change[] {
	const sameKind = (c: Change) => c.ref === change.ref && group(c.op) === group(change.op);
	return [...list.filter((c) => !sameKind(c)), change];
}

/** Changes that undo each other share a group; only the last of a group counts. */
const group = (op: Change['op']) =>
	op === 'show' ? 'hide' : op === 'remove' || op === 'section' ? 'add' : op;

export interface Layered<T> {
	/** In the person's order, hidden ones left out. */
	shown: T[];
	/** Hidden by this person — offered again in Customise. */
	hidden: T[];
	form: (ref: string) => Form | undefined;
	/** The label a card was given on this page, if it was renamed. */
	name: (ref: string) => string | undefined;
	/** A plugin card's settings on this page. */
	config: (ref: string) => Record<string, unknown> | undefined;
}

/**
 * The generated list for a page with the person's changes on top. `items`
 * arrive in the generated order; `refOf` names each one.
 */
export function apply<T>(
	items: T[],
	refOf: (item: T) => string,
	changes: Change[] = []
): Layered<T> {
	const order = items.map(refOf);
	const byRef = new Map(items.map((i) => [refOf(i), i]));
	const hidden = new Set<string>();
	const forms = new Map<string, Form>();
	const names = new Map<string, string>();
	const configs = new Map<string, Record<string, unknown>>();

	for (const c of changes) {
		switch (c.op) {
			case 'hide':
				hidden.add(c.ref);
				break;
			case 'show':
				hidden.delete(c.ref);
				break;
			case 'form':
				forms.set(c.ref, c.form);
				break;
			case 'config':
				configs.set(c.ref, c.config);
				break;
			case 'rename':
				if (c.name.trim() === '') names.delete(c.ref);
				else names.set(c.ref, c.name.trim());
				break;
			case 'move': {
				const from = order.indexOf(c.ref);
				if (from < 0) break; // It isn't here any more.
				if (c.before === c.ref) break; // Before itself: where it is.
				order.splice(from, 1);
				const to = c.before === null ? -1 : order.indexOf(c.before);
				if (to < 0) order.push(c.ref);
				else order.splice(to, 0, c.ref);
				break;
			}
		}
	}

	const shown: T[] = [];
	const hid: T[] = [];
	for (const r of order) {
		const item = byRef.get(r)!;
		(hidden.has(r) ? hid : shown).push(item);
	}
	return {
		shown,
		hidden: hid,
		form: (r) => forms.get(r),
		name: (r) => names.get(r),
		config: (r) => configs.get(r)
	};
}

/** The refs added to a page and not taken off again, in the order added. */
export function added(changes: Change[] = []): string[] {
	let out: string[] = [];
	for (const c of changes) {
		if (c.op === 'add' && !out.includes(c.ref)) out.push(c.ref);
		if (c.op === 'remove') out = out.filter((r) => r !== c.ref);
	}
	return out;
}

/**
 * The rooms in the order Home shows them (the Shell, More, Settings → Rooms).
 * Only changes among Home's rooms count: a move into another section takes
 * a card out of the rooms, it doesn't reorder them.
 */
export function homeRoomOrder<T>(
	rooms: T[],
	refOf: (room: T) => string,
	changes: Change[] = []
): Layered<T> {
	return apply(
		rooms,
		refOf,
		changes.filter((c) => c.op !== 'move' || c.into === undefined || c.into === 'rooms')
	);
}

// ---- the documents' shape (04 §7) ----

/**
 * The shape the documents are written in. 2 (G5): changes may name sections
 * (`section:<id>`) and move cards `into` one. Version 1 changes read the same
 * in 2, so moving up is only saying so; a newer shape is left as it is.
 */
export const SCHEMA = 2;

/** A household's or person's document, read in today's shape. Nothing is dropped. */
export function migrate<D extends { version: number; schema?: number }>(doc: D): D {
	return (doc.schema ?? 1) >= SCHEMA ? doc : { ...doc, schema: SCHEMA };
}

/** What a person sees: the household's changes, then their own on top (M3). */
export const layered = (house: Change[] = [], mine: Change[] = []): Change[] => [...house, ...mine];

/**
 * Changes that name something the page no longer has, for Edit mode to show
 * as "refers to something that's gone" (M2). Adds are judged elsewhere.
 */
export function gone(changes: Change[], present: Set<string>): Change[] {
	return changes.filter((c) => c.op !== 'add' && c.op !== 'remove' && !present.has(c.ref));
}

/**
 * The move that puts `ref` one place earlier or later among what is shown —
 * Customise's up and down buttons. `undefined` at either end.
 */
export function nudge(shown: string[], ref: string, by: -1 | 1): Change | undefined {
	const at = shown.indexOf(ref);
	const to = at + by;
	if (at < 0 || to < 0 || to >= shown.length) return undefined;
	// Moving down one is moving before the item two along (or to the end).
	const before = by === -1 ? shown[to]! : (shown[to + 1] ?? null);
	return { op: 'move', ref, before };
}

/** Favourites with one added or taken away. */
export function toggleFavourite(list: string[] = [], r: string): string[] {
	return list.includes(r) ? list.filter((x) => x !== r) : [...list, r];
}

/** Favourites with one moved a place earlier or later. */
export function nudgeFavourite(list: string[], r: string, by: -1 | 1): string[] {
	const at = list.indexOf(r);
	const to = at + by;
	if (at < 0 || to < 0 || to >= list.length) return list;
	const next = [...list];
	next.splice(at, 1);
	next.splice(to, 0, r);
	return next;
}

// ---- the phone bar (N2) ----

/** Where the phone bar can take you, besides More — and rooms and pages (G30). */
export const BAR_CHOICES = ['home', 'pages', 'scenes', 'alerts', 'search'] as const;
export const DEFAULT_BAR = ['home', 'scenes', 'alerts'];
/** Once there are pages to go to, Pages joins the default bar (N2, G30). */
const WITH_PAGES = ['home', 'pages', 'scenes', 'alerts'];
/** The bar holds this many destinations, then More. */
export const BAR_SIZE = 4;

/**
 * A bar made safe: known destinations, rooms or pages that are still there,
 * no repeats, at most four.
 */
function safeBar(bar: string[] | undefined, rooms: string[], pages: string[]): string[] {
	const ok = (d: string) =>
		(BAR_CHOICES as readonly string[]).includes(d) ||
		(d.startsWith('room:') && rooms.includes(d.slice(5))) ||
		(d.startsWith('page:') && pages.includes(d.slice(5)));
	return [...new Set((bar ?? []).filter(ok))].slice(0, BAR_SIZE);
}

const ids = (doc?: { built?: BuiltPage[] }) => (doc?.built ?? []).map((p) => p.id);

/** The household's bar (N2): what an admin chose, or the default. */
export function houseBar(
	house: HouseDoc | undefined,
	rooms: string[],
	mine: string[] = []
): string[] {
	const bar = safeBar(house?.bar, rooms, ids(house));
	if (bar.length > 0) return bar;
	return ids(house).length + mine.length > 0 ? WITH_PAGES : DEFAULT_BAR;
}

/** A person's bar: their own choice, else the household's. */
export function barOf(doc: PersonDoc | undefined, rooms: string[], house?: HouseDoc): string[] {
	const bar = safeBar(doc?.bar, rooms, [...ids(house), ...ids(doc)]);
	return bar.length > 0 ? bar : houseBar(house, rooms, ids(doc));
}

// ---- confirmation (D2) ----

/**
 * Whether to ask before a command. An admin's choice for the device wins,
 * then for its kind; otherwise the device decides — it asks where it
 * declared a prompt. Unlocking asks only where someone said so (C4).
 */
export function asks(
	house: HouseDoc | undefined,
	device: string,
	kind: string,
	declared: boolean
): boolean {
	const set = house?.confirm?.devices?.[device] ?? house?.confirm?.kinds?.[kind];
	return set === undefined ? declared : set === 'always';
}

/** The household's document with one confirmation choice set, or cleared (`undefined`). */
export function withAsk(
	doc: HouseDoc,
	by: 'devices' | 'kinds',
	key: string,
	ask: Ask | undefined
): HouseDoc {
	const set = { ...doc.confirm?.[by] };
	if (ask === undefined) delete set[key];
	else set[key] = ask;
	return { ...doc, confirm: { ...doc.confirm, [by]: set } };
}

// ---- themes (D9a) ----

/** The house's themes: the same shapes and type, a different colour. */
export const PALETTES = [
	{ id: 'amber', name: 'Amber', swatch: '#9a4a07' },
	{ id: 'sage', name: 'Sage', swatch: '#3f6b3a' },
	{ id: 'harbour', name: 'Harbour', swatch: '#1f5f8b' },
	{ id: 'plum', name: 'Plum', swatch: '#7a3b74' }
] as const;

// ---- looks (12, 13 §3) ----

/** Every look a person may choose: built in, the house's, their own. */
export const looksOf = (doc?: PersonDoc, house?: HouseDoc): Look[] =>
	allLooks(house?.looks, doc?.looks);

/** The look a person sees: their own, else the house's, else Classic (L1, L3). */
export function lookOf(doc?: PersonDoc, house?: HouseDoc, all = looksOf(doc, house)): Look {
	const has = (id?: string) => id !== undefined && all.some((l) => l.id === id);
	return findLook(all, has(doc?.look) ? doc?.look : has(house?.look) ? house?.look : 'classic');
}

/** The theme a person sees: their own, else the house's, else their look's, else Amber (13 §3.1). */
export function paletteOf(doc?: PersonDoc, house?: HouseDoc, l?: Look): string {
	const known = (p?: string) => PALETTES.some((x) => x.id === p);
	return known(doc?.palette)
		? doc!.palette!
		: known(house?.palette)
			? house!.palette!
			: known(l?.theme)
				? l!.theme!
				: 'amber';
}
