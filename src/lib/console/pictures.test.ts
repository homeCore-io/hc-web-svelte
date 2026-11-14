import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import {
	anyLit,
	glowOf,
	isLamp,
	op,
	pictureOf,
	PICTURES,
	roomLights,
	roomPicture,
	shade,
	spotsOf
} from './pictures.js';

const dev = (
	id: string,
	type: string,
	name: string,
	attributes: Record<string, unknown> = {},
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes,
	...more
});
const lamp = (id: string, name: string, on = false, more: Record<string, unknown> = {}) =>
	dev(id, 'light', name, { on, ...more });
const ids = (m: Map<string, CoreDevice[]>) =>
	Object.fromEntries([...m].map(([k, v]) => [k, v.map((d) => d.device_id)]));

describe('pictureOf', () => {
	it('gives the four boards’ rooms their own drawings', () => {
		expect(pictureOf('Family Room')).toBe('family');
		expect(pictureOf('Living Room')).toBe('living');
		expect(pictureOf('Office')).toBe('office');
		expect(pictureOf('Garage')).toBe('garage');
	});

	it('gives other rooms the drawing of their type, from their name', () => {
		expect(pictureOf('Master Bedroom')).toBe('bedroom');
		expect(pictureOf('Bedroom 3')).toBe('bedroom');
		expect(pictureOf('Bathroom 2')).toBe('bathroom');
		expect(pictureOf('Hallway')).toBe('hallway');
		expect(pictureOf('Laundry Room')).toBe('laundry');
		expect(pictureOf('Dining Room')).toBe('dining');
		expect(pictureOf('Attic')).toBe('attic');
		expect(pictureOf('Equipment Room')).toBe('equipment');
		expect(pictureOf('Kitchen')).toBe('kitchen');
		expect(pictureOf('Outdoor')).toBe('outside');
		expect(pictureOf('Outside')).toBe('outside');
		expect(pictureOf('Porch')).toBe('outside');
	});

	it('falls back to a plain drawing', () => {
		expect(pictureOf('Downstairs')).toBe('plain');
		expect(pictureOf('')).toBe('plain');
	});

	it('names every drawing’s spots uniquely, and mirrors only spots it has', () => {
		for (const p of Object.values(PICTURES)) {
			const spots = p.spots.map((s) => s.id);
			expect(new Set(spots).size).toBe(spots.length);
			for (const s of p.spots) if (s.mirror) expect(spots).toContain(s.mirror);
		}
	});
});

describe('spotsOf', () => {
	it('matches the Family Room’s lights to its spots by name', () => {
		const list = [
			lamp('a', 'Desk Lamp'),
			lamp('b', 'Family Room  Floor Lamp'),
			lamp('c', 'Family Room Small Lamp'),
			lamp('d', 'Family Room Overhead'),
			dev('e', 'switch', 'Holiday Lights', { on: true }),
			dev('f', 'fan', 'Ceiling Fan', { on: false }),
			dev('g', 'thermostat', 'Family Room')
		];
		expect(ids(spotsOf('family', list, 'Family Room'))).toEqual({
			desk: ['a'],
			floor: ['b'],
			small: ['c'],
			over: ['d'],
			hol: ['e'],
			fan: ['f']
		});
	});

	it('gives a light no spot is named for a dark spot, else the first', () => {
		const list = [lamp('a', 'Reading Light'), lamp('b', 'Globe'), lamp('c', 'Vanity')];
		expect(ids(spotsOf('bathroom', list, 'Bathroom'))).toEqual({
			vanity: ['c', 'a'],
			ceil: ['b']
		});
	});

	it('picks the spot with the same number', () => {
		const list = [lamp('a', 'Hall Ceiling 2'), lamp('b', 'Hall Ceiling 3')];
		expect(ids(spotsOf('hallway', list, 'Hallway'))).toEqual({ c2: ['a'], c3: ['b'] });
	});

	it('lets one overhead light every spot that mirrors it', () => {
		expect(ids(spotsOf('hallway', [lamp('a', 'Overhead')], 'Hallway'))).toEqual({
			c1: ['a'],
			c2: ['a'],
			c3: ['a']
		});
		expect(ids(spotsOf('kitchen', [lamp('k', 'Kitchen Overhead')], 'Kitchen'))).toEqual({
			p1: ['k'],
			p2: ['k']
		});
	});

	it('takes switches by their names only', () => {
		const list = [
			dev('z3', 'switch', 'Zone 03'),
			dev('o', 'switch', 'Garage Overhead Light'),
			dev('gd', 'switch', 'Garage Door'),
			dev('h', 'switch', 'Garage Heater'),
			dev('oh1', 'contact_sensor', 'Garage OH1 Door Sensor', { open: false }),
			dev('oh2', 'contact_sensor', 'Garage OH2 Door Sensor', { open: true }),
			dev('deck', 'contact_sensor', 'Garage Deck Door Sensor', { open: false })
		];
		expect(ids(spotsOf('garage', list, 'Garage'))).toEqual({
			zone: ['z3'],
			ceil: ['o'],
			heat: ['h'],
			oh1: ['oh1'],
			oh2: ['oh2']
		});
	});

	it('leaves outdoor and holiday lights out of an indoor drawing', () => {
		const list = [
			lamp('o', 'Bedroom 3 Overhead'),
			dev('d', 'switch', 'Bedroom 3 Deck Light', { on: true }),
			dev('h', 'switch', 'Holiday Lights', { on: true })
		];
		expect(ids(spotsOf('bedroom', list, 'Bedroom 3'))).toEqual({ fan: ['o'] });
	});

	it('lights the outside from its deck, flood and string lights, the rest by the porch', () => {
		const list = [
			dev('a', 'switch', 'Deck Front Light'),
			dev('b', 'switch', 'Deck Flood Light'),
			dev('c', 'switch', 'Family Room Deck Light'),
			dev('d', 'switch', 'String Lights')
		];
		expect(ids(spotsOf('outside', list, 'Outside'))).toEqual({
			porch: ['a', 'c'],
			flood: ['b'],
			path: ['d']
		});
	});

	it('shows the TV, the door and the lock in the Living Room', () => {
		const list = [
			dev('tv', 'media_player', '65" TCL Roku TV', {}, { plugin_id: 'plugin.roku' }),
			dev('son', 'media_player', 'Living Room', {}, { plugin_id: 'plugin.sonos' }),
			dev('door', 'contact_sensor', 'Living Room Door Sensor'),
			dev('lock', 'lock', 'Front Door Lock')
		];
		expect(ids(spotsOf('living', list, 'Living Room'))).toEqual({
			tv: ['tv'],
			door: ['door'],
			lock: ['lock']
		});
	});
});

