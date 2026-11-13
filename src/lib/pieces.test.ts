import { describe, expect, it } from 'vitest';
import { cardFor, idLike } from './card.js';
import { followUnits } from './units.js';
import type { CoreDevice, Devices } from './devices.js';
import { HOUSE, ROOMS, FIXTURE_NOW } from './fixtures/house.js';
import { roomFromCore } from './house.js';
import { chartSource, spanOf, WORTH_BUILT_IN } from './options.js';
import {
	compass,
	forecastOf,
	longFor,
	playingNow,
	stationOf,
	weatherOf,
	worthKnowing
} from './pieces.js';

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
		const none = { leaks: false, open: false, unlocked: false };
		expect(worthKnowing(cards(wet), wet, rooms, none)).toEqual([]);
		const noLeaks = worthKnowing(cards(wet), wet, rooms, { ...WORTH_BUILT_IN, leaks: false });
		expect(noLeaks.some((i) => i.id === 'yolink_leak')).toBe(false);
	});

	it('leaves what plays to the Playing card, even with an old "playing" setting', () => {
		const all = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
		const playing = playingNow(cards(all), all, rooms);
		expect(playing.length).toBeGreaterThan(0);
		const worth = worthKnowing(cards(all), all, rooms, { ...WORTH_BUILT_IN, playing: true });
		for (const i of playing) expect(worth.some((w) => w.id === i.id)).toBe(false);
	});

	it('says what is playing and where, never a player id', () => {
		const all = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
		for (const i of playingNow(cards(all), all, rooms)) {
			expect(i.title).not.toMatch(/^Playing/);
			expect(idLike(i.title)).toBe(false);
		}
		expect(idLike('RINCON_542A1B8710A901400')).toBe(true);
		const speaker = HOUSE.find((d) => (d.plugin_id ?? '').includes('sonos'));
		expect(speaker).toBeDefined();
		const lineIn = {
			...speaker!,
			attributes: {
				...speaker!.attributes,
				state: 'playing',
				media_title: 'RINCON_542A1B8710A901400'
			}
		};
		const card = cardFor(lineIn, FIXTURE_NOW);
		expect(card.stateLine).not.toContain('RINCON');
		expect(card.nowPlaying).toBe('TV or line-in');
		expect(idLike('HDMI 1')).toBe(false);
		expect(idLike('YouTube')).toBe(false);
	});

	it('says how long a door has been open in one plain phrase', () => {
		const door = HOUSE.find((d) => d.device_type === 'contact_sensor' || d.device_type === 'door');
		expect(door).toBeDefined();
		const attr =
			'open' in door!.attributes
				? 'open'
				: 'contact_open' in door!.attributes
					? 'contact_open'
					: 'contact';
		const ten = new Date(FIXTURE_NOW - 10 * 86_400_000 - 3_600_000).toISOString();
		const all: Devices = {
			...Object.fromEntries(HOUSE.map((d) => [d.device_id, d])),
			[door!.device_id]: {
				...door!,
				attributes: { ...door!.attributes, [attr]: attr !== 'contact' },
				attributes_changed_at: { [attr]: ten },
				last_seen: new Date(FIXTURE_NOW - 45 * 3_600_000).toISOString()
			}
		};
		const it = worthKnowing(cards(all), all, rooms, WORTH_BUILT_IN, FIXTURE_NOW).find(
			(i) => i.id === door!.device_id
		);
		expect(it?.what).toBe('Open for 10 days');
		expect(longFor(60_000)).toBe('1 minute');
		expect(longFor(3 * 3_600_000)).toBe('3 hours');
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
		expect(w.readings.map((r) => r.label)).toEqual(['Humidity', 'Wind']);
		expect(w.forecast).toEqual([]);
	});

	it('reads a °F station’s feels-like in °F, from its temperature_unit', () => {
		const d: CoreDevice = {
			...all.ecowitt_station!,
			attributes: {
				...all.ecowitt_station!.attributes,
				temperature: 50,
				feels_like: 50,
				temperature_unit: 'F'
			}
		};
		const w = weatherOf(d, FIXTURE_NOW);
		// The tests read in °C: 50 °F is 10 °C.
		expect(w.readings.find((r) => r.label === 'Feels like')?.text).toBe('10°C');
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

	it('names its readings plainly, relative pressure only, in the person’s units', () => {
		const d: CoreDevice = {
			...all.ecowitt_station!,
			attributes: {
				...all.ecowitt_station!.attributes,
				barometric_rel: 30.4,
				barometric_abs: 29.5,
				wind_direction: 213,
				uvi: 3.2
			}
		};
		followUnits(() => ({ temperature: 'F', measures: 'us' }));
		const w = weatherOf(d, FIXTURE_NOW, 9);
		expect(w.readings.map((r) => r.label)).toEqual(['Humidity', 'Wind', 'UV', 'Pressure']);
		expect(w.readings.find((r) => r.label === 'Pressure')?.text).toBe('30.4 inHg');
		expect(w.readings.find((r) => r.label === 'Wind')?.text).toMatch(/ SW$/);
		expect(w.readings.some((r) => /abs/i.test(r.label))).toBe(false);
		followUnits(() => ({ temperature: 'C', measures: 'metric' }));
		expect(weatherOf(d, FIXTURE_NOW, 9).readings.at(-1)?.text).toBe('1029.5 hPa');
		expect(compass(0)).toBe('N');
		expect(compass(350)).toBe('N');
	});

	it('says temperatures and wind in whole numbers and the person’s unit, as the big temperature', () => {
		const d = {
			...all.ecowitt_station!,
			attributes: {
				...all.ecowitt_station!.attributes,
				feels_like: 14.2,
				wind_speed: 1,
				wind_gust: 21.5
			}
		};
		followUnits(() => ({ temperature: 'F', measures: 'us' }));
		const w = weatherOf(d, FIXTURE_NOW, 9);
		const text = (l: string) => w.readings.find((r) => r.label === l)?.text;
		expect(w.temperatureUnit).toBe('°F');
		expect(text('Feels like')).toBe('58°F');
		expect(text('Wind')).toMatch(/^2 mph/);
		expect(text('Gusts')).toBe('48 mph');
		followUnits(() => ({ temperature: 'C', measures: 'metric' }));
	});

	it('reads nothing from a forecast that isn’t a list', () => {
		expect(forecastOf({ today: 1 }, FIXTURE_NOW)).toEqual([]);
	});
});

