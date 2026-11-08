import { describe, expect, it } from 'vitest';
import { AREA_SHAPES, addRow, remove, rename, resize, shift, split } from './areas.js';
import { LIT_AREAS, readAreas } from './model.js';

const widths = (rows: { id: string; w: number }[][]) =>
	rows.map((r) => r.map((a) => `${a.id}:${a.w}`).join(' '));

describe('drawing a look’s areas (14 §8, N2)', () => {
	it('splits an area in two, side by side, keeping the row at 12', () => {
		const { rows, id } = split(LIT_AREAS, 'main');
		expect(id).toBe('area-1');
		expect(widths(rows)).toEqual(['top:12', 'main:4 area-1:4 beside:4']);
		expect(split(AREA_SHAPES[2]!.rows, 'beside').id).toBeUndefined();
	});

	it('widens one as its neighbor gives, never under 2 columns', () => {
		expect(widths(resize(LIT_AREAS, 'main', 2))).toEqual(['top:12', 'main:10 beside:2']);
		expect(widths(resize(LIT_AREAS, 'main', 3))).toEqual(['top:12', 'main:8 beside:4']);
		expect(widths(resize(LIT_AREAS, 'top', 1))).toEqual(['top:12', 'main:8 beside:4']);
	});

	it('moves one within its row, and removes one, its columns to its neighbor', () => {
		expect(widths(shift(LIT_AREAS, 'beside', -1))).toEqual(['top:12', 'beside:4 main:8']);
		expect(widths(remove(LIT_AREAS, 'beside'))).toEqual(['top:12', 'main:12']);
		expect(widths(remove(LIT_AREAS, 'top'))).toEqual(['main:8 beside:4']);
		const one = [[{ id: 'all', name: 'All', w: 12 }]];
		expect(remove(one, 'all')).toEqual(one);
	});

	it('adds a row and renames, and every shape reads back as a look’s areas', () => {
		const { rows, id } = addRow(LIT_AREAS);
		expect(widths(rows).at(-1)).toBe(`${id}:12`);
		expect(rename(rows, id, '')[2]![0]!.name).toBe('Area');
		for (const s of AREA_SHAPES) expect(readAreas(s.rows), s.id).toEqual(s.rows);
	});
});
