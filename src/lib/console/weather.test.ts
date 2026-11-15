import { afterEach, describe, expect, it } from 'vitest';
import type { CoreDevice, Devices, Schema } from '../devices.js';
import type { HouseDoc } from '../layers.js';
import { followUnits } from '../units.js';
import {
	bandOf,
	dayRowsOf,
	daysOf,
	hoursOf,
	noteOf,
	nowCandidates,
	nowChoicesOf,
	nowFrom,
	nowSourceOf,
	serviceOf,
	smoothPath,
	windText,
	withNowSource
} from './weather.js';

// Saturday, November 14 2026, 9 PM here.
const NOW = new Date(2026, 10, 14, 21, 0).getTime();
const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
const iso = (ms: number) => new Date(ms).toISOString();

const SCHEMA: Schema = {
	attributes: {
		temperature: { kind: 'float', unit: '°C' },
		feels_like: { kind: 'float', unit: '°C' },
		humidity: { kind: 'float', unit: '%' },
		condition: {
			kind: 'enum',
			options: [
				{ value: 'clear', label: 'Clear', icon: 'sun' },
				{ value: 'partly_cloudy', label: 'Partly cloudy', icon: 'cloud-sun' },
				{ value: 'rain', label: 'Rain', icon: 'cloud-rain' },
				{ value: 'snow', label: 'Snow', icon: 'cloud-snow' }
			]
		}
	}
} as Schema;

/** 25 hours from now: 5 °C falling to -1.2 °C at 6 AM, up to 10 °C at 2 PM, rain from 4 PM. */
const HOURS = Array.from({ length: 25 }, (_, i) => {
	const hour = (21 + i) % 24;
	const t =
		i <= 9 ? 5 - (i * 6.2) / 9 : i <= 17 ? -1.2 + ((i - 9) * 11.2) / 8 : 10 - (i - 17) * 0.5;
	return {
		time: iso(NOW + i * 3600_000),
		temperature: Math.round(t * 10) / 10,
		condition: 'clear',
		precipitation_probability: i >= 19 ? 40 : 0,
		hour
	};
});

const DAYS = [
	{ time: at(13, 0), high: 9, low: 0, condition: 'clear', precipitation_probability: 0 },
	{ time: at(14, 0), high: 11, low: 0.5, condition: 'clear', precipitation_probability: 0 },
	{ time: at(15, 0), high: 13, low: 3, condition: 'partly_cloudy', precipitation_probability: 20 },
	{ time: at(16, 0), high: 9, low: 5, condition: 'rain', precipitation_probability: 80 },
	{ time: at(17, 0), high: 7, low: 2, condition: 'rain', precipitation_probability: 60 },
	{ time: at(18, 0), high: 4, low: -2, condition: 'snow', precipitation_probability: 10 },
	{ time: at(19, 0), high: 1, low: -4, condition: 'snow', precipitation_probability: 50 },
	{ time: at(20, 0), high: 4, low: -3, condition: 'clear', precipitation_probability: 0 },
	{ time: at(21, 0), high: 6, low: -1, condition: 'clear', precipitation_probability: 0 }
];

const service = (attributes: Record<string, unknown> = {}): CoreDevice => ({
	device_id: 'weather_home',
	name: 'Home weather',
	plugin_id: 'plugin.weather',
	device_type: 'weather',
	available: true,
	schema: SCHEMA,
	attributes: {
		temperature: 5,
		feels_like: 2.2,
		humidity: 62,
		condition: 'clear',
		is_day: false,
		wind_speed: 4,
		wind_direction: 315,
		today_high: 11,
		today_low: 0.5,
		tonight_low: -1.2,
		freeze_tonight: true,
		alert_level: 0,
		alert_headline: null,
		forecast: DAYS,
		forecast_hourly: HOURS,
		...attributes
	}
});

/** The weather plugin as it stands before its first fetch: every reading null. */
const unfetched = (): CoreDevice =>
	service(
		Object.fromEntries(Object.keys(service().attributes).map((k) => [k, null])) as Record<
			string,
			unknown
		>
	);

const station = (over: Partial<CoreDevice> = {}): CoreDevice => ({
	device_id: 'ecowitt_weather',
	name: 'Weather Station',
	plugin_id: 'plugin.ecowitt',
	device_type: 'weather_station',
	available: true,
	last_seen: iso(NOW - 60_000),
	attributes: { temperature: 41.0, temperature_unit: '°F', humidity: 80 },
	...over
});

const porch: CoreDevice = {
	device_id: 'porch_temp',
	name: 'Porch Thermometer',
	device_type: 'temperature_sensor',
	available: true,
	last_seen: iso(NOW - 60_000),
	attributes: { temperature: 4, humidity: 70 }
};
const den: CoreDevice = {
	device_id: 'den_temp',
	name: 'Den Sensor',
	device_type: 'temperature_sensor',
	available: true,
	attributes: { temperature: 21 }
};

