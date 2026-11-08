/**
 * Drawing a look's areas (14 §8, N2): rows of areas on the room's 12
 * columns, each named and as wide as the author wants. Each change keeps a
 * row at 12 columns: a wider area's neighbor gives the columns, a removed
 * one's go to its neighbor. Plain data, so it's tested without drawing.
 */
import { LIT_AREAS, type Area } from './model.js';

type Rows = Area[][];

/** Shapes to start from: Lit's, three columns, a rail on the left, the whole width. */
export const AREA_SHAPES: { id: string; name: string; rows: Rows }[] = [
	{ id: 'lit', name: 'Lit: across the top, main, beside', rows: LIT_AREAS },
	{
		id: 'three',
		name: 'Three columns',
		rows: [
			[{ id: 'top', name: 'Across the top', w: 12 }],
			[
				{ id: 'left', name: 'Left', w: 4 },
				{ id: 'main', name: 'Middle', w: 4 },
				{ id: 'beside', name: 'Right', w: 4 }
			]
		]
	},
	{
		id: 'rail',
		name: 'A rail on the left',
		rows: [
			[
				{ id: 'beside', name: 'Rail', w: 3 },
				{ id: 'main', name: 'Main', w: 9 }
			]
		]
	},
	{ id: 'whole', name: 'The whole width', rows: [[{ id: 'main', name: 'The room', w: 12 }]] }
];

const copy = (rows: Rows): Rows => rows.map((r) => r.map((a) => ({ ...a })));

/** An id no area has yet. */
function fresh(rows: Rows): string {
	const ids = new Set(rows.flat().map((a) => a.id));
	let n = 1;
	while (ids.has(`area-${n}`)) n++;
	return `area-${n}`;
}

/** Where an area is: its row and its place in the row. */
export function findArea(rows: Rows, id: string): [number, number] | undefined {
	for (let r = 0; r < rows.length; r++) {
		const i = rows[r]!.findIndex((a) => a.id === id);
		if (i >= 0) return [r, i];
	}
	return undefined;
}

/** A new row under the rest, one area across it. */
export function addRow(rows: Rows): { rows: Rows; id: string } {
	const id = fresh(rows);
	return { rows: [...copy(rows), [{ id, name: 'New area', w: 12 }]], id };
}

/** Split in two, side by side; an area under 4 columns stays whole. */
export function split(rows: Rows, id: string): { rows: Rows; id?: string } {
	const at = findArea(rows, id);
	const out = copy(rows);
	if (!at) return { rows: out };
	const row = out[at[0]]!;
	const a = row[at[1]]!;
	if (a.w < 4) return { rows: out };
	const nid = fresh(rows);
	const half = Math.floor(a.w / 2);
	row.splice(at[1] + 1, 0, { id: nid, name: 'New area', w: a.w - half });
	a.w = half;
	return { rows: out, id: nid };
}

/** Wider or narrower by `by`, its neighbor giving or taking; neither under 2 columns. */
export function resize(rows: Rows, id: string, by: number): Rows {
	const at = findArea(rows, id);
	const out = copy(rows);
	if (!at) return out;
	const row = out[at[0]]!;
	const a = row[at[1]]!;
	const nb = row[at[1] + 1] ?? row[at[1] - 1];
	if (!nb || a.w + by < 2 || nb.w - by < 2) return out;
	a.w += by;
	nb.w -= by;
	return out;
}

/** Earlier or later in its row. */
export function shift(rows: Rows, id: string, by: -1 | 1): Rows {
	const at = findArea(rows, id);
	const out = copy(rows);
	if (!at) return out;
	const row = out[at[0]]!;
	const j = at[1] + by;
	if (j < 0 || j >= row.length) return out;
	[row[at[1]], row[j]] = [row[j]!, row[at[1]]!];
	return out;
}

/** Gone, its columns to its neighbor; a row left empty goes too. The last area stays. */
export function remove(rows: Rows, id: string): Rows {
	const at = findArea(rows, id);
	const out = copy(rows);
	if (!at || rows.flat().length < 2) return out;
	const row = out[at[0]]!;
	const [gone] = row.splice(at[1], 1);
	const nb = row[at[1]] ?? row[at[1] - 1];
	if (nb && gone) nb.w += gone.w;
	return out.filter((r) => r.length > 0);
}

/** Named anew; left empty, "Area". */
export function rename(rows: Rows, id: string, name: string): Rows {
	return copy(rows).map((r) =>
		r.map((a) => (a.id === id ? { ...a, name: name.slice(0, 40) || 'Area' } : a))
	);
}