describe('a weather plugin’s place (hc-weather)', () => {
	const all = Object.fromEntries(HOUSE.map((d) => [d.device_id, d]));
	const condition = {
		kind: 'enum' as const,
		options: [
			{ value: 'clear', label: 'Clear', icon: 'sun' },
			{ value: 'rain', label: 'Rain', icon: 'cloud-rain' }
		]
	};
	const today = new Date(FIXTURE_NOW);
	const iso = (n: number) => {
		const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
		const p = (x: number) => String(x).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	};
	const place: CoreDevice = {
		device_id: 'weather_home',
		name: 'Home weather',
		device_type: 'weather',
		available: true,
		attributes: {
			temperature: 15.8,
			condition: 'clear',
			is_day: false,
			forecast: [
				{ time: iso(0), high: 17, low: 8, condition: 'rain', precipitation_probability: 40 },
				{ time: iso(1), high: 18, low: 7, condition: 'clear' }
			]
		},
		schema: {
			attributes: { temperature: { kind: 'float', unit: '°C' }, condition }
		}
	} as CoreDevice;

	it('is the house’s weather when it has a forecast, ahead of a station without one', () => {
		expect(stationOf({ ...all, weather_home: place }, 'auto')?.device_id).toBe('weather_home');
		const noForecast = { ...place, attributes: { ...place.attributes, forecast: [] } };
		expect(stationOf({ ...all, weather_home: noForecast }, 'auto')?.device_id).toBe(
			'ecowitt_station'
		);
	});

	it('says and draws each day’s sky from its options; a bare date is that day here', () => {
		const w = weatherOf(place, FIXTURE_NOW);
		expect(w.forecast[0]).toMatchObject({ label: 'Today', condition: 'Rain', icon: 'rain' });
		expect(w.forecast[1]).toMatchObject({ condition: 'Clear', icon: 'sun' });
	});

	it('its card: the temperature and the sky, the moon on a clear night', () => {
		const c = cardFor(place, FIXTURE_NOW);
		expect(c.icon).toBe('moon');
		expect(c.stateLine).toBe('15.8°C · Clear');
		const day = cardFor({ ...place, attributes: { ...place.attributes, is_day: true } });
		expect(day.icon).toBe('sun');
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
