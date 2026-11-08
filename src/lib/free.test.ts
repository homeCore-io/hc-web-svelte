import { describe, expect, it } from 'vitest';
import { across, firstGap, flow, freeze, land, layout, narrow, tidy, type Placed } from './free.js';
import { addChange, type Change } from './layers.js';

const at = (placed: Placed[], ref: string) => {
	const p = placed.find((x) => x.ref === ref)!;
	return [p.x, p.y, p.w, p.h];
};
const overlapping = (placed: Placed[]) =>
	placed.some((a, i) =>
		placed.some(
			(b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
		)
	);

describe('the starting layout (14 §4)', () => {
	it('puts each heading across the page and its cards from the top left', () => {
		const out = flow([
			{ ref: 'section:a', w: 12, h: 1, breaks: true },
			{ ref: 'one', w: 4, h: 3 },
			{ ref: 'two', w: 2, h: 2 },
			{ ref: 'three', w: 2, h: 1 },
			{ ref: 'section:b', w: 12, h: 1, breaks: true },
			{ ref: 'four', w: 2, h: 2 }
		]);
		expect(at(out, 'section:a')).toEqual([0, 0, 12, 1]);
		expect(at(out, 'one')).toEqual([0, 1, 4, 3]);
		expect(at(out, 'two')).toEqual([4, 1, 2, 2]);
		expect(at(out, 'three')).toEqual([6, 1, 2, 1]);
		// Below everything before it, the tall card included.
		expect(at(out, 'section:b')).toEqual([0, 4, 12, 1]);
		expect(at(out, 'four')).toEqual([0, 5, 2, 2]);
	});

	it('fills a hole beside a tall card before starting a new row', () => {
		const out = flow([
			{ ref: 'tall', w: 4, h: 4 },
			{ ref: 'a', w: 8, h: 2 },
			{ ref: 'b', w: 8, h: 2 },
			{ ref: 'c', w: 6, h: 2 }
		]);
		expect(at(out, 'b')).toEqual([4, 2, 8, 2]);
		expect(at(out, 'c')).toEqual([0, 4, 6, 2]);
	});

	it('keeps a card no wider than the grid', () => {
		expect(at(flow([{ ref: 'wide', w: 20, h: 1 }]), 'wide')).toEqual([0, 0, 12, 1]);
	});
});

describe('the first gap', () => {
	it('is top left first', () => {
		const placed = [{ x: 0, y: 0, w: 4, h: 2 }];
		expect(firstGap(placed, 2, 2)).toEqual({ x: 4, y: 0, w: 2, h: 2 });
		expect(firstGap(placed, 12, 1)).toEqual({ x: 0, y: 2, w: 12, h: 1 });
	});
});

describe('landing on others (P2)', () => {
	const row: Placed[] = [
		{ ref: 'a', x: 0, y: 0, w: 2, h: 2 },
		{ ref: 'b', x: 2, y: 0, w: 2, h: 2 },
		{ ref: 'c', x: 0, y: 2, w: 2, h: 2 }
	];

	it('moves what it covers aside, the way it was going, where the rows have room', () => {
		const out = land(row, 'a', { x: 2, y: 0, w: 2, h: 2 }, 1);
		expect(at(out, 'a')).toEqual([2, 0, 2, 2]);
		expect(at(out, 'b')).toEqual([4, 0, 2, 2]);
		expect(overlapping(out)).toBe(false);
	});

	it('moves it down when there is no room aside', () => {
		const full: Placed[] = [
			{ ref: 'a', x: 0, y: 0, w: 6, h: 2 },
			{ ref: 'b', x: 6, y: 0, w: 6, h: 2 }
		];
		const out = land(full, 'a', { x: 6, y: 0, w: 6, h: 2 }, 1);
		expect(at(out, 'b')).toEqual([6, 2, 6, 2]);
		expect(overlapping(out)).toBe(false);
	});

	it('pushes down in turn whatever that lands on', () => {
		const out = land(row, 'x', { x: 0, y: 0, w: 4, h: 2 }, 0);
		expect(at(out, 'a')).toEqual([0, 2, 2, 2]);
		expect(at(out, 'c')).toEqual([0, 4, 2, 2]);
		expect(overlapping(out)).toBe(false);
	});

	it('never leaves anything overlapping, however it lands', () => {
		let out: Placed[] = [];
		for (let i = 0; i < 20; i++)
			out = land(
				out,
				`c${i}`,
				{ x: (i * 5) % 11, y: i % 3, w: 1 + (i % 4), h: 1 + (i % 3) },
				(i % 3) - 1
			);
		expect(out).toHaveLength(20);
		expect(overlapping(out)).toBe(false);
	});
});

describe('Tidy (P5)', () => {
	it('moves every card up as far as it goes, keeping its column', () => {
		const out = tidy([
			{ ref: 'a', x: 0, y: 3, w: 2, h: 2 },
			{ ref: 'b', x: 1, y: 7, w: 4, h: 1 }
		]);
		expect(at(out, 'a')).toEqual([0, 0, 2, 2]);
		expect(at(out, 'b')).toEqual([1, 2, 4, 1]);
	});
});

describe('a page laid out', () => {
	const items = [
		{ ref: 'section:a', w: 12, h: 1, breaks: true },
		{ ref: 'one', w: 2, h: 2 },
		{ ref: 'two', w: 2, h: 2 }
	];

	it('flows when nothing is placed', () => {
		expect(at(layout(items), 'two')).toEqual([2, 1, 2, 2]);
	});

	it('holds still once frozen: a new thing takes the first gap', () => {
		let changes: Change[] = freeze(layout(items));
		changes = addChange(changes, { op: 'place', ref: 'one', x: 8, y: 1, w: 4, h: 3 });
		const out = layout([...items, { ref: 'new', w: 2, h: 2 }], changes);
		expect(at(out, 'one')).toEqual([8, 1, 4, 3]);
		expect(at(out, 'two')).toEqual([2, 1, 2, 2]);
		expect(at(out, 'new')).toEqual([0, 1, 2, 2]);
	});

	it('leaves the hole of something gone', () => {
		const changes = freeze(layout(items));
		const out = layout(
			items.filter((i) => i.ref !== 'one'),
			changes
		);
		expect(at(out, 'two')).toEqual([2, 1, 2, 2]);
	});

	it('lets a person’s place win over the household’s', () => {
		const house = freeze(layout(items));
		const mine: Change[] = [{ op: 'place', ref: 'two', x: 0, y: 1, w: 2, h: 2 }];
		const out = layout(items, [...house, ...mine]);
		expect(at(out, 'two')).toEqual([0, 1, 2, 2]);
		expect(at(out, 'one')).toEqual([0, 3, 2, 2]);
	});

	it('is in reading order', () => {
		const changes: Change[] = [
			{ op: 'place', ref: 'two', x: 0, y: 0, w: 2, h: 2 },
			{ op: 'place', ref: 'one', x: 4, y: 0, w: 2, h: 2 },
			{ op: 'place', ref: 'section:a', x: 0, y: 5, w: 12, h: 1 }
		];
		expect(layout(items, changes).map((p) => p.ref)).toEqual(['two', 'one', 'section:a']);
	});
});

describe('a narrower grid (P4)', () => {
	it('is half or the whole of a phone, and in twos between', () => {
		expect(across(2, 4)).toBe(2);
		expect(across(4, 4)).toBe(4);
		expect(across(8, 4)).toBe(4);
		expect(across(8, 8)).toBe(6);
		expect(across(4, 8)).toBe(4);
		expect(across(2, 8)).toBe(2);
		expect(across(12, 4)).toBe(4);
		expect(across(5, 12)).toBe(5);
	});
});

describe('a narrower page (P4)', () => {
	it('keeps each heading’s cards under it', () => {
		const wide: Placed[] = [
			{ ref: 'section:a', x: 0, y: 0, w: 12, h: 1 },
			{ ref: 'tv', x: 0, y: 1, w: 4, h: 3 },
			{ ref: 'lamp', x: 4, y: 1, w: 2, h: 2 },
			{ ref: 'section:b', x: 0, y: 4, w: 12, h: 1 },
			{ ref: 'scene', x: 0, y: 5, w: 2, h: 1 }
		];
		const phone = narrow(wide, 4);
		expect(phone.get('tv')).toEqual({ x: 0, y: 1, w: 4, h: 3 });
		expect(phone.get('lamp')).toEqual({ x: 0, y: 4, w: 2, h: 2 });
		expect(phone.get('section:b')).toEqual({ x: 0, y: 6, w: 4, h: 1 });
		expect(phone.get('scene')).toEqual({ x: 0, y: 7, w: 2, h: 1 });
	});
});
