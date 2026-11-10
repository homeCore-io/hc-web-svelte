/**
 * Free layout (14): the whole page is one grid of 12 columns, and every card
 * has a place on it, a column, a row, a width and a height in cells.
 *
 * A page with no places of its own starts as its sections lay it out (§4):
 * each heading a full-width card, then its cards filled from the top left.
 * Once anyone places a card, every card is placed (`freeze`), and from then
 * on a new thing lands with its kind (N4): in the first gap from the row of
 * the last card like it, or at the bottom if there's none. When a card lands on
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
	/**
	 * What it starts among (14 §8, N4): the look's kind of thing it is, or what it
	 * was added to. On a placed page a new card lands with the last of its kind.
	 * A heading is none: it labels what's under it and holds nothing (N1).
	 */
	kin?: string;
	/**
	 * Where its section starts (14 §8): the columns of a look's area, the main
	 * one or the one beside it. A starting layout flows it there; left out, the
	 * whole width.
	 */
	area?: { x: number; w: number; row?: number };
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
 * main area and the one beside it fill side by side under what's across the
 * top; a row of areas starts below what the rows above have in its columns,
 * and below their first line of cards.
 */
export function flow(items: Item[], cols = COLS): Placed[] {
	const out: Placed[] = [];
	const rows: number[] = [];
	const tops = new Map<string, number>();
	for (const it of items) {
		const a = it.area ?? { x: 0, w: cols };
		const row = a.row ?? 0;
		const key = `${row}:${a.x}:${a.w}`;
		if (it.breaks) {
			// Below what’s in its columns, and below the first line of cards in the
			// rows above, so they read across the top; a card further down there
			// (a stack under the doors) leaves the room beside it to this area.
			const above = out.filter((_, i) => rows[i]! < row);
			const cards = above.filter((p) => p.w < cols);
			const line = Math.min(...cards.map((p) => p.y));
			const mine = out.filter(
				(p, i) => (rows[i]! < row && p.y === line) || (p.x < a.x + a.w && a.x < p.x + p.w)
			);
			tops.set(key, bottom(mine));
		}
		const at = firstGap(out, Math.min(a.w, it.w), it.h, cols, tops.get(key) ?? 0, a.x, a.w);
		out.push({ ref: it.ref, ...at });
		rows.push(row);
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
 * top, so theirs wins); anything with no place lands with its kind (N4); a
 * place naming something gone leaves its hole. In reading order.
 */
export function layout(items: Item[], changes: Change[] = [], cols = COLS): Placed[] {
	const places = placesOf(changes);
	const kinOf = new Map(items.map((i) => [i.ref, i.kin]));
	if (places.length === 0) return pack(flow(items, cols), kinOf);
	const here = new Map(items.map((i) => [i.ref, i]));
	let out: Placed[] = [];
	changes.forEach((c, i) => {
		const it = here.get(c.ref);
		if (c.op !== 'place' || !it) return;
		const later = changes.slice(i + 1).filter((d) => d.ref === c.ref);
		// Moved or added among others since: it lands with them.
		if (later.some((d) => (d.op === 'move' && d.into !== undefined) || d.op === 'add')) return;
		// Sized since it was placed: where it was, at its usual size.
		const by = it.sizedBy ?? ['form'];
		const sized = later.some((d) => by.includes(d.op));
		out = land(out, c.ref, sized ? { ...c, w: it.w, h: it.h } : c, 0, cols);
	});
	for (const it of items) {
		if (out.some((p) => p.ref === it.ref)) continue;
		const a = it.area ?? { x: 0, w: cols };
		const like = it.kin === undefined ? [] : out.filter((p) => kinOf.get(p.ref) === it.kin);
		const last = reading(like).at(-1);
		const w = Math.min(a.w, it.w);
		// In its area: after the last like it, in its row; else on the line under
		// all like it, the cards there moving down to make room, so it never lands
		// past another section’s title; with none like it, under its own title if
		// that’s on the page, else under everything there.
		const beside = last && { x: last.x + last.w, y: last.y, w, h: it.h };
		if (beside && beside.x + w <= a.x + a.w && free(out, beside)) {
			out.push({ ref: it.ref, ...beside });
			continue;
		}
		const title = it.kin === undefined ? undefined : out.find((p) => p.ref === `section:${it.kin}`);
		const near = last ? like : title ? [title] : [];
		if (near.length > 0) {
			const under = {
				x: Math.max(a.x, Math.min(...near.map((p) => p.x))),
				y: bottom(near),
				w,
				h: it.h
			};
			out = land(out, it.ref, under, 0, cols);
			continue;
		}
		const at = firstGap(
			out,
			w,
			it.h,
			cols,
			bottom(out.filter((p) => p.x < a.x + a.w && a.x < p.x + p.w)),
			a.x,
			a.w
		);
		out.push({ ref: it.ref, ...at });
	}
	return pack(out, kinOf);
}

/**
 * Every card up against what is above it in its columns, in reading order,
 * a section's cards after its title. Saved places go stale (a section drawn
 * elsewhere now, a card grown or gone) and left bands of nothing and a
 * column pushed down by the one beside it; packed, nothing waits on a gap.
 * Columns and order are kept.
 */
export function pack(placed: Placed[], kinOf: Map<string, string | undefined>): Placed[] {
	const order = reading(placed);
	// Under a title in a column of its own (beside the main area), its cards
	// read after it: one left above it moves to just after it. A title across
	// the page is left alone, a card a person put above it with it.
	const under = (title: Placed, p: Placed) =>
		title.w < COLS &&
		title.x <= p.x &&
		p.x + p.w <= title.x + title.w &&
		kinOf.get(p.ref) === title.ref.slice('section:'.length);
	for (const title of [...order]) {
		if (!title.ref.startsWith('section:')) continue;
		const at = order.indexOf(title);
		const early = order.slice(0, at).filter((p) => under(title, p));
		if (early.length === 0) continue;
		const rest = order.filter((p) => !early.includes(p));
		rest.splice(rest.indexOf(title) + 1, 0, ...early);
		order.splice(0, order.length, ...rest);
	}
	const out: Placed[] = [];
	const titles = new Map<string, Placed>();
	for (const p of order) {
		let y = 0;
		for (const q of out) if (q.x < p.x + p.w && p.x < q.x + q.w) y = Math.max(y, q.y + q.h);
		const kin = kinOf.get(p.ref);
		const title = kin === undefined ? undefined : titles.get(`section:${kin}`);
		if (title && under(title, p)) y = Math.max(y, title.y + title.h);
		const q = { ...p, y };
		out.push(q);
		if (p.ref.startsWith('section:')) titles.set(p.ref, q);
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
 * so nothing is pulled up past a heading. With `areaOf` (a look's areas,
 * N6), a row of areas reads one area at a time, left to right, so what's
 * beside the main area follows it instead of mixing in. Each area, and each
 * of `heads` (a title, a section drawn whole), starts below what’s already
 * there, across the whole width, so nothing is pulled up past it.
 */
export function narrow(
	placed: Placed[],
	cols: number,
	areaOf?: (p: Placed) => { row: number; x: number },
	heads: Set<string> = new Set()
): Map<string, Box> {
	const order = areaOf
		? [...placed].sort((a, b) => {
				const p = areaOf(a);
				const q = areaOf(b);
				return p.row - q.row || p.x - q.x || a.y - b.y || a.x - b.x;
			})
		: reading(placed);
	const key = (p: Placed) => (areaOf ? `${areaOf(p).row}:${areaOf(p).x}` : '');
	const out = flow(
		order.map((p, i) => ({
			ref: p.ref,
			w: heads.has(p.ref) ? cols : across(p.w, cols),
			h: p.h,
			breaks: p.w >= COLS || heads.has(p.ref) || (i > 0 && key(p) !== key(order[i - 1]!))
		})),
		cols
	);
	return new Map(out.map(({ ref, ...b }) => [ref, b]));
}

/**
 * Where each card's top is in pixels on a page being looked at, not arranged:
 * right under what is above it in its columns, by the height it's drawn at,
 * so a short heading or an empty card holds no rows of nothing. Cards of a
 * section side by side in a row (`kinOf`) start together, and those near
 * the tallest's height are drawn as tall as it (`eq`), so a row of doors
 * ends level; a chip beside a long list keeps its own height. A card not yet
 * measured takes its cells.
 */
export function settle(
	placed: Placed[],
	heightOf: (ref: string) => number | undefined,
	kinOf: (ref: string) => string | undefined,
	gap: number,
	/** More room above a title, so it reads with what's under it. */
	headGap = 0
): { top: Map<string, number>; eq: Map<string, number> } {
	const order = reading(placed);
	const rowKey = (p: Placed) => {
		const kin = kinOf(p.ref);
		return kin === undefined ? undefined : `${p.y}:${kin}`;
	};
	const rows = new Map<string, Placed[]>();
	for (const p of order) {
		const k = rowKey(p);
		if (k !== undefined) rows.set(k, [...(rows.get(k) ?? []), p]);
	}
	const cellsOf = (p: Placed) => p.h * 56 + (p.h - 1) * gap;
	const eq = new Map<string, number>();
	for (const row of rows.values()) {
		if (row.length < 2) continue;
		const hs = row.map((p) => heightOf(p.ref));
		if (hs.some((h) => h === undefined)) continue;
		const most = Math.max(...(hs as number[]));
		const near = row.filter((_, i) => hs[i]! >= most * 0.6);
		if (near.length > 1) for (const p of near) eq.set(p.ref, most);
	}
	const top = new Map<string, number>();
	const drawn: { p: Placed; bottom: number }[] = [];
	const topOf = (p: Placed) => {
		let y = 0;
		for (const d of drawn) if (d.p.x < p.x + p.w && p.x < d.p.x + d.p.w) y = Math.max(y, d.bottom);
		return y > 0 && p.ref.startsWith('section:') && kinOf(p.ref) === undefined ? y + headGap : y;
	};
	for (const p of order) {
		if (top.has(p.ref)) continue;
		const k = rowKey(p);
		const row = k === undefined ? [p] : rows.get(k)!;
		const t = Math.max(...row.map(topOf));
		for (const q of row) {
			top.set(q.ref, t);
			const h = eq.get(q.ref) ?? heightOf(q.ref) ?? cellsOf(q);
			drawn.push({ p: q, bottom: h > 0 ? t + h + gap : t });
		}
	}
	return { top, eq };
}
