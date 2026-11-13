import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import type { Room } from '../house.js';
import type { ConsoleHouse } from './style.js';
import {
	brandOf,
	consoleRoom,
	devicesIn,
	levelOf,
	levelWant,
	lightColumns,
	opens,
	placeOf,
	roomSlugOf,
	layOut,
	shortName,
	tabChoicesOf,
	tabOf,
	withDeviceTab
} from './room.js';

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
const hue = (id: string, type: string, attributes: Record<string, unknown> = {}) =>
	dev(id, type, { bridge_id: 'b1', ...attributes }, { plugin_id: 'plugin.hue' });
const lutron = (id: string, type: string, attributes: Record<string, unknown> = {}) =>
	dev(id, type, attributes, { plugin_id: 'plugin.lutron' });
const ids = (list: CoreDevice[]) => list.map((d) => d.device_id);

const family: Room = {
	id: 'r1',
	name: 'Family Room',
	slug: 'family_room',
	aliases: ['den'],
	deviceIds: []
};

describe('which room a device is in', () => {
	it('takes homeCore’s room first, then the person’s choice, then the bridge’s', () => {
		expect(roomSlugOf(dev('a', 'light', {}, { area: 'x', area_override: 'y' }))).toBe('y');
		expect(
			roomSlugOf({
				...dev('a', 'light', {}, { area: 'x', area_override: 'y' }),
				room: 'z'
			} as never)
		).toBe('z');
		expect(roomSlugOf(dev('a', 'light', {}, { area: 'x' }))).toBe('x');
	});

	it('finds a room’s devices by its slug or an alias', () => {
		const all = [
			dev('a', 'light', {}, { area: 'Family Room' }),
			dev('b', 'light', {}, { area: 'den' }),
			dev('c', 'light', {}, { area: 'office' }),
			dev('d', 'light')
		];
		expect(ids(devicesIn(all, family))).toEqual(['a', 'b']);
	});
});

describe('which tab a device goes in', () => {
	it('puts each kind in one tab', () => {
		expect(placeOf(dev('l', 'light'))).toEqual({ tab: 'lights', as: 'light' });
		expect(placeOf(dev('s', 'switch'))).toEqual({ tab: 'switch' });
		expect(placeOf(dev('k', 'lock'))).toEqual({ tab: 'doors' });
		expect(placeOf(dev('c', 'contact_sensor'))).toEqual({ tab: 'doors' });
		expect(placeOf(dev('m', 'media_player'))).toEqual({ tab: 'media' });
		expect(placeOf(dev('t', 'thermostat'))).toEqual({ tab: 'climate' });
		expect(placeOf(dev('f', 'fan'))).toEqual({ tab: 'climate' });
		expect(placeOf(dev('w', 'water_sensor'))).toEqual({ tab: 'water' });
		expect(placeOf(dev('h', 'temperature_sensor'))).toEqual({ tab: 'sensors' });
		expect(placeOf(dev('o', 'occupancy_sensor'))).toEqual({ tab: 'sensors' });
		expect(placeOf(dev('v', 'camera'))).toEqual({ tab: 'cameras' });
		expect(placeOf(dev('b', 'doorbell'))).toEqual({ tab: 'cameras' });
		expect(placeOf(dev('n', 'siren'))).toEqual({ tab: 'cameras' });
	});

	it('leaves hubs and remotes out', () => {
		expect(placeOf(dev('g', 'gateway'))).toBeNull();
		expect(placeOf(dev('p', 'pico_remote', { available_buttons: [2, 4] }))).toBeNull();
	});

	it('reads a switch’s name for what it really runs', () => {
		expect(placeOf(dev('Water Valve', 'switch'))).toEqual({ tab: 'water' });
		expect(placeOf(dev('Office Humidifier Plug', 'switch'))).toEqual({ tab: 'climate' });
		expect(placeOf(dev('Garage Door', 'switch'))).toEqual({ tab: 'doors' });
		expect(placeOf(dev('Holiday Lights', 'switch'))).toEqual({ tab: 'switch' });
	});

	it('takes a person’s hint over the plugin’s type', () => {
		expect(placeOf(dev('x', 'switch', {}, { ui_hint: 'light' }))).toEqual({
			tab: 'lights',
			as: 'light'
		});
	});

	it('puts Lutron keypads and lighting scenes in Lights', () => {
		expect(placeOf(lutron('k', 'keypad', { available_buttons: [], led_1: 1 }))).toEqual({
			tab: 'lights',
			as: 'keypad'
		});
		expect(placeOf(hue('s', 'scene', { group_rid: 'g' }))).toEqual({ tab: 'lights', as: 'scene' });
	});

	it('counts a Lights tab with only a keypad by what is on it, never 0', () => {
		const r = consoleRoom([lutron('k', 'keypad', { available_buttons: [], led_1: 1 })]);
		expect(r.tabs.find((t) => t.id === 'lights')?.count).toBe(1);
	});
});

