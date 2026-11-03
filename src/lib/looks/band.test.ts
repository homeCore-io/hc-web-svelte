import { describe, expect, it } from 'vitest';
import { bandOf, type Point } from './band.js';

const H = 3600 * 1000;
const NOW = Date.UTC(2026, 10, 2, 12);
const at = (hoursAgo: number, v: number): Point => ({ t: NOW - hoursAgo * H, v });

describe('a reading’s band (F1)', () => {
	it('marks today’s high and low', () => {
		const b = bandOf([at(20, 1), at(10, 5), at(2, 3)], NOW)!;
		expect(b.high.v).toBe(5);
		expect(b.low.v).toBe(1);
		expect(b.today).toHaveLength(3);
	});

	it('says what’s usual from the week before, its middle 80%', () => {
		const week = Array.from({ length: 50 }, (_, i) => at(30 + i * 3, i === 0 ? 40 : -2 + (i % 5)));
		const b = bandOf([...week, at(1, 6)], NOW)!;
		expect(b.usual!.low).toBeCloseTo(-2, 0);
		expect(b.usual!.high).toBeLessThan(10);
	});

	it('says nothing usual without enough of a week, and nothing at all without today', () => {
		expect(bandOf([at(30, 1), at(40, 2), at(1, 3)], NOW)!.usual).toBeNull();
		expect(bandOf([at(30, 1)], NOW)).toBeNull();
	});
});
