/**
 * Personal layers (M2–M4): a person's own changes on top of the generated
 * pages, as lists of small changes named by stable ids — never a copy of a
 * page. So a new device still appears in its room, and the changes survive.
 *
 * Ids name what a card is about: `device:{id}`, `room:{id}`, `scene:{id}`,
 * or `card:{plugin}/{element}/{n}` for a plugin's own card, added to a page.
 * A change naming something that no longer exists is kept and skipped.
 *
 * Two owners, the same kind of list (04 §3): the household's edits, made in
 * Edit mode by people who may (`/ui/house`), and each person's own, made in
 * Customise (`/ui/prefs`, only theirs). A screen shows the generated page with
 * the household's changes and then the person's on top, so a person may show
 * again what the household hid (M3).
 */

export type Form = 'compact' | 'standard' | 'large';

export type Change =
	| { op: 'hide'; ref: string }
	| { op: 'show'; ref: string }
	| { op: 'move'; ref: string; before: string | null }
	| { op: 'form'; ref: string; form: Form }
	/** A card's label on this page — the device keeps its own name elsewhere. */
	| { op: 'rename'; ref: string; name: string }
	/** A card for something that isn't generated here, added to the page. */
	| { op: 'add'; ref: string }
	| { op: 'remove'; ref: string }
	/** A plugin card's settings on this page, as its settings element made them. */
	| { op: 'config'; ref: string; config: Record<string, unknown> };

export interface PersonDoc {
	version: number;
	/** Starred cards, in the order they appear in Favourites on Home. */
	favourites?: string[];
	/** Changes per page: `home`, `room:{id}`. */
	pages?: Record<string, Change[]>;
	/** The phone bar's destinations, More always last (N2). */
	bar?: string[];
	/** Light or dark, or follow the device (V2). */
	theme?: 'system' | 'light' | 'dark';
	/** A theme other than the house's (D9a). */
	palette?: string;
}

/** Whether to ask before a command: always, never, or as the device declares (D2). */
export type Ask = 'always' | 'never';

/** The household's presentation settings and shared edits (M1, 04 §4). */
export interface HouseDoc {
	version: number;
	/** The household's edits per page: `home`, `room:{id}`. */
	pages?: Record<string, Change[]>;
	/** Each room's icon, by room id (D10). */
	icons?: Record<string, string>;
	/** The phone bar for anyone who hasn't chosen their own (N2). */
	bar?: string[];
	/** The house's theme (D9a). */
	palette?: string;
	/** Confirmation overrides (D2): by device id, and by kind. */
	confirm?: { devices?: Record<string, Ask>; kinds?: Record<string, Ask> };
}

export const ref = {
	device: (id: string) => `device:${id}`,
	room: (id: string) => `room:${id}`,
	scene: (id: string) => `scene:${id}`,
	/** A new plugin card: its own `n`, so the same card can be added twice. */
	card: (pluginId: string, element: string, n: string) => `card:${pluginId}/${element}/${n}`
};

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
const group = (op: Change['op']) => (op === 'show' ? 'hide' : op === 'remove' ? 'add' : op);

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

/** Where the phone bar can take you, besides More. */
export const BAR_CHOICES = ['home', 'pages', 'scenes', 'alerts', 'search'] as const;
export const DEFAULT_BAR = ['home', 'pages', 'scenes'];
/** The bar holds this many destinations, then More. */
export const BAR_SIZE = 4;

/** A bar made safe: known destinations or rooms, no repeats, at most four. */
function safeBar(bar: string[] | undefined, rooms: string[]): string[] {
	const ok = (d: string) =>
		(BAR_CHOICES as readonly string[]).includes(d) ||
		(d.startsWith('room:') && rooms.includes(d.slice(5)));
	return [...new Set((bar ?? []).filter(ok))].slice(0, BAR_SIZE);
}

/** The household's bar (N2): what an admin chose, or the default. */
export function houseBar(house: HouseDoc | undefined, rooms: string[]): string[] {
	const bar = safeBar(house?.bar, rooms);
	return bar.length > 0 ? bar : DEFAULT_BAR;
}

/** A person's bar: their own choice, else the household's. */
export function barOf(doc: PersonDoc | undefined, rooms: string[], house?: HouseDoc): string[] {
	const bar = safeBar(doc?.bar, rooms);
	return bar.length > 0 ? bar : houseBar(house, rooms);
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

/** The theme a person sees: their own, else the house's, else Amber. */
export function paletteOf(doc?: PersonDoc, house?: HouseDoc): string {
	const known = (p?: string) => PALETTES.some((x) => x.id === p);
	return known(doc?.palette) ? doc!.palette! : known(house?.palette) ? house!.palette! : 'amber';
}