describe('glowOf', () => {
	it('glows each spot at its brightest light’s level', () => {
		const list = [
			lamp('a', 'Vanity', true, { brightness_pct: 40 }),
			lamp('b', 'Mirror', true, { brightness_pct: 80 }),
			lamp('c', 'Ceiling', false)
		];
		const spots = spotsOf('bathroom', list, 'Bathroom');
		expect(glowOf('bathroom', spots, 0)).toEqual({ vanity: 0.8, ceil: 0 });
	});

	it('follows commands on their way, and shows an offline light dark', () => {
		const list = [lamp('a', 'Ceiling', false), lamp('b', 'Vanity', true, {}), lamp('x', 'Lamp')];
		list[1] = { ...list[1]!, available: false };
		const spots = spotsOf('bathroom', list.slice(0, 2), 'Bathroom');
		expect(
			glowOf('bathroom', spots, 0, (id) =>
				id === 'a' ? { on: true, brightness_pct: 50 } : undefined
			)
		).toEqual({
			ceil: 0.5,
			vanity: 0
		});
	});

	it('shows a screen on, a door open, a lock locked and a heater running', () => {
		const living = [
			dev('tv', 'tv', 'TV', { on: true }),
			dev('door', 'contact_sensor', 'Door', { open: true }),
			dev(
				'lock',
				'lock',
				'Lock',
				{ locked: false },
				{
					schema: { attributes: { locked: { kind: 'bool', writable: true } } }
				}
			)
		];
		const g = glowOf('living', spotsOf('living', living, 'Living Room'), 0);
		expect(g).toMatchObject({ tv: 1, door: 1, lock: 0 });
		const garage = [dev('t', 'thermostat', 'Heater Thermostat', { hvac_action: 'heating' })];
		expect(glowOf('garage', spotsOf('garage', garage, 'Garage'), 0)).toEqual({ heat: 1 });
	});

	it('says whether any light is on', () => {
		expect(anyLit('bathroom', { vanity: 0, ceil: 0 })).toBe(false);
		expect(anyLit('bathroom', { ceil: 0.2 })).toBe(true);
		expect(anyLit('living', { tv: 1 })).toBe(false);
	});
});

describe('the drawings’ helpers', () => {
	it('shows a dim light, and nothing when off', () => {
		expect(op(undefined)).toBe(0);
		expect(op(0)).toBe(0);
		expect(op(0.1)).toBeCloseTo(0.37);
		expect(op(1)).toBe(1);
		expect(shade(1)).toBe('#fff1d6');
		expect(shade(0)).toBe('#4a4f5c');
	});
});

