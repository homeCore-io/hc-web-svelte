import { describe, expect, it } from 'vitest';
import { dailyRanges, nearest, scaleOf } from './compare.js';

const H = 3600_000;
const day0 = new Date(2026, 10, 1).getTime();

describe('a chart to compare (H1)', () => {
	it('puts every series on one scale, with room around it', () => {
		const s = scaleOf([[{ t: 0, v: 10 }], [{ t: 0, v: 30 }]])!;
		expect(s.lo).toBeLessThan(10);
		expect(s.hi).toBeGreaterThan(30);
		expect(scaleOf([[], []])).toBeNull();
	});

	it('finds each day’s low and high, by local day', () => {
		const pts = [
			{ t: day0 + 2 * H, v: 5 },
			{ t: day0 + 14 * H, v: 12 },
			{ t: day0 + 26 * H, v: 7 },
			{ t: day0 + 40 * H, v: 3 }
		];
		expect(dailyRanges(pts, day0, day0 + 48 * H)).toEqual([
			{ day: day0, low: 5, high: 12 },
			{ day: new Date(2026, 10, 2).getTime(), low: 3, high: 7 }
		]);
	});

	it('reads the value nearest the pointer', () => {
		expect(
			nearest(
				[
					{ t: 0, v: 1 },
					{ t: 10, v: 2 }
				],
				7
			)?.v
		).toBe(2);
		expect(nearest([], 7)).toBeUndefined();
	});
});
