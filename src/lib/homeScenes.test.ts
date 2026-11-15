import { describe, expect, it } from 'vitest';
import {
	homeSceneRefs,
	homeScenesOf,
	isHueScene,
	sceneActive,
	sceneTells,
	withHomeScenes
} from './homeScenes.js';
import type { CoreDevice } from './devices.js';
import type { Room } from './house.js';
import type { HouseDoc, PersonDoc } from './layers.js';

const dev = (id: string, o: Partial<CoreDevice>): CoreDevice => ({
	device_id: id,
	name: id,
	available: true,
	device_type: 'scene',
	attributes: {},
	...o
});
const rooms: Room[] = [
	{ id: 'family', name: 'Family Room', slug: 'family', aliases: [], deviceIds: [] }
];

describe('homeSceneRefs', () => {
	const house: HouseDoc = { version: 1, home: { scenes: ['device:a', 'scene:b'] } };
	it('is the house’s, unless the person has their own', () => {
		expect(homeSceneRefs(house, { version: 1 })).toEqual({
			refs: ['device:a', 'scene:b'],
			own: false
		});
		const mine: PersonDoc = { version: 1, home: { scenes: ['scene:b'] } };
		expect(homeSceneRefs(house, mine)).toEqual({ refs: ['scene:b'], own: true });
	});
	it('falls back to the house’s when the person’s own is empty', () => {
		expect(homeSceneRefs(house, { version: 1, home: { scenes: [] } }).own).toBe(false);
	});
	it('is empty for a house that chose none, and an older document', () => {
		expect(homeSceneRefs({ version: 3 }, undefined)).toEqual({ refs: [], own: false });
	});
});

describe('withHomeScenes', () => {
	it('sets the row once each, and takes it away', () => {
		const d = withHomeScenes<PersonDoc>({ version: 2, theme: 'dark' }, ['a', 'b', 'a']);
		expect(d).toEqual({ version: 2, theme: 'dark', home: { scenes: ['a', 'b'] } });
		expect(withHomeScenes(d, undefined)).toEqual({ version: 2, theme: 'dark' });
		expect(withHomeScenes(d, [])).toEqual({ version: 2, theme: 'dark' });
	});
});

describe('what a scene can tell', () => {
	const lutron = (on: unknown) =>
		dev('l', { plugin_id: 'plugin.lutron', attributes: on === undefined ? {} : { on } });
	it('Lutron by its LED, Hue by active, others not at all', () => {
		expect(sceneTells(lutron(true))).toBe(true);
		expect(sceneActive(lutron(true))).toBe(true);
		expect(sceneTells(lutron(undefined))).toBe(false);
		const h = dev('h', {
			plugin_id: 'plugin.hue',
			attributes: { kind: 'hue_scene', active: true }
		});
		expect(sceneTells(h) && sceneActive(h)).toBe(true);
		expect(isHueScene(h)).toBe(true);
		const caseta = dev('c', { plugin_id: 'plugin.caseta', attributes: { on: true } });
		expect(sceneTells(caseta)).toBe(false);
	});
});

describe('homeScenesOf', () => {
	const devices = {
		good: dev('good', { name: 'Goodnight', plugin_id: 'plugin.lutron', attributes: { on: true } }),
		wel: dev('wel', { name: 'Welcome', plugin_id: 'plugin.lutron', attributes: { on: false } }),
		movie: dev('movie', {
			name: 'Movie Night',
			plugin_id: 'plugin.hue',
			area: 'family',
			attributes: { kind: 'hue_scene', active: false }
		}),
		lamp: dev('lamp', { device_type: 'light' })
	};
	const scenes = [{ id: 'eve', name: 'Evening' }];
	it('keeps the row’s order, says Active, a room or who provides it, and skips what is gone', () => {
		const row = homeScenesOf(
			['scene:eve', 'device:good', 'device:gone', 'device:lamp', 'device:wel', 'device:movie'],
			devices,
			scenes,
			rooms
		);
		expect(row.map((s) => [s.name, s.sub, s.active])).toEqual([
			['Evening', 'homeCore', false],
			['Goodnight', 'Active', true],
			['Welcome', 'Lutron', false],
			['Movie Night', 'Family Room', false]
		]);
		expect(row[0]!.scene?.id).toBe('eve');
		expect(row[1]!.device?.device_id).toBe('good');
	});
});
