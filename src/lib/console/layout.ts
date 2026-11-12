/**
 * A room's layout in the console, as Customize arranges it (the
 * CustomizeConsole board): its favorites, its tabs' order, which are hidden
 * and which one it opens on, the Lights tab's columns and the lights hidden
 * from it, its picture and which header pills show.
 *
 * Two layers, the same shape: the household's (`HouseDoc.console.rooms`,
 * for people who may change the house's content) and each person's own
 * (`PersonDoc.console.rooms`). Each choice is the person's, else the
 * household's, else the room's own default. The picture and the pills are
 * the household's alone.
 *
 * A person's favorites are their stars (`PersonDoc.favourites`), the same
 * list Home shows: in a room, those in it. They show where the household
 * chose none for the room, and over the household's once the person makes
 * the room's favorites their own (`ownFavs`).
 *
 * Read from documents anyone can write, so anything this app doesn't know is
 * left out. Pure: the room and Customize draw what this decides.
 */
import { TABS, type LightsTab, type TabId } from './room.js';

/** How a room's header is drawn: its drawing, or plain. A photo comes later. */
export type PictureChoice = 'drawn' | 'plain';

export const PICTURE_CHOICES: readonly { id: PictureChoice | 'photo'; name: string }[] = [
	{ id: 'drawn', name: 'Drawn' },
	{ id: 'photo', name: 'Photo' },
	{ id: 'plain', name: 'Plain' }
];

export interface RoomLayout {
	/** The household's favorites for the room, as refs, in order. */
	favs?: string[];
	/** A person's: their own stars in the room show, over the household's favorites. */
	ownFavs?: boolean;
	/** The tabs' order; tabs it doesn't name follow in their own order. */
	tabs?: TabId[];
	/** Tabs left out. Never the one the room opens on. */
	hidden?: TabId[];
	/** The tab the room opens on. */
	opens?: TabId;
	/** The Lights tab's columns' order, by their keys (`blocksOf`). */
	columns?: string[];
	/** Lights and switches left off the room, by device id. */
	off?: string[];
	/** The household's: how the header is drawn. */
	picture?: PictureChoice;
	/** The household's: locks and doors whose pill the header leaves out, by device id. */
	pillsOff?: string[];
}

export type RoomLayouts = Record<string, RoomLayout>;

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));
const isTab = (v: unknown): v is TabId => typeof v === 'string' && TAB_IDS.has(v);
const strings = (v: unknown): string[] | undefined =>
	Array.isArray(v)
		? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))]
		: undefined;

/** One room's layout as it stands, from a document anyone could have written. */
export function layoutOf(v: unknown): RoomLayout {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
	const o = v as Record<string, unknown>;
	const out: RoomLayout = {};
	const favs = strings(o.favs);
	if (favs) out.favs = favs;
	if (o.ownFavs === true) out.ownFavs = true;
	const tabs = strings(o.tabs)?.filter(isTab);
	if (tabs?.length) out.tabs = tabs;
	const hidden = strings(o.hidden)?.filter(isTab);
	if (hidden?.length) out.hidden = hidden;
	if (isTab(o.opens)) out.opens = o.opens;
	const columns = strings(o.columns);
	if (columns?.length) out.columns = columns;
	const off = strings(o.off);
	if (off?.length) out.off = off;
	if (o.picture === 'drawn' || o.picture === 'plain') out.picture = o.picture;
	const pillsOff = strings(o.pillsOff);
	if (pillsOff?.length) out.pillsOff = pillsOff;
	return out;
}

/** A room's layout in a layer: `rooms` as a document holds them. */
export const roomIn = (rooms: unknown, room: string): RoomLayout =>
	typeof rooms === 'object' && rooms !== null && !Array.isArray(rooms)
		? layoutOf((rooms as Record<string, unknown>)[room])
		: {};

/**
 * A layer's console choices with one room's layout changed by `patch`: a
 * field set to `undefined` is taken out, and a room left with nothing, or a
 * layer with no rooms, is none.
 */
export function withRoomLayout<C extends { rooms?: RoomLayouts }>(
	c: C | undefined,
	room: string,
	patch: Partial<Record<keyof RoomLayout, unknown>>
): C | undefined {
	const { rooms, ...rest } = (c ?? {}) as C;
	const all: RoomLayouts = { ...(rooms ?? {}) };
	const next = layoutOf({ ...roomIn(rooms, room), ...patch });
	if (Object.keys(next).length > 0) all[room] = next;
	else delete all[room];
	const out = (Object.keys(all).length > 0 ? { ...rest, rooms: all } : rest) as C;
	return Object.keys(out).length > 0 ? out : undefined;
}

/** A layer's console choices without one room's layout: "Go back to …". */
export const withoutRoom = <C extends { rooms?: RoomLayouts }>(
	c: C | undefined,
	room: string
): C | undefined => {
	const { rooms: _drop, ...rest } = (c ?? {}) as C;
	const all = { ...(c?.rooms ?? {}) };
	delete all[room];
	const out = (Object.keys(all).length > 0 ? { ...rest, rooms: all } : rest) as C;
	return Object.keys(out).length > 0 ? out : undefined;
};

// ---- the two layers together ----