describe('homeCore’s own switches', () => {
	const glue = (id: string, type: string, name: string, attributes = {}) =>
		dev(id, type, attributes, { name, plugin_id: 'core.glue' });

	it('are switches, never placed by their names', () => {
		expect(placeOf(glue('a', 'switch', 'Garage Door'))).toEqual({ tab: 'switch' });
		expect(placeOf(glue('b', 'switch', 'Water Valve'))).toEqual({ tab: 'switch' });
		expect(placeOf(glue('c', 'switch', 'Space Heater'))).toEqual({ tab: 'switch' });
		expect(placeOf(glue('d', 'switch', 'Porch Light'))).toEqual({ tab: 'switch' });
		expect(opens(glue('a', 'switch', 'Garage Door'))).toBe(false);
		// A plugin's switch is still read by its name.
		expect(placeOf(dev('e', 'switch', {}, { name: 'Garage Door' }))).toEqual({ tab: 'doors' });
	});

	it('keep a group with no brightness as a switch, and one with it as a light', () => {
		expect(placeOf(glue('g', 'group', 'Garage things', { on: false }))).toEqual({ tab: 'switch' });
		expect(placeOf(glue('h', 'group', 'Den lamps', { on: true, brightness_pct: 40 }))).toEqual({
			tab: 'lights',
			as: 'light'
		});
	});

	it('sit with the room’s switches and count as no light', () => {
		const r = consoleRoom([
			glue('door', 'switch', 'Garage Door', { on: false }),
			glue('porch', 'switch', 'Porch Light', { on: true }),
			dev('lamp', 'light', { on: true })
		]);
		expect(ids(r.lights.switches)).toEqual(['door', 'porch']);
		expect(r.byTab.doors).toEqual([]);
		expect(r.lights.columns.flatMap((c) => ids(c.lights))).toEqual(['lamp']);
	});
});

