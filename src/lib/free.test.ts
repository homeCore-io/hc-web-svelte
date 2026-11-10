import { describe, expect, it } from 'vitest';
import {
	across,
	firstGap,
	flow,
	freeze,
	land,
	layout,
	narrow,
	step,
	tidy,
	where,
	type Placed
} from './free.js';
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

	it('holds still once frozen: a new thing of no kind goes under what is in its columns', () => {
		let changes: Change[] = freeze(layout(items));
		changes = addChange(changes, { op: 'place', ref: 'one', x: 8, y: 1, w: 4, h: 3 });
		const out = layout([...items, { ref: 'new', w: 2, h: 2 }], changes);
		expect(at(out, 'one')).toEqual([8, 1, 4, 3]);
		expect(at(out, 'two')).toEqual([2, 1, 2, 2]);
		// Where 'one' was: the column is packed, so it never waits below a gap.
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

describe('arranging a placed page (14 §5, §6)', () => {
	const items = [
		{ ref: 'section:a', w: 12, h: 1, breaks: true },
		{ ref: 'one', w: 2, h: 2, kin: 'a' },
		{ ref: 'two', w: 2, h: 2, kin: 'a' },
		{ ref: 'section:b', w: 12, h: 1, breaks: true },
		{ ref: 'three', w: 2, h: 2, kin: 'b' }
	];
	const frozen = freeze(layout(items));

	it('lands a new card with the last of its kind (N4)', () => {
		const out = layout([...items, { ref: 'new', w: 2, h: 2, kin: 'b' }], frozen);
		expect(at(out, 'new')).toEqual([2, 4, 2, 2]);
	});

	it('lands it with its kind wherever they were moved, not under a heading', () => {
		const moved: Change[] = [...frozen, { op: 'place', ref: 'three', x: 8, y: 1, w: 2, h: 2 }];
		const out = layout([...items, { ref: 'new', w: 2, h: 2, kin: 'b' }], moved);
		expect(at(out, 'new')).toEqual([10, 1, 2, 2]);
	});

	it('lands it under its kind when their row is full, the next title moving down', () => {
		const full = [
			{ ref: 'section:a', w: 12, h: 1, breaks: true },
			...[1, 2, 3, 4, 5, 6].map((n) => ({ ref: `a${n}`, w: 2, h: 2, kin: 'a' })),
			{ ref: 'section:b', w: 12, h: 1, breaks: true },
			{ ref: 'b1', w: 2, h: 2, kin: 'b' }
		];
		const out = layout([...full, { ref: 'new', w: 2, h: 2, kin: 'a' }], freeze(layout(full)));
		expect(at(out, 'new')).toEqual([0, 3, 2, 2]);
		expect(at(out, 'section:b')).toEqual([0, 5, 12, 1]);
		expect(at(out, 'b1')).toEqual([0, 6, 2, 2]);
		expect(overlapping(out)).toBe(false);
	});

	it('lands the only one of its kind under its own title', () => {
		const only = layout(
			[...items.filter((i) => i.ref !== 'three'), { ref: 'new', w: 2, h: 2, kin: 'b' }],
			frozen.filter((c) => c.ref !== 'three')
		);
		expect(at(only, 'new')).toEqual([0, 4, 2, 2]);
	});

	it('lands it at the bottom when none of its kind is left', () => {
		const out = layout([...items, { ref: 'new', w: 2, h: 2, kin: 'c' }], frozen);
		expect(at(out, 'new')).toEqual([0, 6, 2, 2]);
	});

	it('steps a card earlier or later, trading places', () => {
		const out = step(layout(items, frozen), 'two', -1);
		expect(at(out, 'two')).toEqual([0, 1, 2, 2]);
		expect(at(out, 'one')).toEqual([2, 1, 2, 2]);
		expect(overlapping(out)).toBe(false);
	});

	it('gives a card its usual size again when its form changes after it was placed', () => {
		const placed: Change[] = [...frozen, { op: 'place', ref: 'one', x: 0, y: 1, w: 6, h: 4 }];
		const bigger = items.map((i) => (i.ref === 'one' ? { ...i, w: 4, h: 3 } : i));
		expect(at(layout(bigger, placed), 'one')).toEqual([0, 1, 6, 4]);
		const sized = [...placed, { op: 'form', ref: 'one', form: 'large' } as Change];
		expect(at(layout(bigger, sized), 'one')).toEqual([0, 1, 4, 3]);
	});

	it('says where a card is', () => {
		expect(where({ x: 0, y: 1, w: 6, h: 2 })).toBe('row 2, columns 1 to 6');
		expect(where({ x: 3, y: 0, w: 1, h: 1 })).toBe('row 1, column 4');
	});
});

describe('moved among others on a placed page', () => {
	it('lands the card with them', () => {
		const items = [
			{ ref: 'section:a', w: 12, h: 1, breaks: true },
			{ ref: 'one', w: 2, h: 2, kin: 'a' },
			{ ref: 'section:b', w: 12, h: 1, breaks: true },
			{ ref: 'two', w: 2, h: 2, kin: 'b' }
		];
		const changes: Change[] = [
			...freeze(layout(items)),
			{ op: 'move', ref: 'one', before: null, into: 'b' }
		];
		const moved = items.map((i) => (i.ref === 'one' ? { ...i, kin: 'b' } : i));
		// Beside 'two', under b, which moved up into the room 'one' left.
		const out = layout(moved, changes);
		expect(at(out, 'section:b')).toEqual([0, 1, 12, 1]);
		expect(at(out, 'one')).toEqual([2, 2, 2, 2]);
	});
});

describe('a placed page is packed', () => {
	// The house's Garage, as saved: a band left by "Needs attention" (drawn
	// above the grid now), and the readings beside the doors, above their title.
	const items = [
		{ ref: 'section:head', w: 12, h: 4, breaks: true },
		{ ref: 'section:doors', w: 12, h: 1, breaks: true },
		...[0, 1, 2, 3].map((n) => ({ ref: `door${n}`, w: 2, h: 3, kin: 'doors' })),
		{ ref: 'section:switches', w: 8, h: 4, breaks: true },
		{ ref: 'section:readings', w: 4, h: 1, breaks: true },
		{ ref: 'freezer', w: 4, h: 2, kin: 'readings' },
		{ ref: 'temp', w: 4, h: 2, kin: 'readings' },
		{ ref: 'section:watching', w: 4, h: 3, breaks: true }
	];
	const saved: Change[] = [
		{ op: 'place', ref: 'section:needs', x: 0, y: 4, w: 12, h: 2 },
		{ op: 'place', ref: 'section:head', x: 0, y: 0, w: 12, h: 4 },
		{ op: 'place', ref: 'section:doors', x: 0, y: 6, w: 12, h: 1 },
		...[0, 1, 2, 3].map((n) => ({
			op: 'place' as const,
			ref: `door${n}`,
			x: n * 2,
			y: 7,
			w: 2,
			h: 3
		})),
		{ op: 'place', ref: 'freezer', x: 8, y: 7, w: 4, h: 2 },
		{ op: 'place', ref: 'temp', x: 8, y: 9, w: 4, h: 2 },
		{ op: 'place', ref: 'section:switches', x: 0, y: 10, w: 8, h: 4 },
		{ op: 'place', ref: 'section:readings', x: 8, y: 11, w: 4, h: 1 },
		{ op: 'place', ref: 'section:watching', x: 8, y: 12, w: 4, h: 3 }
	];
	const out = layout(items, saved);

	it('closes the band something no longer on the grid left', () => {
		expect(at(out, 'section:doors')).toEqual([0, 4, 12, 1]);
		expect(at(out, 'door0')).toEqual([0, 5, 2, 3]);
	});

	it('puts a column’s title back above its cards, up beside the main area', () => {
		expect(at(out, 'section:readings')).toEqual([8, 5, 4, 1]);
		expect(at(out, 'freezer')).toEqual([8, 6, 4, 2]);
		expect(at(out, 'temp')).toEqual([8, 8, 4, 2]);
		expect(at(out, 'section:watching')).toEqual([8, 10, 4, 3]);
		expect(at(out, 'section:switches')).toEqual([0, 8, 8, 4]);
		expect(overlapping(out)).toBe(false);
	});
});

describe('pushing down keeps cards under their heading', () => {
	it('carries what was under a heading down with it', () => {
		const page: Placed[] = [
			{ ref: 'lamp', x: 0, y: 0, w: 2, h: 2 },
			{ ref: 'section:scenes', x: 0, y: 2, w: 12, h: 1 },
			{ ref: 'a', x: 0, y: 3, w: 2, h: 1 },
			{ ref: 'b', x: 6, y: 3, w: 2, h: 1 },
			{ ref: 'c', x: 0, y: 4, w: 2, h: 1 }
		];
		// The lamp made taller: it lands on the heading, which moves below it.
		const out = land(page, 'lamp', { x: 0, y: 0, w: 2, h: 4 }, 0);
		const y = (r: string) => out.find((p) => p.ref === r)!.y;
		expect(y('section:scenes')).toBe(4);
		expect(y('a')).toBeGreaterThan(4);
		expect(y('b')).toBeGreaterThan(4);
		expect(y('c')).toBeGreaterThan(y('a'));
		expect(overlapping(out)).toBe(false);
	});
});

describe('a look’s areas on a narrower screen (N6)', () => {
	it('reads a row of areas one area at a time', () => {
		const wide: Placed[] = [
			{ ref: 'kitchen', x: 0, y: 0, w: 2, h: 2 },
			{ ref: 'pinned', x: 8, y: 0, w: 4, h: 1 },
			{ ref: 'hall', x: 0, y: 2, w: 2, h: 2 }
		];
		const area = (p: Placed) => ({ row: 0, x: p.x >= 8 ? 8 : 0 });
		const phone = narrow(wide, 4, area);
		expect(phone.get('hall')!.y).toBeLessThan(phone.get('pinned')!.y);
	});

	it('starts each area and each title below what’s there, nothing pulled up past them', () => {
		const wide: Placed[] = [
			{ ref: 'stack', x: 0, y: 0, w: 6, h: 6 },
			{ ref: 'section:lights', x: 0, y: 6, w: 8, h: 1 },
			{ ref: 'lamp', x: 0, y: 7, w: 2, h: 2 },
			{ ref: 'section:readings', x: 8, y: 6, w: 4, h: 1 },
			{ ref: 'temp', x: 8, y: 7, w: 4, h: 2 }
		];
		const area = (p: Placed) => ({ row: p.y < 6 ? 0 : 1, x: p.y >= 6 && p.x >= 8 ? 8 : 0 });
		const tablet = narrow(wide, 8, area, new Set(['section:lights', 'section:readings']));
		// The stack takes six of eight: the lamp waits under the Lights title.
		expect(tablet.get('section:lights')!.y).toBe(6);
		expect(tablet.get('lamp')!.y).toBe(7);
		// Readings starts its own line; its first reading under it, not beside it.
		expect(tablet.get('section:readings')!.y).toBe(9);
		expect(tablet.get('temp')!.y).toBe(10);
	});
});

describe('a look’s areas (14 §8)', () => {
	it('fills the main area and the one beside it side by side, under what’s across the top', () => {
		const main = { x: 0, w: 8 };
		const side = { x: 8, w: 4 };
		const out = flow([
			{ ref: 'header', w: 12, h: 2, breaks: true },
			{ ref: 'section:doors', w: 8, h: 1, breaks: true, area: main },
			{ ref: 'door1', w: 2, h: 2, area: main },
			{ ref: 'door2', w: 2, h: 2, area: main },
			{ ref: 'section:readings', w: 4, h: 1, breaks: true, area: side },
			{ ref: 'temp', w: 4, h: 1, area: side },
			{ ref: 'leak', w: 4, h: 1, area: side },
			{ ref: 'section:lights', w: 8, h: 1, breaks: true, area: main },
			{ ref: 'lamp', w: 2, h: 2, area: main }
		]);
		expect(at(out, 'section:doors')).toEqual([0, 2, 8, 1]);
		expect(at(out, 'door2')).toEqual([2, 3, 2, 2]);
		expect(at(out, 'section:readings')).toEqual([8, 2, 4, 1]);
		expect(at(out, 'leak')).toEqual([8, 4, 4, 1]);
		// Under the doors, not under the readings beside them.
		expect(at(out, 'section:lights')).toEqual([0, 5, 8, 1]);
		expect(at(out, 'lamp')).toEqual([0, 6, 2, 2]);
	});

	it('starts a row of areas below the first line of cards above it', () => {
		const out = flow([
			{ ref: 'door', w: 2, h: 2, breaks: true, area: { x: 0, w: 12, row: 0 } },
			{ ref: 'section:lights', w: 4, h: 1, breaks: true, area: { x: 4, w: 4, row: 1 } }
		]);
		expect(at(out, 'section:lights')).toEqual([4, 2, 4, 1]);
	});

	it('starts an area beside a card further down the rows above (Lit’s Garage)', () => {
		const out = flow([
			{ ref: 'section:doors', w: 12, h: 1, breaks: true, area: { x: 0, w: 12, row: 0 } },
			{ ref: 'door', w: 4, h: 2, breaks: true, area: { x: 0, w: 12, row: 0 } },
			{ ref: 'stack', w: 4, h: 4, breaks: true, area: { x: 0, w: 12, row: 0 } },
			{ ref: 'section:lights', w: 8, h: 1, breaks: true, area: { x: 0, w: 8, row: 1 } },
			{ ref: 'section:climate', w: 4, h: 1, breaks: true, area: { x: 8, w: 4, row: 1 } }
		]);
		expect(at(out, 'stack')).toEqual([0, 3, 4, 4]);
		// Main is under the stack; beside it starts under the doors, by the stack.
		expect(at(out, 'section:lights')).toEqual([0, 7, 8, 1]);
		expect(at(out, 'section:climate')).toEqual([8, 3, 4, 1]);
	});
});
