/**
 * Free layout (14): the whole page is one grid of 12 columns, and every card
 * has a place on it, a column, a row, a width and a height in cells.
 *
 * A page with no places of its own starts as its sections lay it out (§4):
 * each heading a full-width card, then its cards filled from the top left.
 * Once anyone places a card, every card is placed (`freeze`), and from then
 * on a new thing takes the first gap that fits it. When a card lands on
 * others, each moves aside the way it was going if its rows have room, else
 * down (§5, P2). Nothing ever overlaps; gaps stay until Tidy closes them.
 *
 * Plain data and functions, so all of it is tested without drawing.
 */
import type { Change } from './layers.js';

/** The grid's columns on a wide screen (P3). */
export const COLS = 12;

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Placed extends Box {
	ref: string;
}

/** What a page lays out, in the order its sections draw it. */
export interface Item {
	ref: string;
	w: number;
	h: number;
	/** Starts a new row below everything before it: a heading, a section drawn whole. */
	breaks?: boolean;
}

/** A place made to fit the grid: at least a cell, no wider than it, never off its left or top. */
export function fit(b: Box, cols = COLS): Box {
	const w = Math.max(1, Math.min(cols, Math.round(b.w)));
	const h = Math.max(1, Math.round(b.h));
	return {
		x: Math.max(0, Math.min(cols - w, Math.round(b.x))),
		y: Math.max(0, Math.round(b.y)),
		w,
		h
	};
}

const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const bottom = (placed: Box[]) => placed.reduce((n, p) => Math.max(n, p.y + p.h), 0);

const free = (placed: Box[], b: Box) => !placed.some((p) => overlaps(p, b));

/** The first spot `w` by `h` fits, from row `from` down, left to right in each row. */
export function firstGap(placed: Box[], w: number, h: number, cols = COLS, from = 0): Box {
	w = Math.min(cols, w);
	for (let y = from; ; y++)
		for (let x = 0; x + w <= cols; x++) {
			const b = { x, y, w, h };
			if (free(placed, b)) return b;
		}
}

/**
 * The starting layout (§4): each item in order at the first gap from the top
 * of its run; an item that `breaks` starts a run of its own below everything.
 */
export function flow(items: Item[], cols = COLS): Placed[] {
	const out: Placed[] = [];
	let top = 0;
	for (const it of items) {
		if (it.breaks) top = bottom(out);
		const at = firstGap(out, Math.min(cols, it.w), it.h, cols, top);
		out.push({ ref: it.ref, ...at });
	}
	return out;
}

/**
 * `ref` put at `to`, and whatever it covers moved out of its way (P2): aside,
 * the way the drag was going, if those rows have room; otherwise down below
 * it, and what that lands on moves down in turn. `dx` is the drag's way across:
 * below 0 left, above 0 right, 0 straight down.
 */
export function land(placed: Placed[], ref: string, to: Box, dx = 0, cols = COLS): Placed[] {
	const at = { ref, ...fit(to, cols) };
	const others = placed.filter((p) => p.ref !== ref);
	const out: Placed[] = [at];
	const moved: Placed[] = [];
	for (const p of others) {
		if (!overlaps(p, at)) {
			out.push(p);
			continue;
		}
		// Aside, in the same rows, if nothing's there.
		const x = dx > 0 ? at.x + at.w : dx < 0 ? at.x - p.w : -1;
		const aside = { ...p, x };
		if (x >= 0 && x + p.w <= cols && free([...out, ...others.filter((o) => o !== p)], aside)) {
			out.push(aside);
			continue;
		}
		moved.push({ ...p, y: at.y + at.h });
	}
	// Down, top first, each pushing what it lands on further down.
	for (const p of moved.sort((a, b) => a.y - b.y || a.x - b.x)) push(out, p);
	return out;
}

/** `p` added to `out`, and anything it now overlaps moved down below it, in turn. */
function push(out: Placed[], p: Placed) {
	out.push(p);
	for (;;) {
		const hit = out.find((o) => o !== p && overlaps(o, p));
		if (!hit) return;
		out.splice(out.indexOf(hit), 1);
		push(out, { ...hit, y: p.y + p.h });
	}
}

/** Tidy (P5): every card up as far as it goes, keeping its column. */
export function tidy(placed: Placed[]): Placed[] {
	const out: Placed[] = [];
	for (const p of [...placed].sort((a, b) => a.y - b.y || a.x - b.x)) {
		let y = p.y;
		while (y > 0 && free(out, { ...p, y: y - 1 })) y--;
		out.push({ ...p, y });
	}
	return out;
}

/** In reading order (P4): top to bottom, left to right. */
export const reading = (placed: Placed[]): Placed[] =>
	[...placed].sort((a, b) => a.y - b.y || a.x - b.x);

/** The places the changes give, in the order given: a later one wins. */
export function placesOf(changes: Change[]): Placed[] {
	return changes.flatMap((c) =>
		c.op === 'place' ? [{ ref: c.ref, x: c.x, y: c.y, w: c.w, h: c.h }] : []
	);
}

/**
 * The page laid out (§4, §5). With no places, it flows from its sections.
 * With some, each is landed in turn (the household's, then the person's on
 * top, so theirs wins); anything with no place takes the first gap that
 * fits it; a place naming something gone leaves its hole. In reading order.
 */
export function layout(items: Item[], changes: Change[] = [], cols = COLS): Placed[] {
	const places = placesOf(changes);
	if (places.length === 0) return flow(items, cols);
	const here = new Map(items.map((i) => [i.ref, i]));
	let out: Placed[] = [];
	for (const p of places) if (here.has(p.ref)) out = land(out, p.ref, p, 0, cols);
	for (const it of items)
		if (!out.some((p) => p.ref === it.ref))
			out.push({ ref: it.ref, ...firstGap(out, it.w, it.h, cols) });
	return reading(out);
}

/** Every card where it's drawn, as changes (§4): what the first place on a page writes. */
export const freeze = (placed: Placed[]): Change[] =>
	placed.map((p) => ({ op: 'place', ref: p.ref, x: p.x, y: p.y, w: p.w, h: p.h }));

/** How wide a card is in a narrower grid (P4): half or whole of a phone's four, and so on. */
export function across(w: number, cols: number): number {
	if (cols >= COLS) return w;
	// A phone: half for a card of the usual width, else the whole.
	if (cols <= 4) return w > 2 ? cols : Math.min(cols, 2);
	// Otherwise in twos, so cards still pair up.
	const n = Math.min(cols, Math.max(2, 2 * Math.ceil((w * cols) / (2 * COLS))));
	// Never a sliver left beside it.
	return cols - n < 2 ? cols : n;
}

/**
 * The page on a narrower grid (P4): its cards in reading order, each as wide
 * as `across` says, a card across the whole page starting a run of its own,
 * so nothing is pulled up past a heading.
 */
export function narrow(placed: Placed[], cols: number): Map<string, Box> {
	const out = flow(
		reading(placed).map((p) => ({
			ref: p.ref,
			w: across(p.w, cols),
			h: p.h,
			breaks: p.w >= COLS
		})),
		cols
	);
	return new Map(out.map(({ ref, ...b }) => [ref, b]));
}