describe('the household’s choice of tab', () => {
	const glue = (id: string, type: string, name: string, attributes = {}) =>
		dev(id, type, attributes, { name, plugin_id: 'core.glue' });
	const room = [
		glue('switch_auto_garage_door', 'switch', 'Auto Garage Door', { on: false }),
		glue('timer_garage_close', 'timer', 'Garage Close', { state: 'idle' }),
		glue('switch_porch_light', 'switch', 'Porch Light', { on: false }),
		dev('lock', 'lock', { locked: true }),
		dev('lamp', 'light', { on: true, brightness_pct: 40 })
	];
	/** Every tab and part of the Lights tab a device shows in. */
	const whereIs = (r: ReturnType<typeof consoleRoom>, id: string) => [
		...Object.entries(r.byTab)
			.filter(([, list]) => ids(list).includes(id))
			.map(([t]) => t),
		...(ids(r.lights.switches).includes(id) ? ['lights.switches'] : []),
		...(r.lights.columns.some((c) => ids(c.lights).includes(id)) ? ['lights.columns'] : [])
	];

	it('puts a virtual switch and a timer on Doors, and nowhere else', () => {
		const r = consoleRoom(room, undefined, {
			switch_auto_garage_door: 'doors',
			timer_garage_close: 'doors'
		});
		expect(whereIs(r, 'switch_auto_garage_door')).toEqual(['doors']);
		expect(whereIs(r, 'timer_garage_close')).toEqual(['doors']);
		expect(ids(r.byTab.doors)).toEqual(['switch_auto_garage_door', 'timer_garage_close', 'lock']);
		// The rest go where they go by themselves.
		expect(whereIs(r, 'switch_porch_light')).toEqual(['lights', 'lights.switches']);
		expect(r.tabs.find((t) => t.id === 'switches')).toBeUndefined();
	});

	it('without a choice, leaves the switch with the switches and puts the timer on Timers', () => {
		const r = consoleRoom(room);
		expect(whereIs(r, 'switch_auto_garage_door')).toEqual(['lights', 'lights.switches']);
		expect(whereIs(r, 'timer_garage_close')).toEqual(['timers']);
	});

	it('puts what dims on Lights as a light, and what doesn’t with its switches', () => {
		const r = consoleRoom(
			[
				dev('fan', 'fan', { on: true, brightness_pct: 50 }),
				glue('t', 'timer', 'Lights Off', { state: 'idle' }),
				dev('lamp', 'light', { on: true })
			],
			undefined,
			{ fan: 'lights', t: 'lights' }
		);
		expect(whereIs(r, 'fan')).toEqual(['lights', 'lights.columns']);
		expect(whereIs(r, 't')).toEqual(['lights', 'lights.switches']);
	});

	it('keeps a lock in the header on whichever tab it is', () => {
		const r = consoleRoom(room, undefined, { lock: 'switches' });
		expect(whereIs(r, 'lock')).toEqual(['switches']);
		expect(ids(r.locks)).toEqual(['lock']);
	});

	it('reads only tabs it knows from the saved choices', () => {
		expect(tabChoicesOf({ a: 'doors', b: 'attic', c: 3, '': 'doors' })).toEqual({ a: 'doors' });
		expect(tabChoicesOf(['doors'])).toEqual({});
		expect(tabChoicesOf(undefined)).toEqual({});
	});

	it('sets a device’s tab beside the household’s other console choices, and clears it', () => {
		const was: ConsoleHouse = { switch: 'keypad', pills: { home: true } };
		const set = withDeviceTab(was, 'timer_garage_close', 'doors');
		expect(set).toEqual({
			switch: 'keypad',
			pills: { home: true },
			tabs: { timer_garage_close: 'doors' }
		});
		expect(withDeviceTab(set, 'timer_garage_close', undefined)).toEqual(was);
		expect(withDeviceTab({ tabs: { a: 'doors' } }, 'a', undefined)).toBeUndefined();
	});
});

