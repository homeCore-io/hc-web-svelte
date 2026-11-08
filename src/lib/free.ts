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
	/** Its heading: on a placed page, a new card takes the first gap under it (14 §6, Add here). */
	after?: string;
	/**
	 * Where its section starts (14 §8): the columns of a look's area, the main
	 * one or the one beside it. A starting layout flows it there; left out, the
	 * whole width.
	 */
	area?: { x: number; w: number };
	/**
	 * Changes that size it, after which its place takes its usual size again:
	 * a new form from its tools or its settings; a stack's own width and height.
	 */
	sizedBy?: Change['op'][];
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

/**
 * The first spot `w` by `h` fits, from row `from` down, left to right in
 * each row; within columns `x0` to `x0 + span` if given.
 */
export function firstGap(
	placed: Box[],
	w: number,
	h: number,
	cols = COLS,
	from = 0,
	x0 = 0,
	span = cols
): Box {
	w = Math.min(span, w);
	for (let y = from; ; y++)
		for (let x = x0; x + w <= x0 + span; x++) {
			const b = { x, y, w, h };
			if (free(placed, b)) return b;
		}
}

/**
 * The starting layout (§4): each item in order at the first gap from the top
 * of its run; an item that `breaks` starts a run of its own below everything
 * in its columns. An item with an `area` flows within it (§8), so a look's
 * main area and the one beside it fill side by side under what's across the top.
 */
export function flow(items: Item[], cols = COLS): Placed[] {
	const out: Placed[] = [];
	const tops = new Map<string, number>();
	for (const it of items) {
		const a = it.area ?? { x: 0, w: cols };
		const key = `${a.x}:${a.w}`;
		if (it.breaks) tops.set(key, bottom(out.filter((p) => p.x < a.x + a.w && a.x < p.x + p.w)));
		const at = firstGap(out, Math.min(a.w, it.w), it.h, cols, tops.get(key) ?? 0, a.x, a.w);
		out.push({ ref: it.ref, ...at });
	}
	return out;
}

/**
 * `ref` put at `to`, and whatever it covers moved out of its way (P2): aside,
 * the way the drag was going, if those rows have room; otherwise down below
 * it. Everything else keeps its place unless something now sits on it, and
 * then moves down; a card never ends up above one it was below, so cards
 * keep under their heading. `dx` is the drag's way across: below 0 left,
 * above 0 right, 0 straight down.
 */
export function land(placed: Placed[], ref: string, to: Box, dx = 0, cols = COLS): Placed[] {
	const at = { ref, ...fit(to, cols) };
	const others = placed.filter((p) => p.ref !== ref);
	const covered = others.filter((p) => overlaps(p, at));
	const out: Placed[] = [at];
	// Aside, in the same rows, where nothing else is.
	const aside = new Map<Placed, Placed>();
	const x0 = (p: Placed) => (dx > 0 ? at.x + at.w : dx < 0 ? at.x - p.w : -1);
	for (const p of covered) {
		const q = { ...p, x: x0(p) };
		const rest = [...out, ...others.filter((o) => !covered.includes(o))];
		if (dx !== 0 && q.x >= 0 && q.x + q.w <= cols && free(rest, q)) {
			aside.set(p, q);
			out.push(q);
		}
	}
	// The rest top first, each below what it was below, then down until free.
	const done: [Placed, Placed][] = [...aside];
	for (const p of reading(others)) {
		if (aside.has(p)) continue;
		let y = p.y;
		for (const [o, n] of done)
			if (o.y + o.h <= p.y && o.x < p.x + p.w && p.x < o.x + o.w) y = Math.max(y, n.y + n.h);
		const q = { ...p, y };
		while (!free(out, q)) q.y++;
		out.push(q);
		done.push([p, q]);
	}
	return out;
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
	changes.forEach((c, i) => {
		const it = here.get(c.ref);
		if (c.op !== 'place' || !it) return;
		const later = changes.slice(i + 1).filter((d) => d.ref === c.ref);
		// Moved to another heading since (Move to): the first gap under it.
		if (later.some((d) => (d.op === 'move' && d.into !== undefined) || d.op === 'add')) return;
		// Sized since it was placed: where it was, at its usual size.
		const by = it.sizedBy ?? ['form'];
		const sized = later.some((d) => by.includes(d.op));
		out = land(out, c.ref, sized ? { ...c, w: it.w, h: it.h } : c, 0, cols);
	});
	for (const it of items) {
		if (out.some((p) => p.ref === it.ref)) continue;
		const head = it.after === undefined ? undefined : out.find((p) => p.ref === it.after);
		const from = head ? head.y + head.h : 0;
		out.push({ ref: it.ref, ...firstGap(out, it.w, it.h, cols, from) });
	}
	return reading(out);
}

/**
 * Up and down in a card's tools (14 §5): it trades places with the card before
 * or after it in reading order, which moves aside into the spot it left.
 */
export function step(placed: Placed[], ref: string, by: -1 | 1, cols = COLS): Placed[] {
	const order = reading(placed);
	const at = order.findIndex((p) => p.ref === ref);
	const other = order[at + by];
	if (at < 0 || !other) return placed;
	const me = order[at]!;
	return land(placed, ref, { x: other.x, y: other.y, w: me.w, h: me.h }, -by, cols);
}

/** Where a card is, said (14 §5): "row 2, columns 1 to 6". */
export function where(b: Box): string {
	const cols = b.w === 1 ? `column ${b.x + 1}` : `columns ${b.x + 1} to ${b.x + b.w}`;
	return `row ${b.y + 1}, ${cols}`;
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
