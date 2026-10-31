import { describe, expect, it } from 'vitest';
import { cardFor } from './card.js';
import type { CoreDevice, Devices } from './devices.js';
import { HOUSE, ROOMS, FIXTURE_NOW } from './fixtures/house.js';
import { roomFromCore } from './house.js';
import { chartSource, spanOf, WORTH_BUILT_IN } from './options.js';
import { forecastOf, playingNow, stationOf, weatherOf, worthKnowing } from './pieces.js';

const rooms = ROOMS.map(roomFromCore);
const withState = (id: string, attributes: Record<string, unknown>): Devices =>
	Object.fromEntries(
		HOUSE.map((d) => [
			d.device_id,
			d.device_id === id ? { ...d, attributes: { ...d.attributes, ...attributes } } : d
		])
	);
const cards = (all: Devices) => Object.values(all).map((d) => cardFor(d, FIXTURE_NOW));

describe('worth knowing (G-c)', () => {
	const wet = withState('yolink_leak', { water_detected: true });

	it('names a leak first, as an alert', () => {
		const items = worthKnowing(cards(wet), wet, rooms, WORTH_BUILT_IN);
		expect(items[0]).toMatchObject({ id: 'yolink_leak', alert: true });
	});

	it('leaves out what is switched off', () => {
		const none = { leaks: false, open: false, unlocked: false, playing: false };
		expect(worthKnowing(cards(wet), wet, rooms, none)).toEqual([]);
		const noLeaks = worthKnowing(cards(wet), wet, rooms, { ...WORTH_BUILT_IN, leaks: false });
		expect(noLeaks.some((i) => i.id === 'yolink_leak')).toBe(false);
	});

	it('lists what plays under worth knowing and on its own, with its room', () => {
		const all = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
		const playing = playingNow(cards(all), all, rooms);
		const worth = worthKnowing(cards(all), all, rooms, {
			leaks: false,
			open: false,
			unlocked: false
		});
		expect(worth.map((i) => i.id)).toEqual(playing.map((i) => i.id));
		for (const i of playing) expect(i.what.startsWith('Playing')).toBe(true);
	});
});

describe('the weather (G21)', () => {
	const all = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));

	it('reads the house’s weather station unless another device was chosen', () => {
		expect(stationOf(all, 'auto')?.device_id).toBe('ecowitt_station');
		expect(stationOf(all, ['ecowitt_den'])?.device_id).toBe('ecowitt_den');
		expect(stationOf(all, 'none')).toBeUndefined();
	});

	it('shows its temperature and its other main readings, no forecast without one', () => {
		const w = weatherOf(all.ecowitt_station!, FIXTURE_NOW);
		expect(w.temperature).toBeCloseTo(57.7);
		expect(w.readings[0]).toEqual({ label: 'Humidity', text: '94%' });
		expect(w.forecast).toEqual([]);
	});

	it('shows a forecast the device publishes: days from today, in °C, five at most', () => {
		const day = (n: number) => new Date(FIXTURE_NOW + n * 86_400_000).toISOString();
		const forecast = [
			{ time: day(0), high: 14, low: 6, condition: 'Light rain', precipitation_probability: 60 },
			{ time: day(1), high: 12.4 },
			{ high: 30 },
			'nonsense',
			...[2, 3, 4, 5].map((n) => ({ time: day(n), high: 10 }))
		];
		const d: CoreDevice = {
			...all.ecowitt_station!,
			attributes: { ...all.ecowitt_station!.attributes, forecast }
		};
		const w = weatherOf(d, FIXTURE_NOW);
		expect(w.forecast).toHaveLength(5);
		expect(w.forecast[0]).toEqual({
			label: 'Today',
			high: 14,
			low: 6,
			condition: 'Light rain',
			rain: 60
		});
		expect(w.forecast[1]!.high).toBeCloseTo(12.4);
		expect(w.readings.some((r) => r.label.toLowerCase().includes('forecast'))).toBe(false);
	});

	it('reads nothing from a forecast that isn’t a list', () => {
		expect(forecastOf({ today: 1 }, FIXTURE_NOW)).toEqual([]);
	});
});

describe('a chart’s settings (G-c)', () => {
	it('charts the device chosen for its reading, over the span chosen', () => {
		expect(chartSource({ reading: 'humidity', humidity: ['a'], temperature: ['b'] })).toEqual({
			attr: 'humidity',
			id: 'a'
		});
		expect(chartSource({ temperature: 'none' })).toEqual({ attr: 'temperature', id: undefined });
		expect(spanOf('7d')).toBe(7 * 86_400_000);
		expect(spanOf('nonsense')).toBe(86_400_000);
	});
});
