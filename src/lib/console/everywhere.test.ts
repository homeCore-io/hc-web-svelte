import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import type { Room } from '../house.js';
import type { Units } from '../units.js';
import {
	climateView,
	everyRoom,
	fromWord,
	issuesOf,
	issuesWord,
	lightRows,
	lightsCount,
	onWord,
	openValves,
	placesOf,
	playerRows,
	playingNow,
	secRows,
	silentRooms,
	statusOf,
	viewOf,
	waterView
} from './everywhere.js';

const F: Units = { temperature: 'F', measures: 'us' };

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes,
	...more
});
const room = (id: string, name: string): Room => ({
	id,
	name,
	slug: id,
	aliases: [],
	deviceIds: []
});
const ids = (list: { device: CoreDevice }[]) => list.map((r) => r.device.device_id);

const office = room('office', 'Office');
const garage = room('garage', 'Garage');
const attic = room('attic', 'Attic');

/** Devices by room id, those in no room under '' (summary.ts's `byRoom`). */
const house = (rooms: Record<string, CoreDevice[]>) => new Map(Object.entries(rooms));

describe('the house, room by room', () => {
	it('keeps the order given, and puts what is in no room last', () => {
		const places = placesOf(
			house({ '': [dev('wled', 'light')], garage: [dev('g', 'light')], office: [] }),
			[office, garage]
		);
		expect(places.map((p) => p.name)).toEqual(['Office', 'Garage', 'No room']);
		expect(places[2]!.room).toBeUndefined();
	});

	it('leaves out "No room" when everything has a room', () => {
		expect(placesOf(house({ office: [] }), [office]).map((p) => p.key)).toEqual(['office']);
	});

	it('adds the rooms a person hid after the ones Home shows', () => {
		expect(everyRoom([garage], [attic, garage, office])).toEqual([garage, attic, office]);
	});

	it('knows its views', () => {
		expect(viewOf('water')).toBe('water');
		expect(viewOf('kitchen')).toBeUndefined();
	});
});

describe('Lights', () => {
	const places = placesOf(
		house({
			office: [
				dev('lamp', 'light', { on: true, brightness_pct: 40 }),
				dev('desk', 'light', { on: false })
			],
			garage: [
				dev('cam', 'camera'),
				dev('cam_spotlight', 'light', { on: true }),
				dev('opener', 'switch', {}, { name: 'Garage Door 1' })
			],
			attic: [dev('bulb', 'light', { on: false })]
		}),
		[office, garage, attic]
	);

	it('has a row for each room with lights, without camera spotlights', () => {
		const rows = lightRows(places);
		expect(rows.map((r) => r.place.name)).toEqual(['Office', 'Attic']);
		expect(ids(rows[0]!.lights.map((device) => ({ device })))).toEqual(['desk', 'lamp']);
	});

	it('leaves out a spotlight whose camera is in another room, in the No room row too', () => {
		const rows = lightRows(
			placesOf(
				house({
					garage: [dev('deck', 'camera'), dev('bulb', 'light', { on: false })],
					office: [dev('porch', 'camera'), dev('deck_spotlight', 'light', { on: true })],
					'': [dev('porch_spotlight', 'light', { on: true }), dev('wled', 'light')]
				}),
				[office, garage]
			)
		);
		expect(rows.map((r) => [r.place.name, ids(r.lights.map((device) => ({ device })))])).toEqual([
			['Garage', ['bulb']],
			['No room', ['wled']]
		]);
	});

	it('leaves out a virtual switch named as a light', () => {
		const glue = { plugin_id: 'core.glue' };
		const rows = lightRows(
			placesOf(
				house({
					garage: [
						dev('porch', 'switch', { on: true }, { ...glue, name: 'Porch Light' }),
						dev('bulb', 'light', { on: false })
					]
				}),
				[garage]
			)
		);
		expect(ids(rows[0]!.lights.map((device) => ({ device })))).toEqual(['bulb']);
	});

	it('adds the switches Home counts as lights, after the faders', () => {
		const rows = lightRows(
			placesOf(
				house({
					garage: [
						dev('opener', 'switch', { on: false }, { name: 'Garage Door 1' }),
						dev('overhead', 'switch', { on: true }, { name: 'Garage Overhead Light' }),
						dev('bulb', 'light', { on: false })
					]
				}),
				[garage]
			)
		);
		expect(rows.map((r) => r.lights.map((d) => d.device_id))).toEqual([['bulb', 'overhead']]);
		expect(onWord(rows[0]!.lights)).toBe('1 of 2 on');
	});

	it('counts lights on and the rooms they are in, with commands on their way', () => {
		const rows = lightRows(places);
		expect(lightsCount(rows)).toEqual({ on: 1, all: 3, rooms: 1, loose: 0 });
		expect(lightsCount(rows, { bulb: { want: { on: true } } })).toEqual({
			on: 2,
			all: 3,
			rooms: 2,
			loose: 0
		});
		expect(lightsCount(rows, { lamp: { want: { on: false } } })).toEqual({
			on: 0,
			all: 3,
			rooms: 0,
			loose: 0
		});
	});

	it('never counts No room as a room, and says the lights in it apart', () => {
		const places = placesOf(
			house({
				garage: [dev('bulb', 'light', { on: true })],
				'': [dev('wled', 'light', { on: true }), dev('eaves', 'light', { on: true })]
			}),
			[garage]
		);
		const count = lightsCount(lightRows(places));
		expect(count).toEqual({ on: 3, all: 3, rooms: 1, loose: 2 });
		expect(statusOf(places).lights).toMatchObject({
			word: '3 on',
			full: '3 on in 1 room and 2 with no room'
		});
	});

	it('counts an offline light as off', () => {
		const rows = lightRows(
			placesOf(house({ '': [{ ...dev('eaves', 'light', { on: true }), available: false }] }), [])
		);
		expect(lightsCount(rows)).toEqual({ on: 0, all: 1, rooms: 0, loose: 0 });
	});

	it('leaves out what powers something else, unless the household put it on Lights', () => {
		const devices = [
			dev('ac', 'switch', { on: true }, { name: 'Outlet - Living Room AC' }),
			dev('meter', 'switch', { on: true }, { name: 'YoLink Plug Power Meter' }),
			dev('fan', 'switch', { on: true }, { name: 'Bathroom Exhaust Fan' }),
			dev('holiday', 'switch', { on: true }, { name: 'Holiday Lights 1' }),
			dev('lamp', 'light', { on: true })
		];
		const rows = lightRows(placesOf(house({ garage: devices }), [garage]));
		expect(ids(rows[0]!.lights.map((device) => ({ device }))).sort()).toEqual(['holiday', 'lamp']);
		const chosen = lightRows(placesOf(house({ garage: devices }), [garage], { ac: 'lights' }));
		expect(ids(chosen[0]!.lights.map((device) => ({ device }))).sort()).toEqual([
			'ac',
			'holiday',
			'lamp'
		]);
	});

	it('says how many are on in a room', () => {
		const lamp = dev('a', 'light', { on: true });
		const desk = dev('b', 'light', { on: false });
		expect(onWord([lamp, desk])).toBe('1 of 2 on');
		expect(onWord([desk])).toBe('All off');
		expect(onWord([lamp])).toBe('On');
		expect(onWord([lamp, { ...desk, attributes: { on: true } }])).toBe('All 2 on');
		expect(onWord([{ ...lamp, available: false }])).toBe('All off');
	});
});

