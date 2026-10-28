import { describe, expect, it } from 'vitest';
import { agoOf, dateOf, fullDateOf, momentOf, timeOf } from './when.js';

describe('times and dates, one way everywhere', () => {
	const now = new Date(2026, 9, 28, 11, 0);

	it('never zero-pads an hour', () => {
		expect(timeOf(new Date(2026, 9, 28, 14, 4))).not.toMatch(/^0\d/);
		expect(timeOf(new Date(2026, 9, 28, 2, 4))).not.toMatch(/^0\d/);
		expect(timeOf(new Date(2026, 9, 28, 2, 4, 9), true)).toContain('09');
	});

	it('says a year only when it is not this one', () => {
		expect(dateOf(new Date(2026, 9, 27), now)).not.toContain('2026');
		expect(dateOf(new Date(2025, 9, 27), now)).toContain('2025');
		expect(fullDateOf(new Date(2026, 9, 27))).toContain('2026');
	});

	it('says today and yesterday by calendar day', () => {
		const t = new Date(2026, 9, 28, 0, 30);
		expect(momentOf(t, now)).toBe(`Today, ${timeOf(t)}`);
		const y = new Date(2026, 9, 27, 23, 0);
		expect(momentOf(y, now)).toBe(`Yesterday, ${timeOf(y)}`);
		const before = new Date(2026, 9, 20, 9, 0);
		expect(momentOf(before, now)).toBe(`${dateOf(before, now)}, ${timeOf(before)}`);
	});

	it('says how long ago in days past two', () => {
		expect(agoOf(now, now)).toBe('just now');
		expect(agoOf(now.getTime() - 5 * 60_000, now)).toBe('5 min ago');
		expect(agoOf(now.getTime() - 3 * 3_600_000, now)).toBe('3 h ago');
		expect(agoOf(now.getTime() - 285 * 3_600_000, now)).toBe('11 d ago');
	});
});
