import { describe, expect, it } from 'vitest';
import { cardFor, cardReadings, extraKey, type CardOptions } from './card.js';
import { HOUSE, FIXTURE_NOW } from './fixtures/house.js';
import type { CoreDevice } from './devices.js';

const byId = (id: string): CoreDevice => {
	const d = HOUSE.find((x) => x.device_id === id);
	if (!d) throw new Error(id);
	return d;
};
const card = (id: string, o?: CardOptions, patch: Partial<CoreDevice> = {}) =>
	cardFor({ ...byId(id), ...patch }, FIXTURE_NOW, o);

describe("a device card's settings (G23–G25)", () => {
	it('no settings, or empty ones, draw the card as it was', () => {
		for (const d of HOUSE) {
			const plain = cardFor(d, FIXTURE_NOW);
			expect(cardFor(d, FIXTURE_NOW, {})).toEqual({ ...plain, tapControls: false });
		}
	});

	it('offers the readings it reports now, primary first', () => {
		expect(cardReadings(byId('hue_motion')).map((r) => r.attr)).toEqual([
			'motion',
			'temperature',
			'illuminance'
		]);
	});

	it('leads with a chosen reading, and adds the ones switched on', () => {
		const c = card('hue_motion', { main: 'illuminance', show_motion: true });
		expect(c.stateLine.startsWith('26 lux · Clear')).toBe(true);
		// A reading it doesn't have leaves the line as it was.
		expect(card('hue_motion', { main: 'nothing_here' }).stateLine).toBe(
			card('hue_motion').stateLine
		);
	});

	it('the chosen lead is not said twice', () => {
		const c = card('hue_motion', { main: 'illuminance', show_illuminance: true });
		expect(c.stateLine.match(/lux/g)?.length).toBe(1);
	});

	it("turns off Large's sliders one by one", () => {
		const c = card('hue_lamp', { extra_color_temp: false });
		expect(c.extras.map((e) => extraKey(e))).toEqual(['brightness_pct']);
		expect(card('hue_lamp').extras).toHaveLength(2);
	});

	it('says when it last changed, when asked', () => {
		expect(card('hue_lamp').last).toBeUndefined();
		expect(
			card(
				'hue_lamp',
				{ last: true },
				{ last_change: { changed_at: new Date(FIXTURE_NOW - 12 * 60_000).toISOString() } as never }
			).last
		).toBe('Changed 12 min ago');
	});

	it('a symbol of its own, on this card only, keeping its state pair', () => {
		expect(card('caseta_porch', { symbol: 'fan' }).icon).toBe('fan');
		expect(card('caseta_porch').icon).toBe('switch');
		const open = card('yolink_front_lock', { symbol: 'lock' }, { attributes: { locked: false } });
		expect(open.icon).toBe('unlock');
		expect(card('caseta_porch', { symbol: 'not-a-symbol' }).icon).toBe('switch');
	});

	it('the whole card switches it only where it has a control', () => {
		expect(card('hue_lamp', { tap: 'control' }).tapControls).toBe(true);
		expect(card('yolink_front_lock', { tap: 'control' }).tapControls).toBe(true);
		expect(card('hue_motion', { tap: 'control' }).tapControls).toBe(false);
		expect(card('hue_lamp').tapControls).toBeUndefined();
	});

	it('never adds a control the device does not declare', () => {
		for (const d of HOUSE) {
			const all: CardOptions = { tap: 'control', main: 'on', last: true, symbol: 'fan' };
			expect(cardFor(d, FIXTURE_NOW, all).control).toEqual(cardFor(d, FIXTURE_NOW).control);
		}
	});
});
