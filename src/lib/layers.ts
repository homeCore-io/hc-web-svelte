/**
 * Personal layers (M2–M4): a person's own changes on top of the generated
 * pages, as lists of small changes named by stable ids — never a copy of a
 * page. So a new device still appears in its room, and the changes survive.
 *
 * Ids name what a card is about: `device:{id}`, `room:{id}`, `scene:{id}`.
 * A change naming something that no longer exists is kept and skipped.
 *
 * One document per person, on the UI server (`/ui/prefs`), only theirs.
 */

export type Form = 'compact' | 'standard' | 'large';

export type Change =
	| { op: 'hide'; ref: string }
	| { op: 'show'; ref: string }
	| { op: 'move'; ref: string; before: string | null }
	| { op: 'form'; ref: string; form: Form };

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
}

export const ref = {
	device: (id: string) => `device:${id}`,
	room: (id: string) => `room:${id}`,
	scene: (id: string) => `scene:${id}`
};

/**
 * Add a change to a page's list, dropping the earlier ones it supersedes so
 * the list stays the size of what the person actually changed: hiding then
 * showing a card leaves one `show`; moving it twice leaves the last move.
 */
export function addChange(list: Change[] = [], change: Change): Change[] {
	const sameKind = (c: Change) =>
		c.ref === change.ref &&
		(change.op === 'move'
			? c.op === 'move'
			: change.op === 'form'
				? c.op === 'form'
				: c.op === 'hide' || c.op === 'show');
	return [...list.filter((c) => !sameKind(c)), change];
}

export interface Layered<T> {
	/** In the person's order, hidden ones left out. */
	shown: T[];
	/** Hidden by this person — offered again in Customise. */
	hidden: T[];
	form: (ref: string) => Form | undefined;
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
	return { shown, hidden: hid, form: (r) => forms.get(r) };
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

/** A person's bar, made safe: known destinations or rooms, no repeats, at most four. */
export function barOf(doc: PersonDoc | undefined, rooms: string[]): string[] {
	const ok = (d: string) =>
		(BAR_CHOICES as readonly string[]).includes(d) ||
		(d.startsWith('room:') && rooms.includes(d.slice(5)));
	const chosen = (doc?.bar ?? DEFAULT_BAR).filter(ok);
	const unique = [...new Set(chosen)].slice(0, BAR_SIZE);
	return unique.length > 0 ? unique : DEFAULT_BAR;
}
