import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import { op, PICTURES, spotsOf } from './pictures.js';
import {
	coverFrame,
	focusOf,
	GLOW_COLOR,
	kindFor,
	nudgeSpot,
	photoGlow,
	photoLit,
	photoSpots,
	seedSpots,
	SPOT_AT
} from './photo.js';

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

describe('where the drawings’ spots sit', () => {
	it('places every spot of every drawing on it', () => {
		for (const p of Object.values(PICTURES))
			for (const s of p.spots) {
				const at = SPOT_AT[p.id][s.id];
				expect(at, `${p.id}.${s.id}`).toBeDefined();
				expect(at![0]).toBeGreaterThanOrEqual(0);
				expect(at![0]).toBeLessThanOrEqual(100);
				expect(at![1]).toBeGreaterThanOrEqual(0);
				expect(at![1]).toBeLessThanOrEqual(100);
			}
	});
});

describe('a photo’s first spots, from the drawing', () => {
	const room = 'Family Room';
	const list = [
		lamp('floor', 'Family Room Floor Lamp', true),
		lamp('over', 'Family Room Overhead', false),
		dev('door', 'contact_sensor', 'Family Room Door')
	];

	it('makes one for each spot that shows a device, where it sits in the drawing', () => {
		const spots = seedSpots('family', spotsOf('family', list, room));
		expect(spots).toEqual([
			{ x: 70, y: 16, device: 'over', size: 'l' },
			{ x: 47.8, y: 18, device: 'floor' }
		]);
	});

	it('puts several devices on one spot side by side', () => {
		const two = [lamp('a', 'Hallway Overhead 1'), lamp('b', 'Hallway Light')];
		const spots = seedSpots('plain', new Map([['ceil', two]]));
		expect(spots.map((s) => [s.x, s.device])).toEqual([
			[62, 'a'],
			[66, 'b']
		]);
	});

	it('gives a room with nothing to show one spot to place', () => {
		expect(seedSpots('kitchen', new Map())).toEqual([{ x: 38, y: 45 }]);
	});

	it('follows the household’s own fixes to the drawing', () => {
		const fixed = seedSpots('family', spotsOf('family', list, room, { over: '', desk: 'floor' }));
		expect(fixed).toEqual([{ x: 97, y: 44, device: 'floor' }]);
	});

	it('uses the household’s spots once it has any, even none', () => {
		const map = spotsOf('family', list, room);
		expect(photoSpots([], 'family', map)).toEqual([]);
		expect(photoSpots([{ x: 1, y: 2 }], 'family', map)).toEqual([{ x: 1, y: 2 }]);
		expect(photoSpots(undefined, 'family', map)).toHaveLength(2);
	});
});

describe('how a photo is lit', () => {
	const byId = {
		lamp: lamp('lamp', 'Lamp', true, { brightness_pct: 40 }),
		off: lamp('off', 'Other lamp', false),
		tv: dev('tv', 'tv', 'TV', { on: true }),
		gone: dev('gone', 'light', 'Gone', { on: true }, { available: false })
	} as Record<string, CoreDevice>;

	it('glows as the drawings do: a light’s level, dark when off', () => {
		const g = photoGlow(
			[
				{ x: 10, y: 20, device: 'lamp', size: 'l' },
				{ x: 30, y: 40, device: 'off' },
				{ x: 50, y: 50 },
				{ x: 60, y: 60, device: 'nobody' },
				{ x: 70, y: 70, device: 'gone', size: 's' }
			],
			byId,
			0
		);
		expect(g[0]).toMatchObject({ x: 10, y: 20, scale: 1.6, opacity: op(0.4), lit: true });
		expect(g[0]!.color).toBe(GLOW_COLOR.light);
		expect(g.slice(1).map((s) => s.opacity)).toEqual([0, 0, 0, 0]);
		expect(g[4]!.scale).toBe(0.6);
		expect(photoLit(g)).toBe(true);
		expect(photoLit(g.slice(1))).toBe(false);
	});

	it('takes a command on its way', () => {
		const g = photoGlow([{ x: 1, y: 1, device: 'off' }], byId, 0, (id) =>
			id === 'off' ? { on: true, brightness_pct: 100 } : undefined
		);
		expect(g[0]!.opacity).toBe(1);
	});

	it('knows what each device shows as', () => {
		expect(kindFor(byId.lamp!)).toBe('light');
		expect(kindFor(dev('s', 'switch', 'Plug'))).toBe('light');
		expect(kindFor(dev('f', 'fan', 'Fan'))).toBe('fan');
		expect(kindFor(dev('d', 'contact_sensor', 'Door'))).toBe('door');
		expect(kindFor(dev('l', 'lock', 'Lock'))).toBe('lock');
		expect(kindFor(dev('t', 'thermostat', 'Heat'))).toBe('heat');
		expect(kindFor(dev('m', 'motion_sensor', 'Motion'))).toBeUndefined();
	});
});

describe('moving a spot', () => {
	it('moves by the arrow keys and stays on the photo', () => {
		expect(nudgeSpot({ x: 50, y: 1, device: 'a' }, 1, -5)).toEqual({ x: 51, y: 0, device: 'a' });
		expect(nudgeSpot({ x: 99.5, y: 3 }, 1, 0.1)).toEqual({ x: 100, y: 3.1 });
	});
});

describe('a photo covering a box', () => {
	it('fills it, cut to fit, around the part kept in view', () => {
		// A wide photo in a wider, shorter header: cut top and bottom.
		expect(coverFrame({ w: 1000, h: 200 }, { w: 1600, h: 900 })).toEqual({
			left: 0,
			top: -181.25,
			width: 1000,
			height: 562.5
		});
		// Kept to its top.
		expect(coverFrame({ w: 1000, h: 200 }, { w: 1600, h: 900 }, 1).top).toBe(0);
		// A tall tile: cut either side, kept to the right.
		const tile = coverFrame({ w: 300, h: 300 }, { w: 1600, h: 900 }, 5);
		expect(tile.left).toBeCloseTo(-233.33);
		expect(tile.width).toBeCloseTo(533.33);
		expect([tile.top, tile.height]).toEqual([0, 300]);
	});

	it('is the box itself until the photo’s size is known', () => {
		expect(coverFrame({ w: 400, h: 100 }, { w: 0, h: 0 })).toEqual({
			left: 0,
			top: 0,
			width: 400,
			height: 100
		});
	});

	it('reads the picker’s focus, the middle for anything else', () => {
		expect(focusOf(0)).toEqual([0, 0]);
		expect(focusOf(8)).toEqual([1, 1]);
		expect(focusOf(7)).toEqual([0.5, 1]);
		expect(focusOf(42)).toEqual([0.5, 0.5]);
		expect(focusOf()).toEqual([0.5, 0.5]);
	});
});