describe('the Lights tab’s columns', () => {
	it('gives a Hue group its lights, and its scenes by the room they name', () => {
		const a = hue('a', 'light');
		const b = hue('b', 'light');
		const g = hue('g', 'group', { light_ids: ['a', 'b', 'elsewhere'], group_rid: 'R' });
		const s = hue('s', 'scene', { group_rid: 'R', group_name: 'Living Room' });
		const { columns } = lightColumns([a, b], [g], [s]);
		expect(columns).toHaveLength(1);
		expect(columns[0]!.group).toBe(g);
		expect(ids(columns[0]!.lights)).toEqual(['a', 'b']);
		expect(ids(columns[0]!.scenes)).toEqual(['s']);
		expect(columns[0]!.title).toBe('g');
	});

	it('gathers a bridge’s lights by the room it puts them in', () => {
		const a = hue('a', 'light', { room_rid: 'R', room_name: 'Office' });
		const b = hue('b', 'light', { room_rid: 'R' });
		const c = hue('c', 'light', { room_rid: 'Q', room_name: 'Porch' });
		const { columns } = lightColumns([a, b, c], [], []);
		expect(columns.map((c) => ids(c.lights))).toEqual([['a', 'b'], ['c']]);
		expect(columns[0]!.title).toBe('Office');
	});

	it('gives a bridge’s scenes to its lights when the lights don’t say their room', () => {
		const a = hue('a', 'light');
		const b = hue('b', 'light');
		const s = hue('s', 'scene', { group_rid: 'R', group_name: 'Family Room' });
		const { columns } = lightColumns([a, b], [], [s]);
		expect(columns).toHaveLength(1);
		expect(columns[0]!.title).toBe('Family Room');
		expect(ids(columns[0]!.scenes)).toEqual(['s']);
		expect(columns[0]!.group).toBeUndefined();
	});

	it('keeps two bridges apart', () => {
		const a = hue('a', 'light');
		const b = dev('b', 'light', { bridge_id: 'b2', room_rid: 'R2' }, { plugin_id: 'plugin.hue' });
		const s1 = hue('s1', 'scene', { group_rid: 'R1', group_name: 'Office' });
		const s2 = dev(
			's2',
			'scene',
			{ bridge_id: 'b2', group_rid: 'R2', group_name: 'Study' },
			{ plugin_id: 'plugin.hue' }
		);
		const { columns } = lightColumns([a, b], [], [s1, s2]);
		expect(columns.map((c) => [ids(c.lights), ids(c.scenes)])).toEqual([
			[['a'], ['s1']],
			[['b'], ['s2']]
		]);
	});

	it('gives each other brand a column, named for its one light', () => {
		const { columns } = lightColumns([lutron('Overhead', 'light')], [], []);
		expect(columns[0]).toMatchObject({ brand: 'Lutron', title: 'Overhead', scenes: [] });
	});

	it('keeps scenes that belong to no group apart', () => {
		const { loose } = lightColumns([], [], [lutron('Movie', 'scene')]);
		expect(ids(loose)).toEqual(['Movie']);
	});
});

