import { describe, expect, it } from 'vitest';
import { cardFor } from './card.js';
import { HOUSE, FIXTURE_NOW } from './fixtures/house.js';
import { confirmed, patienceFor, withPending } from './pending.js';

const lamp = cardFor(
	HOUSE.find((d) => d.device_id === 'hue_lamp')!,
	FIXTURE_NOW
);

describe('a command waiting for the house (C8)', () => {
	it('is confirmed when the device reports what was asked', () => {
		expect(confirmed({ on: false }, { on: false, brightness_pct: 80 })).toBe(true);
		expect(confirmed({ on: false }, { on: true })).toBe(false);
	});

	it('allows a bridge to round a level', () => {
		expect(confirmed({ brightness_pct: 80 }, { brightness_pct: 79.6 })).toBe(true);
		expect(confirmed({ brightness_pct: 80 }, { brightness_pct: 60 })).toBe(false);
	});

	it('shows the new position at once, marked as waiting', () => {
		const c = withPending(lamp, { want: { on: false, brightness_pct: 20 }, until: 0 });
		expect(c.waiting).toBe(true);
		expect(c.control).toEqual({ kind: 'switch', attr: 'on', on: false });
		expect(c.extras[0]).toMatchObject({ attr: 'brightness_pct', value: 20 });
	});

	it('leaves a card alone when nothing is pending', () => {
		expect(withPending(lamp, undefined)).toEqual({ ...lamp, waiting: false });
	});

	it('gives locks longer', () => {
		expect(patienceFor('lock')).toBeGreaterThan(patienceFor('light'));
		expect(patienceFor('light')).toBe(5_000);
	});
});
