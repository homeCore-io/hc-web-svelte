/**
 * A page's sections as what the free grid lays out (14 §4, §6): each heading
 * a full-width card, then its cards one by one. A section a look draws as one
 * box (a list, swatches, a panel, folded) is placed whole, its heading with it.
 */
import type { Change, Form, Layered } from './layers.js';
import { sectionRef, type Card, type Layout, type ShownSection } from './page.js';
import { COLS, type Item } from './free.js';

/** A card's usual size in cells (14 §7), by its form. */
export const FORM_CELLS: Record<Form, { w: number; h: number }> = {
	compact: { w: 2, h: 1 },
	standard: { w: 2, h: 2 },
	large: { w: 4, h: 3 }
};

/** Laid out one by one; any other layout is drawn whole. */
const ONE_BY_ONE: Layout[] = ['grid', 'row'];

export type Piece =
	/** `hidden`: its title alone is hidden (N1), shown faded while arranging. */
	| { kind: 'heading'; section: ShownSection; hidden?: boolean }
	| { kind: 'whole'; section: ShownSection }
	| { kind: 'card'; section: ShownSection; card: Card; g: Layered<Card> };

/**
 * A section drawn as one card: about how many rows it takes, by its layout
 * and how much it holds, so it doesn't stretch the rows beside it (14 §8).
 * Its heading is the first. A cell is taken as about 90 pixels across.
 */
export function wholeRows(layout: Layout, n: number, w: number): number {
	const across = (px: number) => Math.max(1, Math.floor((w * 90) / px));
	switch (layout) {
		case 'lines':
		case 'list':
		case 'joined':
			return 1 + Math.ceil((n * 42) / 64);
		case 'fold':
			return 1;
		case 'panel':
			return 1 + 2 * Math.ceil(n / across(104));
		case 'chips':
		case 'swatches':
			return 1 + Math.ceil(n / across(130));
		case 'row':
			return 1 + Math.ceil(n / Math.max(1, Math.floor(w / 2)));
		default:
			return 2;
	}
}

/**
 * A heading's own ref on a free page (14 §8, N1): hiding it hides the title
 * and nothing under it. A section hidden before (`section:<id>`) still hides
 * all it held, until it's shown again.
 */
export const headingRef = (id: string) => `heading:${id}`;

/** Whether the changes leave `ref` hidden: the last hide or show of it wins. */
export function hiddenIn(changes: Change[], ref: string): boolean {
	let out = false;
	for (const c of changes)
		if (c.ref === ref && (c.op === 'hide' || c.op === 'show')) out = c.op === 'hide';
	return out;
}

/**
 * What the page lays out, in its sections' order, and what each is. `cells`
 * says a card's size; `drawn` whether a section shows at all. While
 * arranging, hidden cards are laid out too, and a hidden section's heading,
 * so they can be shown again.
 */
export function piecesOf(
	sections: ShownSection[],
	cells: (card: Card, g: Layered<Card>, layout: Layout) => { w: number; h: number },
	drawn: (s: ShownSection) => boolean,
	arranging = false,
	/**
	 * Where a section starts (14 §8): a look's area, its columns and whether it's
	 * beside the main one, whose cards are one a row; null, not drawn here.
	 */
	areaOf: (
		s: ShownSection
	) => { x: number; w: number; row?: number; beside?: boolean } | null | undefined = () =>
		undefined,
	/** Whether a section's title alone is hidden (N1). */
	titleHidden: (s: ShownSection) => boolean = () => false
): { items: Item[]; pieces: Map<string, Piece> } {
	const items: Item[] = [];
	const pieces = new Map<string, Piece>();
	// A thing shown in one section and hidden in another (a room's scenes) is
	// laid out where it's shown.
	const shownSomewhere = new Set(
		sections.flatMap((s) => (s.hidden ? [] : s.groups.flatMap((g) => g.shown.map((c) => c.ref))))
	);
	for (const s of sections) {
		if (!drawn(s) || (s.hidden && !arranging)) continue;
		const a = areaOf(s);
		if (a === null) continue;
		const area = a && { x: a.x, w: a.w, row: a.row };
		const across = a?.w ?? COLS;
		const sec = s.section;
		const ref = sectionRef(sec.id);
		if (s.hidden) {
			items.push({ ref, w: across, h: 1, breaks: true, area });
			pieces.set(ref, { kind: 'heading', section: s });
			continue;
		}
		if (!ONE_BY_ONE.includes(s.layout) || sec.bare || sec.lead) {
			const n = s.groups.reduce((k, g) => k + g.shown.length, 0);
			items.push({ ref, w: across, h: wholeRows(s.layout, n, across), breaks: true, area });
			pieces.set(ref, { kind: 'whole', section: s });
			continue;
		}
		const off = titleHidden(s);
		if (!sec.headless && (!off || arranging)) {
			items.push({ ref, w: across, h: 1, breaks: true, area });
			pieces.set(ref, { kind: 'heading', section: s, hidden: off || undefined });
		}
		let first = sec.headless;
		for (const g of s.groups)
			for (const card of arranging
				? [...g.shown, ...g.hidden.filter((c) => !shownSomewhere.has(c.ref))]
				: g.shown) {
				if (pieces.has(card.ref)) continue;
				const size = cells(card, g, s.layout);
				items.push({
					ref: card.ref,
					...size,
					// Beside the main area, one a row, as wide as it; elsewhere no wider than it.
					w: a?.beside ? a.w : Math.min(size.w, across),
					area,
					breaks: first || undefined,
					kin: sec.id
				});
				first = false;
				pieces.set(card.ref, { kind: 'card', section: s, card, g });
			}
	}
	return { items, pieces };
}