const house = (...list: CoreDevice[]): Devices =>
	Object.fromEntries(list.map((d) => [d.device_id, d]));

afterEach(() => followUnits(() => ({ temperature: 'C', measures: 'metric' })));

describe('wind', () => {
	it('is mph beside °F and km/h beside °C, from m/s', () => {
		expect(windText(4, 'F')).toBe('9 mph');
		expect(windText(4, 'C')).toBe('14 km/h');
		expect(windText(0, 'F')).toBe('0 mph');
	});

	it('follows the person’s temperature unit when none is given', () => {
		followUnits(() => ({ temperature: 'F', measures: 'metric' }));
		expect(windText(10)).toBe('22 mph');
		followUnits(() => ({ temperature: 'C', measures: 'us' }));
		expect(windText(10)).toBe('36 km/h');
	});
});

describe('where now comes from', () => {
	it('is kept in the household’s Home choices, automatic as nothing', () => {
		const doc: HouseDoc = { version: 3, home: { scenes: ['scene:a'] } };
		const chosen = withNowSource(doc, 'device:porch_temp');
		expect(chosen.home).toEqual({ scenes: ['scene:a'], weather: { now: 'device:porch_temp' } });
		expect(nowSourceOf(chosen)).toBe('device:porch_temp');
		expect(withNowSource(chosen, 'auto')).toEqual(doc);
		expect(withNowSource({ version: 1 }, 'auto')).toEqual({ version: 1 });
	});

	it('reads anything it doesn’t know as automatic', () => {
		expect(nowSourceOf({})).toBe('auto');
		expect(nowSourceOf({ home: { weather: { now: 'device:' as 'auto' } } })).toBe('auto');
		expect(nowSourceOf({ home: { weather: { now: 'sky' as 'auto' } } })).toBe('auto');
		expect(nowSourceOf({ home: { weather: { now: 'service' } } })).toBe('service');
	});

	it('automatic: the station while it reports, else the service, as Home always read it', () => {
		const all = house(service(), station(), porch);
		expect(nowFrom('auto', all, NOW)?.device_id).toBe('ecowitt_weather');
		const stale = house(service(), station({ last_seen: iso(NOW - 3 * 3600_000) }));
		expect(nowFrom('auto', stale, NOW)?.device_id).toBe('weather_home');
		expect(nowFrom('auto', house(porch), NOW)).toBeUndefined();
	});

	it('the service, or one device, while it reports; else automatic', () => {
		const all = house(service(), station(), porch);
		expect(nowFrom('service', all, NOW)?.device_id).toBe('weather_home');
		expect(nowFrom('device:porch_temp', all, NOW)?.device_id).toBe('porch_temp');
		const off = house(service(), station(), { ...porch, available: false });
		expect(nowFrom('device:porch_temp', off, NOW)?.device_id).toBe('ecowitt_weather');
		expect(nowFrom('device:gone', all, NOW)?.device_id).toBe('ecowitt_weather');
		expect(nowFrom('service', house(unfetched(), station()), NOW)?.device_id).toBe(
			'ecowitt_weather'
		);
	});

	it('offers stations and thermometers outside, never one inside or the service', () => {
		const all = house(service(), porch, den, station());
		expect(nowCandidates(all).map((d) => d.device_id)).toEqual(['ecowitt_weather', 'porch_temp']);
		const yard = { ...den, area: 'yard' };
		const rooms = [{ id: 'yard', name: 'Back Yard', slug: 'yard', aliases: [], deviceIds: [] }];
		expect(nowCandidates(house(yard), rooms).map((d) => d.device_id)).toEqual(['den_temp']);
	});

	it('says what automatic is now, and keeps a chosen device listed', () => {
		const all = house(service(), den, station());
		expect(nowChoicesOf(all, [], 'device:den_temp', NOW)).toEqual([
			{ value: 'auto', label: 'Automatic (Weather Station)' },
			{ value: 'service', label: 'The weather service' },
			{ value: 'device:ecowitt_weather', label: 'Weather Station' },
			{ value: 'device:den_temp', label: 'Den Sensor' }
		]);
		expect(nowChoicesOf(house(service()), [], 'auto', NOW)[0]?.label).toBe(
			'Automatic (the weather service)'
		);
	});

	it('finds the service by its kind, the one with something to say first', () => {
		const other = { ...unfetched(), device_id: 'weather_cabin' };
		expect(serviceOf(house(other, service()))?.device_id).toBe('weather_home');
		expect(serviceOf(house(station()))).toBeUndefined();
	});
});