describe('Media', () => {
	const sonos = (id: string, state = 'stopped') =>
		dev(id, 'media_player', { state }, { plugin_id: 'plugin.sonos' });
	const roku = (id: string) =>
		dev(id, 'media_player', { app_name: 'YouTube' }, { plugin_id: 'plugin.roku' });
	const places = placesOf(
		house({
			office: [sonos('b_speaker', 'playing'), roku('z_tv')],
			garage: [],
			attic: [sonos('attic_speaker')]
		}),
		[office, garage, attic]
	);

	it('lists every player room by room, screens before speakers', () => {
		expect(ids(playerRows(places))).toEqual(['z_tv', 'b_speaker', 'attic_speaker']);
	});

	it('finds what is playing, with commands on their way', () => {
		const rows = playerRows(places);
		expect(ids(playingNow(rows))).toEqual(['b_speaker']);
		expect(ids(playingNow(rows, { b_speaker: { want: { state: 'paused' } } }))).toEqual([]);
	});

	it('names the rooms with nothing to play, not counting "No room"', () => {
		expect(silentRooms(places).map((p) => p.name)).toEqual(['Garage']);
	});
});

describe('Climate', () => {
	const places = placesOf(
		house({
			office: [
				dev('stat', 'thermostat', { temperature: 20, setpoint: 21 }),
				dev('fan', 'fan', { on: false, speed: 'off' }),
				dev('desk_temp', 'temperature_sensor', { temperature: 20, humidity: 41 }),
				dev(
					'motion',
					'motion_sensor',
					{ temperature: 21, motion: false },
					{ plugin_id: 'plugin.hue' }
				),
				dev('leak', 'water_sensor', { temperature: 18, water_detected: false }),
				dev('door', 'contact_sensor', { open: false })
			],
			'': [
				dev('z_station', 'weather_station', { temperature: 10, humidity: 80 }),
				dev('a_channel', 'temperature_sensor', { temperature: 19 })
			]
		}),
		[office]
	);

	it('lists every thermostat and fan', () => {
		const v = climateView(places, {}, F);
		expect(ids(v.thermostats)).toEqual(['stat']);
		expect(ids(v.fans)).toEqual(['fan']);
	});

	it('lists every temperature and humidity reading, motion sensors too, not leak sensors', () => {
		const v = climateView(places, {}, F);
		expect(v.readings.map((r) => r.reading.device.device_id)).toEqual([
			'desk_temp',
			'motion',
			'z_station',
			'a_channel'
		]);
		expect(v.readings.map((r) => r.where)).toEqual(['Office', 'Office', 'Outside', undefined]);
		expect(v.readings[0]!.reading.temp).toBe(68);
		expect(v.readings[0]!.reading.humidity).toBe(41);
	});

	it('says what reads it', () => {
		expect(fromWord(dev('m', 'motion_sensor', {}, { plugin_id: 'plugin.hue' }))).toBe('Hue motion');
		expect(fromWord(dev('t', 'temperature_sensor', {}, { plugin_id: 'plugin.yolink' }))).toBe(
			'YoLink'
		);
	});
});