describe('a room in tabs', () => {
	const lamps = [hue('a', 'light'), hue('b', 'light'), lutron('Overhead', 'light')];

	it('shows only the tabs with something in them, Lights first', () => {
		const r = consoleRoom([
			...lamps,
			dev('lock', 'lock'),
			dev('tv', 'media_player'),
			dev('temp', 'temperature_sensor')
		]);
		expect(r.tabs.map((t) => t.id)).toEqual(['lights', 'doors', 'media', 'sensors']);
		expect(r.first).toBe('lights');
		expect(ids(r.locks)).toEqual(['lock']);
	});

	it('puts a camera’s spotlight and siren with it, in Cameras, counting the camera', () => {
		const r = consoleRoom([
			...lamps,
			dev('cam', 'camera'),
			dev('cam_spotlight', 'light', { on: false }),
			dev('cam_siren', 'siren'),
			dev('other_spotlight', 'light')
		]);
		expect(r.tabs.map((t) => [t.id, t.count])).toEqual([
			['lights', 4],
			['cameras', 1]
		]);
		expect(ids(r.byTab.cameras)).toEqual(['cam', 'cam_siren', 'cam_spotlight']);
		expect(ids(r.byTab.lights)).toContain('other_spotlight');
	});

	it('shows Doors first where something opens', () => {
		const r = consoleRoom([...lamps, dev('door', 'garage_door'), dev('fan', 'fan')]);
		expect(r.tabs.map((t) => t.id)).toEqual(['doors', 'lights', 'climate']);
	});

	it('puts the switch a thermostat runs with it, in Climate', () => {
		const r = consoleRoom([
			...lamps,
			dev('ac', 'thermostat', { actuator_device_id: 'plug' }),
			dev('plug', 'switch'),
			dev('lamp plug', 'switch')
		]);
		expect(ids(r.byTab.climate)).toEqual(['ac', 'plug']);
		expect(ids(r.lights.switches)).toEqual(['lamp plug']);
	});

	it('keeps a few switches in Lights as a column', () => {
		const r = consoleRoom([...lamps, dev('s1', 'switch'), dev('s2', 'switch')]);
		expect(ids(r.lights.switches)).toEqual(['s1', 's2']);
		expect(r.tabs.find((t) => t.id === 'switches')).toBeUndefined();
		expect(r.tabs[0]).toMatchObject({ id: 'lights', count: 5 });
	});

	it('gives switches a tab when they would crowd Lights', () => {
		const many = Array.from({ length: 9 }, (_, i) => dev(`s${i}`, 'switch'));
		const r = consoleRoom([...lamps, ...many]);
		expect(r.lights.switches).toEqual([]);
		expect(r.byTab.switches).toHaveLength(9);
		expect(r.tabs.map((t) => t.id)).toEqual(['lights', 'switches']);
	});

	it('lays Lights out tight, then gives switches a tab, as the width runs short', () => {
		const wide = { columns: lightColumns(lamps, [], []).columns, keypads: [], scenes: [] };
		expect(layOut(wide, 2)).toEqual({ tight: false, crowd: false });
		expect(layOut(wide, 2, 750)).toEqual({ tight: true, crowd: false });
		expect(layOut(wide, 2, 600)).toEqual({ tight: true, crowd: true });
		expect(layOut(wide, 0, 10)).toEqual({ tight: true, crowd: false });
	});

	it('puts every device in one tab only', () => {
		const all = [
			...lamps,
			hue('s', 'scene', { group_rid: 'R' }),
			dev('sw', 'switch'),
			dev('lock', 'lock'),
			dev('leak', 'water_sensor'),
			dev('t', 'thermostat')
		];
		const r = consoleRoom(all);
		const seen = Object.values(r.byTab)
			.flat()
			.map((d) => d.device_id);
		expect(new Set(seen).size).toBe(seen.length);
		expect(seen.sort()).toEqual(ids(all).sort());
	});

	it('remembers the tab asked for, when the room has it', () => {
		const r = consoleRoom([...lamps, dev('tv', 'media_player')]);
		expect(tabOf(r, 'media')).toBe('media');
		expect(tabOf(r, 'water')).toBe('lights');
		expect(tabOf(r, null)).toBe('lights');
		expect(tabOf(consoleRoom([]), 'lights')).toBeUndefined();
	});
});

describe('a light’s level', () => {
	it('is its brightness when on, else nothing', () => {
		expect(levelOf(dev('a', 'light', { on: true, brightness_pct: 79.6 }))).toBe(80);
		expect(levelOf(dev('a', 'light', { on: false, brightness_pct: 50 }))).toBe(0);
		expect(levelOf(dev('a', 'light', { on: true }))).toBe(100);
		expect(levelOf(dev('a', 'light', { on: false }), { on: true, brightness_pct: 30 })).toBe(30);
	});

	it('turns a fader into a command', () => {
		expect(levelWant(0)).toEqual({ on: false });
		expect(levelWant(40)).toEqual({ on: true, brightness_pct: 40 });
	});

	it('drops the room’s name from a device’s', () => {
		expect(shortName('Family Room  Floor Lamp', 'Family Room')).toBe('Floor Lamp');
		expect(shortName('Office ceiling 1', 'Office')).toBe('Ceiling 1');
		expect(shortName('Living Room', 'Living Room')).toBe('Living Room');
		expect(shortName('Officer lamp', 'Office')).toBe('Officer lamp');
		expect(shortName('Desk Lamp', 'Office')).toBe('Desk Lamp');
		expect(shortName('Bathroom 2 Leak Sensor', 'Bathroom')).toBe('Bathroom 2 Leak Sensor');
	});

	it('names a brand from its plugin', () => {
		expect(brandOf('plugin.hue')).toBe('Hue');
		expect(brandOf(undefined)).toBe('Other');
		expect(brandOf('plugin.yolink')).toBe('YoLink');
	});
});
