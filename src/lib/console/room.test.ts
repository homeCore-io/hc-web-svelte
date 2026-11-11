import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import type { Room } from '../house.js';
import {
	brandOf,
	consoleRoom,
	devicesIn,
	levelOf,
	levelWant,
	lightColumns,
	placeOf,
	roomSlugOf,
	layOut,
	shortName,
	tabOf
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

	it('shows Doors first where something opens', () => {
		const r = consoleRoom([...lamps, dev('door', 'garage_door'), dev('fan', 'fan')]);
		expect(r.tabs.map((t) => t.id)).toEqual(['doors', 'lights', 'climate']);
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
	});

	it('names a brand from its plugin', () => {
		expect(brandOf('plugin.hue')).toBe('Hue');
		expect(brandOf(undefined)).toBe('Other');
	});
});