describe('Security', () => {
	const places = placesOf(
		house({
			office: [
				dev('back_lock', 'lock', { locked: false }, { name: 'Back Door Lock' }),
				dev('front_lock', 'lock', { locked: true }),
				dev('window', 'contact_sensor', { open: true })
			],
			garage: [
				dev('side', 'contact_sensor', { contact: true }),
				dev('gone', 'lock', { locked: false }, { available: false }),
				dev('leak', 'water_sensor', { water_detected: true })
			],
			attic: [dev('bulb', 'light')]
		}),
		[office, garage, attic]
	);

	it('lists each room’s locks, then its doors, leaving leaks to Water', () => {
		const rows = secRows(places);
		expect(rows.map((r) => r.place.name)).toEqual(['Office', 'Garage']);
		expect(rows[0]!.items.map((i) => [i.device.device_id, i.word])).toEqual([
			['back_lock', 'Unlocked'],
			['front_lock', 'Locked'],
			['window', 'Open']
		]);
		expect(rows[1]!.items.map((i) => [i.device.device_id, i.word, i.ok])).toEqual([
			['gone', 'Offline', false],
			['side', 'Closed', true]
		]);
	});

	it('puts what is unlocked, open or offline first', () => {
		expect(issuesOf(secRows(places)).map((i) => [i.item.device.device_id, i.item.word])).toEqual([
			['back_lock', 'Unlocked'],
			['window', 'Open'],
			['gone', 'Offline']
		]);
	});

	it('names the sidebar’s count by what it is', () => {
		const issues = issuesOf(secRows(places));
		expect(issuesWord(issues)).toBe('3 to check');
		expect(issuesWord(issues.filter((i) => i.item.device.available))).toBe('2 open');
		expect(issuesWord(issues.filter((i) => !i.item.device.available))).toBe('1 offline');
	});

	it('counts a lock on its way to locking as locked', () => {
		const rows = secRows(places, { back_lock: { want: { locked: true } } });
		expect(issuesOf(rows).map((i) => i.item.device.device_id)).toEqual(['window', 'gone']);
	});
});

describe('Water', () => {
	const places = placesOf(
		house({
			garage: [
				dev('valve', 'switch', { on: false }, { name: 'Water Valve' }),
				dev('heater_leak', 'water_sensor', { water_detected: true })
			],
			office: [dev('sink', 'leak_sensor', { leak: false })],
			attic: []
		}),
		[office, garage, attic]
	);

	it('lists the valves, and the leak sensors by room', () => {
		const v = waterView(places);
		expect(ids(v.valves)).toEqual(['valve']);
		expect(v.leaks.map((r) => [r.place.name, r.sensors.map((d) => d.device_id)])).toEqual([
			['Office', ['sink']],
			['Garage', ['heater_leak']]
		]);
		expect(ids(v.wet)).toEqual(['heater_leak']);
	});

	it('reads a valve relay as open while it is off', () => {
		const v = waterView(places);
		expect(ids(openValves(v))).toEqual(['valve']);
		expect(ids(openValves(v, { valve: { want: { on: true } } }))).toEqual([]);
	});
});

describe('the sidebar', () => {
	it('says how each view is now', () => {
		const places = placesOf(
			house({
				office: [
					dev('lamp', 'light', { on: true }),
					dev('speaker', 'media_player', { state: 'playing' }, { plugin_id: 'plugin.sonos' }),
					dev('lock', 'lock', { locked: false }),
					dev('leak', 'water_sensor', { water_detected: false })
				]
			}),
			[office]
		);
		const s = statusOf(places);
		expect(s.lights).toEqual({ word: '1 on', full: '1 on in 1 room', tone: 'on' });
		expect(s.media).toEqual({ word: '1 playing', tone: 'media' });
		expect(s.security).toEqual({ word: '1 open', tone: 'warn' });
		expect(s.water).toEqual({ word: 'all dry', tone: 'ok' });
		expect(statusOf(places, { lock: { want: { locked: true } } }).security).toEqual({
			word: 'secure',
			tone: 'ok'
		});
	});

	it('counts an offline lock or door in Security, in red', () => {
		const places = placesOf(
			house({
				office: [
					dev('lock', 'lock', { locked: true }, { available: false }),
					dev('door', 'contact_sensor', { open: false }, { available: false }),
					dev('lamp', 'light', { on: false }, { available: false })
				]
			}),
			[office]
		);
		expect(statusOf(places).security).toEqual({ word: '2 offline', tone: 'warn' });
	});
});