/** A room's layout as a person sees it: each choice theirs, else the household's. */
export interface Resolved {
	favs: string[];
	tabs?: TabId[];
	hidden: TabId[];
	opens?: TabId;
	columns?: string[];
	off: string[];
	picture: PictureChoice;
	pillsOff: string[];
}

/**
 * The person's layer over the household's over the room's defaults. `stars`
 * is the person's favorites in this room, in their order. With no person's
 * layer (`mine` undefined), the household's layout alone, as Customize shows
 * it for everyone.
 */
export function resolve(
	mine: RoomLayout | undefined,
	house: RoomLayout,
	stars: string[] = []
): Resolved {
	const m = mine ?? {};
	return {
		favs: mine ? (m.ownFavs ? stars : (house.favs ?? stars)) : (house.favs ?? []),
		tabs: m.tabs ?? house.tabs,
		hidden: m.hidden ?? house.hidden ?? [],
		opens: m.opens ?? house.opens,
		columns: m.columns ?? house.columns,
		off: m.off ?? house.off ?? [],
		picture: house.picture ?? 'drawn',
		pillsOff: house.pillsOff ?? []
	};
}

/** `items` in `order`: the ones it names first, as it names them, then the rest as they were. */
export function ordered<T>(items: readonly T[], keyOf: (t: T) => string, order?: string[]): T[] {
	if (!order?.length) return [...items];
	const at = (t: T) => {
		const i = order.indexOf(keyOf(t));
		return i < 0 ? order.length : i;
	};
	return items
		.map((t, i) => ({ t, i }))
		.sort((a, b) => at(a.t) - at(b.t) || a.i - b.i)
		.map((x) => x.t);
}

/**
 * A room's tabs as its layout has them: in order, the hidden ones apart, and
 * the one it opens on. That one is never hidden, and when every tab would
 * be, none is.
 */
export function arrangeTabs<T extends { id: TabId }>(
	tabs: readonly T[],
	l: Pick<Resolved, 'tabs' | 'hidden' | 'opens'>
): { shown: T[]; hidden: T[]; opens: TabId | undefined } {
	const all = ordered(tabs, (t) => t.id, l.tabs);
	const opensHere = all.some((t) => t.id === l.opens) ? l.opens : undefined;
	const off = (t: T) => t.id !== opensHere && l.hidden.includes(t.id);
	let shown = all.filter((t) => !off(t));
	if (shown.length === 0) shown = all;
	return {
		shown,
		hidden: all.filter((t) => !shown.includes(t)),
		opens: opensHere ?? shown[0]?.id
	};
}

/** The tab to show: the one asked for when it's shown, else the one the room opens on. */
export function tabToShow(
	a: { shown: { id: TabId }[]; opens: TabId | undefined },
	asked: string | null | undefined
): TabId | undefined {
	return a.shown.find((t) => t.id === asked)?.id ?? a.opens;
}

// ---- the Lights tab's columns ----

/** One column of the Lights tab, in the order it's drawn. */
export type Block =
	| { key: string; kind: 'column'; index: number }
	| { key: 'switches'; kind: 'switches' }
	| { key: string; kind: 'keypad'; index: number }
	| { key: 'scenes'; kind: 'scenes' };

/**
 * The Lights tab's columns in `order`: each lighting group's, the switches',
 * each keypad's (`keypad:<id>`), the loose scenes'. By default in that order.
 */
export function blocksOf(
	t: Pick<LightsTab, 'columns' | 'switches' | 'keypads' | 'scenes'>,
	order?: string[]
): Block[] {
	const all: Block[] = [
		...t.columns.map((c, index) => ({ key: c.key, kind: 'column' as const, index })),
		...(t.switches.length > 0 ? [{ key: 'switches' as const, kind: 'switches' as const }] : []),
		...t.keypads.map((k, index) => ({
			key: `keypad:${k.device_id}`,
			kind: 'keypad' as const,
			index
		})),
		...(t.scenes.length > 0 ? [{ key: 'scenes' as const, kind: 'scenes' as const }] : [])
	];
	return ordered(all, (b) => b.key, order);
}

// ---- arranging ----

/** `list` with `item` moved `by` places, or as it was at either end. */
export function nudged<T>(list: readonly T[], item: T, by: number): T[] {
	const at = list.indexOf(item);
	const to = at + by;
	if (at < 0 || to < 0 || to >= list.length) return [...list];
	const out = [...list];
	out.splice(at, 1);
	out.splice(to, 0, item);
	return out;
}

/** `list` with `item` taken out, or put in at the end. */
export const flipped = <T>(list: readonly T[], item: T): T[] =>
	list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

/**
 * A person's stars with this room's put in `room` order: each of the room's
 * goes where one of the room's was, so the rest keep their places on Home.
 * Stars of the room `room` doesn't name are taken off; ones it adds go last.
 */
export function withRoomStars(stars: readonly string[], inRoom: Set<string>, room: string[]) {
	const queue = [...room];
	const out: string[] = [];
	for (const s of stars) {
		if (!inRoom.has(s)) out.push(s);
		else if (queue.length > 0) out.push(queue.shift()!);
	}
	return [...out, ...queue.filter((s) => !out.includes(s))];
}