describe('isLamp', () => {
	it('takes lights, and switches named as lights', () => {
		expect(isLamp(dev('a', 'light', 'Overhead'))).toBe(true);
		expect(isLamp(dev('b', 'switch', 'Deck Flood Light'))).toBe(true);
		expect(isLamp(dev('c', 'switch', 'Holiday Lights'))).toBe(true);
		expect(isLamp(dev('d', 'switch', 'Garage Door'))).toBe(false);
		expect(isLamp(dev('e', 'switch', 'Zone 03'))).toBe(false);
		expect(isLamp(dev('f', 'switch', 'Zone 03', {}, { ui_hint: 'light' }))).toBe(true);
	});

	it('takes homeCore’s virtual switches for switches, whatever they’re called', () => {
		const glue = { plugin_id: 'core.glue' };
		expect(isLamp(dev('a', 'switch', 'Porch Light', {}, glue))).toBe(false);
		expect(isLamp(dev('b', 'group', 'Garage Lights', { on: true }, glue))).toBe(false);
	});
});

describe('roomPicture', () => {
	it('picks the drawing, lights it, and counts what it lights by name as lights', () => {
		const list = [
			dev('z', 'switch', 'Zone 03', { on: true }),
			dev('g', 'switch', 'Garage Door', { on: false }),
			dev('d', 'contact_sensor', 'Garage OH1 Door Sensor', { open: false })
		];
		const p = roomPicture('Garage', list, 0);
		expect(p.picture).toBe('garage');
		expect(p.g).toEqual({ zone: 1, oh1: 0 });
		expect(p.lamps.map((x) => x.device_id)).toEqual(['z']);
	});

	it('neither lights nor counts a virtual switch named as a light', () => {
		const list = [
			dev('p', 'switch', 'Porch Light', { on: true }, { plugin_id: 'core.glue' }),
			dev('z', 'switch', 'Zone 03', { on: true }, { plugin_id: 'core.glue' })
		];
		const p = roomPicture('Garage', list, 0);
		expect(p.g).toEqual({});
		expect(p.lamps).toEqual([]);
	});
});

describe('the household’s own fixes to a drawing’s spots', () => {
	const room = 'Family Room';
	const list = [
		lamp('floor', 'Family Room Floor Lamp'),
		lamp('desk', 'Family Room Desk Lamp'),
		lamp('over', 'Family Room Overhead')
	];

	it('shows the device chosen for a spot there alone', () => {
		const m = spotsOf('family', list, room, { small: 'desk' });
		expect(ids(m)).toEqual({ floor: ['floor'], small: ['desk'], over: ['over'] });
	});

	it('leaves a spot fixed to none dark', () => {
		expect(ids(spotsOf('family', list, room, { over: '' }))).toEqual({
			floor: ['floor'],
			desk: ['desk']
		});
	});

	it('keeps a fixed spot from its twin, and a twin from a spot fixed to none', () => {
		const hall = [lamp('a', 'Hallway Overhead')];
		expect(ids(spotsOf('hallway', hall, 'Hallway', { c2: '' }))).toEqual({
			c1: ['a'],
			c3: ['a']
		});
	});

	it('ignores a device the room no longer has', () => {
		expect(ids(spotsOf('family', list, room, { small: 'gone' }))).toEqual({
			floor: ['floor'],
			desk: ['desk'],
			over: ['over']
		});
	});
});

describe('roomLights', () => {
	const sw = (id: string, name: string, more: Partial<CoreDevice> = {}) =>
		dev(id, 'switch', name, { on: true }, more);
	it('takes the Garage’s zones by its drawing, never its heater or a camera’s spotlight', () => {
		const camera = dev('cam', 'camera', 'Driveway');
		const list = [
			sw('z3', 'Zone 03'),
			sw('z4', 'Zone 04'),
			sw('over', 'Garage Overhead Light'),
			sw('heat', 'Garage Heater'),
			sw('door', 'Garage Door', { plugin_id: 'core.glue' }),
			lamp('cam_spotlight', 'Driveway spotlight', true),
			camera
		];
		expect(
			roomLights('Garage', list)
				.map((d) => d.device_id)
				.sort()
		).toEqual(['over', 'z3', 'z4']);
	});

	it('takes what the household put on the Lights tab, but not a scene or a keypad', () => {
		const list = [sw('ac', 'Outlet - Office AC'), dev('scene', 'scene', 'Bright', {})];
		expect(roomLights('Office', list).map((d) => d.device_id)).toEqual([]);
		expect(
			roomLights('Office', list, list, { chosen: { ac: 'lights', scene: 'lights' } }).map(
				(d) => d.device_id
			)
		).toEqual(['ac']);
	});

	it('takes a switch the household linked to a light in the drawing', () => {
		const list = [sw('plug', 'Spare Plug')];
		expect(roomLights('Office', list)).toEqual([]);
		expect(
			roomLights('Office', list, list, { links: { dl: 'plug' } }).map((d) => d.device_id)
		).toEqual(['plug']);
	});
});