describe('the line under now', () => {
	it('says a freeze tonight, by its coldest hour', () => {
		expect(noteOf(service().attributes, NOW)).toEqual({
			text: 'Freezing tonight: -1° by 6 AM',
			tone: 'amber'
		});
	});

	it('in the person’s unit', () => {
		followUnits(() => ({ temperature: 'F', measures: 'us' }));
		expect(noteOf(service().attributes, NOW)?.text).toBe('Freezing tonight: 30° by 6 AM');
	});

	it('leaves the hour out when no hour is that cold', () => {
		const a = service({ forecast_hourly: [] }).attributes;
		expect(noteOf(a, NOW)?.text).toBe('Freezing tonight: -1°');
	});

	it('gives way to a weather warning, amber or red by how serious', () => {
		const watch = service({ alert_level: 2, alert_headline: 'Frost advisory until 9 AM' });
		expect(noteOf(watch.attributes, NOW)).toEqual({
			text: 'Frost advisory until 9 AM',
			tone: 'amber'
		});
		const warning = service({ alert_level: 3, alert_headline: 'Winter storm warning' });
		expect(noteOf(warning.attributes, NOW)?.tone).toBe('red');
	});

	it('says nothing with no freeze and no warning', () => {
		expect(noteOf(service({ freeze_tonight: false }).attributes, NOW)).toBeUndefined();
		expect(noteOf(service({ tonight_low: null }).attributes, NOW)).toBeUndefined();
	});
});

describe('the next 24 hours', () => {
	it('draws a line across the box, now first, and bars where rain is likely', () => {
		const h = hoursOf(HOURS, NOW)!;
		expect(h.path.startsWith('M0 ')).toBe(true);
		expect(h.path).toMatch(/ 400 [\d.]+$/);
		expect(h.path.match(/C/g)).toHaveLength(24);
		expect(h.dot.x).toBe(0);
		expect(h.bars).toHaveLength(6);
		expect(h.bars.every((b) => b.y + b.h === 76)).toBe(true);
	});

	it('names now, the low, the high and the most rain', () => {
		const h = hoursOf(HOURS, NOW)!;
		expect(h.marks.map((m) => m.text)).toEqual(['5°', '-1°', '10°', '40%']);
		const low = h.marks[1]!;
		const high = h.marks[2]!;
		expect(low.y).toBeGreaterThan(high.y);
		expect(h.marks[3]?.rain).toBe(true);
	});

	it('labels now and every three hours (none too near now), every six kept on a narrow band', () => {
		const h = hoursOf(HOURS, NOW)!;
		expect(h.ticks[0]).toEqual({ at: 0, text: 'Now', minor: false });
		expect(h.ticks.map((t) => t.text)).toEqual([
			'Now',
			'3 AM',
			'6 AM',
			'9 AM',
			'12 PM',
			'3 PM',
			'6 PM'
		]);
		expect(h.ticks.filter((t) => !t.minor).map((t) => t.text)).toEqual([
			'Now',
			'6 AM',
			'12 PM',
			'6 PM'
		]);
	});

	it('says it all in words', () => {
		expect(hoursOf(HOURS, NOW)?.label).toBe(
			'Next 24 hours: 5° now, low -1° at 6 AM, high 10° at 2 PM; rain chance up to 40% around 4 PM.'
		);
	});

	it('drops hours gone by, and is nothing with fewer than two', () => {
		const late = hoursOf(HOURS, NOW + 3 * 3600_000)!;
		expect(late.marks[0]?.text).toBe('3°');
		expect(hoursOf(HOURS.slice(0, 1), NOW)).toBeUndefined();
		expect(hoursOf(null, NOW)).toBeUndefined();
		expect(
			hoursOf(
				HOURS.map((x) => ({ ...x, temperature: null })),
				NOW
			)
		).toBeUndefined();
	});

	it('draws a smooth path through its points', () => {
		expect(smoothPath([])).toBe('');
		expect(
			smoothPath([
				{ x: 0, y: 10 },
				{ x: 60, y: 10 }
			])
		).toBe('M0 10 C10 10 50 10 60 10');
	});
});