export interface Size {
	w: number;
	h: number;
}

/** How small and large a card can be (14 §7); `snap`, only its usual sizes. */
export interface Range {
	min: Size;
	max: Size;
	/** Its usual sizes, smallest first: a click on its corner steps through them. */
	usual: Size[];
	/** A drawing that knows only its three sizes (a plugin's card): its corner snaps between them. */
	snap: boolean;
}

const sz = (w: number, h: number): Size => ({ w, h });

/** Players and readings can grow wide, to show more (14 §7). */
const GROWS = new Set(['media_player', 'tv', 'speaker', 'temperature_sensor', 'weather_station']);

/**
 * A card's sizes in cells (14 §7). `device` is a device card's kind of
 * device; `usual` its forms' sizes, smallest first.
 */
export function rangeOf(card: Card, device: string | undefined, usual: Size[]): Range {
	const r = (min: Size, max: Size, snap = false): Range => ({ min, max, usual, snap });
	switch (card.kind) {
		case 'heading':
			return r(sz(2, 1), sz(COLS, 2));
		case 'title':
			return r(sz(2, 1), sz(COLS, 4));
		case 'divider':
			return r(sz(2, 1), sz(COLS, 1));
		case 'space':
			return r(sz(1, 1), sz(COLS, 12));
		case 'picture':
			return r(sz(2, 2), sz(COLS, 12));
		case 'link':
			return r(sz(2, 1), sz(6, 2));
		case 'clock':
			return r(sz(2, 1), sz(COLS, 6));
		case 'stack':
			return r(sz(2, 3), sz(COLS, 10));
		case 'scene':
			return r(sz(2, 1), sz(4, 2));
		case 'plugin':
			// Its element says only its forms: those sizes and no others.
			return usual.length > 0 ? r(usual[0]!, usual.at(-1)!, true) : r(sz(2, 1), sz(COLS, 6));
		case 'roomhead':
		case 'needs':
		case 'batteries':
			return r(sz(6, 1), sz(COLS, 4));
		case 'device':
			if (card.scene) return r(sz(2, 1), sz(4, 2));
			if (device === 'thermostat') return r(sz(4, 4), sz(8, 6));
			return r(sz(2, 1), GROWS.has(device ?? '') ? sz(COLS, 6) : sz(6, 4));
		default:
			return r(sz(2, 1), sz(COLS, 6));
	}
}

/** A size kept within its range: the nearest usual one, if it snaps. */
export function within(range: Range, s: Size): Size {
	if (range.snap && range.usual.length > 0)
		return range.usual.reduce((best, u) =>
			Math.abs(u.w - s.w) + Math.abs(u.h - s.h) < Math.abs(best.w - s.w) + Math.abs(best.h - s.h)
				? u
				: best
		);
	return {
		w: Math.max(range.min.w, Math.min(range.max.w, s.w)),
		h: Math.max(range.min.h, Math.min(range.max.h, s.h))
	};
}

/**
 * Which of its drawings a card shows in its place (14 §7): the largest whose
 * usual size fits, else its smallest.
 */
export function formFor(place: Size, forms: { form: Form; size: Size }[]): Form | undefined {
	let out = forms[0]?.form;
	for (const f of forms) if (f.size.w <= place.w && f.size.h <= place.h) out = f.form;
	return out;
}