describe('the next days', () => {
	const days = daysOf(service(), NOW);

	it('start today and run a week', () => {
		expect(days.map((d) => d.label)).toEqual(['Today', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
	});

	it('three rows, each its low to its high on one scale, now a dot on today', () => {
		const rows = dayRowsOf(days, 3, 5);
		expect(rows.map((r) => [r.label, r.low, r.high, r.rain])).toEqual([
			['Today', '1°', '11°', undefined],
			['Sun', '3°', '13°', '20%'],
			['Mon', '5°', '9°', '80%']
		]);
		// The scale runs from 0.5 (today's low) to 13 (Sunday's high).
		expect(rows[0]?.bar).toEqual({ left: 0, right: 16 });
		expect(rows[1]?.bar).toEqual({ left: 20, right: 0 });
		expect(rows[2]?.bar).toEqual({ left: 36, right: 32 });
		expect(rows[0]?.dot).toBe(36);
		expect(rows[1]?.dot).toBeUndefined();
		expect(rows[2]?.icon).toBe('rain');
	});

	it('seven rows widen the scale to the week', () => {
		const rows = dayRowsOf(days, 7, 5);
		expect(rows).toHaveLength(7);
		// -4 (Thursday's low) to 13.
		expect(rows[5]?.bar?.left).toBe(0);
		expect(rows[1]?.bar?.right).toBe(0);
		expect(rows[0]?.bar?.left).toBe(26.5);
		expect(rows[4]?.rain).toBeUndefined();
	});

	it('a day without both ends has no bar', () => {
		const rows = dayRowsOf([{ label: 'Today', high: 10 }], 3);
		expect(rows[0]?.bar).toBeUndefined();
		expect(rows[0]?.high).toBe('10°');
	});
});

describe('the band', () => {
	it('now from the service, with its sky, feels like, high and low and the wind', () => {
		const b = bandOf(house(service()), 'auto', NOW)!;
		expect(b.full).toBe(true);
		expect(b.now).toMatchObject({
			temp: '5°',
			icon: 'moon',
			condition: 'Clear',
			feels: 'Feels like 2°',
			high: '11°',
			low: '1°',
			wind: '14 km/h NW',
			humidity: '62%',
			from: undefined
		});
		expect(b.now?.note?.text).toBe('Freezing tonight: -1° by 6 AM');
		expect(b.hours).toBeDefined();
		expect(b.days).toHaveLength(7);
	});

	it('now from a station names it, without the service’s feels like', () => {
		const b = bandOf(house(service(), station()), 'auto', NOW)!;
		expect(b.now).toMatchObject({ temp: '5°', humidity: '80%', from: 'Weather Station' });
		expect(b.now?.feels).toBeUndefined();
		expect(b.now?.condition).toBe('Clear');
	});

	it('in °F and mph for a person who reads °F', () => {
		followUnits(() => ({ temperature: 'F', measures: 'us' }));
		const b = bandOf(house(service()), 'service', NOW)!;
		expect([b.now?.temp, b.now?.high, b.now?.wind]).toEqual(['41°', '52°', '9 mph NW']);
	});

	it('a station alone keeps now, compact', () => {
		const b = bandOf(house(station()), 'auto', NOW)!;
		expect(b.full).toBe(false);
		expect(b.now).toMatchObject({ temp: '5°', from: 'Weather Station', humidity: '80%' });
		expect(b.now?.condition).toBeUndefined();
		expect(b.hours).toBeUndefined();
		expect(b.days).toEqual([]);
	});

	it('a station with a service that hasn’t fetched is the compact now', () => {
		const b = bandOf(house(unfetched(), station()), 'auto', NOW)!;
		expect(b.full).toBe(false);
		expect(b.now?.from).toBe('Weather Station');
		expect(b.now?.note).toBeUndefined();
	});

	it('is nothing with no service and no station', () => {
		expect(bandOf(house(den, porch), 'auto', NOW)).toBeUndefined();
		expect(bandOf({}, 'auto', NOW)).toBeUndefined();
	});

	it('is nothing with a service that hasn’t fetched and no station', () => {
		expect(bandOf(house(unfetched()), 'auto', NOW)).toBeUndefined();
		expect(bandOf(house(unfetched()), 'service', NOW)).toBeUndefined();
		const stale = station({ last_seen: iso(NOW - 3 * 3600_000) });
		expect(bandOf(house(unfetched(), stale), 'auto', NOW)).toBeUndefined();
	});

	it('shows only the parts that have something to say', () => {
		const noHours = bandOf(house(service({ forecast_hourly: null })), 'auto', NOW)!;
		expect([!!noHours.now, !!noHours.hours, noHours.days.length]).toEqual([true, false, 7]);
		const noDays = bandOf(house(service({ forecast: null })), 'auto', NOW)!;
		expect([!!noDays.now, !!noDays.hours, noDays.days.length]).toEqual([true, true, 0]);
		const noNow = bandOf(house(service({ temperature: null })), 'service', NOW)!;
		expect([!!noNow.now, !!noNow.hours, noNow.days.length]).toEqual([false, true, 7]);
		const bare = bandOf(house(service({ forecast: null, forecast_hourly: null })), 'auto', NOW)!;
		expect(bare.full).toBe(false);
		expect(bare.now?.condition).toBe('Clear');
	});

	it('uses the clock’s night when the service doesn’t say', () => {
		const all = house(service({ is_day: null }));
		expect(bandOf(all, 'auto', NOW, true)?.now?.icon).toBe('moon');
		expect(bandOf(all, 'auto', NOW, false)?.now?.icon).toBe('sun');
	});
});
