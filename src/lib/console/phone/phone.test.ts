import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '#lib/devices.js';
import {
	PHONE_MAX,
	PHONE_QUERY,
	fadersAcross,
	levelAt,
	phonePageOf,
	pullCloses,
	sectionOf,
	warmthOf,
	whiteAt,
	whiteFor
} from './phone.js';

const lamp = (attributes: Record<string, unknown>, spec?: object): CoreDevice =>
	({
		device_id: 'lamp',
		name: 'Floor Lamp',
		available: true,
		attributes,
		schema: spec ? { attributes: { color_temp: spec } } : undefined
	}) as unknown as CoreDevice;

describe('the phone layout', () => {
	it('is for screens under 700 wide', () => {
		expect(PHONE_MAX).toBe(699);
		expect(PHONE_QUERY).toBe('(max-width: 699px)');
	});

	it('draws Home, the rooms, a room, the Everywhere views and the cameras its own way', () => {
		expect(phonePageOf('/')).toEqual({ kind: 'home' });
		expect(phonePageOf('/rooms')).toEqual({ kind: 'rooms' });
		expect(phonePageOf('/rooms/abc')).toEqual({ kind: 'room', id: 'abc' });
		expect(phonePageOf('/rooms/a%20b')).toEqual({ kind: 'room', id: 'a b' });
		expect(phonePageOf('/everywhere/water')).toEqual({ kind: 'everywhere', view: 'water' });
		expect(phonePageOf('/cameras')).toEqual({ kind: 'cameras' });
	});

	it('leaves the rest as they are: the devices in no room, an unknown view, settings', () => {
		expect(phonePageOf('/rooms/none')).toBeUndefined();
		expect(phonePageOf('/everywhere/garden')).toBeUndefined();
		expect(phonePageOf('/rooms/abc/more')).toBeUndefined();
		expect(phonePageOf('/me')).toBeUndefined();
		expect(phonePageOf('/settings/devices')).toBeUndefined();
	});

	it('lights the section an address belongs to', () => {
		expect(sectionOf('/')).toBe('home');
		expect(sectionOf('/rooms')).toBe('rooms');
		expect(sectionOf('/rooms/none')).toBe('rooms');
		expect(sectionOf('/everywhere/lights')).toBe('everywhere');
		expect(sectionOf('/cameras')).toBe('cameras');
		expect(sectionOf('/me')).toBeUndefined();
		expect(sectionOf('/alerts')).toBeUndefined();
	});
});

describe('faders across a phone', () => {
	it('puts every fader in one row where they fit', () => {
		expect(fadersAcross(4, 358)).toBe(4);
		expect(fadersAcross(5, 358)).toBe(5);
		expect(fadersAcross(1, 358)).toBe(1);
	});

	it('wraps the rest in rows as even as they can be', () => {
		// Five fit across 358; seven are four and three, nine are five and four.
		expect(fadersAcross(7, 358)).toBe(4);
		expect(fadersAcross(9, 358)).toBe(5);
		expect(fadersAcross(10, 358)).toBe(5);
		expect(fadersAcross(6, 343)).toBe(3);
	});

	it('keeps at least one across, however narrow', () => {
		expect(fadersAcross(3, 20)).toBe(1);
		expect(fadersAcross(0, 358)).toBe(1);
	});
});

describe('a bar dragged across', () => {
	it('reads a level from where the finger is', () => {
		expect(levelAt(100, 100, 200)).toBe(0);
		expect(levelAt(200, 100, 200)).toBe(50);
		expect(levelAt(300, 100, 200)).toBe(100);
		expect(levelAt(151, 100, 200)).toBe(26);
	});

	it('stays between 0 and 100 past either end', () => {
		expect(levelAt(20, 100, 200)).toBe(0);
		expect(levelAt(900, 100, 200)).toBe(100);
		expect(levelAt(50, 0, 0)).toBe(0);
	});
});

describe('pulling a sheet down', () => {
	it('closes it past a point, or on a quick flick', () => {
		expect(pullCloses(120)).toBe(true);
		expect(pullCloses(60)).toBe(false);
		expect(pullCloses(60, 1)).toBe(true);
		expect(pullCloses(20, 2)).toBe(false);
	});
});

describe("a lamp's white, warm to cool", () => {
	const spec = { kind: 'color_temp', writable: true, unit: 'K', min: 2000, max: 6500 };

	it('comes from the schema: the attribute and its span, in kelvin', () => {
		expect(warmthOf(lamp({ color_temp: 2700 }, spec))).toEqual({
			attr: 'color_temp',
			warm: 2000,
			cool: 6500,
			now: 2700,
			step: 50
		});
	});

	it('runs the other way in mireds', () => {
		const w = warmthOf(
			lamp(
				{ color_temp: 366 },
				{ kind: 'color_temp', writable: true, unit: 'mired', min: 153, max: 500 }
			)
		);
		expect(w).toMatchObject({ warm: 500, cool: 153, step: 1 });
		expect(whiteAt(w!, 500)).toBe(0);
		expect(whiteAt(w!, 153)).toBe(1);
	});

	it("isn't there for a lamp that can't be set, or says no span", () => {
		expect(warmthOf(lamp({}))).toBeUndefined();
		expect(warmthOf(lamp({}, { ...spec, writable: false }))).toBeUndefined();
		expect(warmthOf(lamp({}, { kind: 'color_temp', writable: true }))).toBeUndefined();
		expect(warmthOf(lamp({}, { ...spec, min: 6500, max: 2000 }))).toBeUndefined();
	});

	it('places a white along the strip, and a place back at the lamp’s steps', () => {
		const w = warmthOf(lamp({ color_temp: 4250 }, spec))!;
		expect(whiteAt(w)).toBe(0.5);
		expect(whiteAt(w, 1000)).toBe(0);
		expect(whiteAt({ ...w, now: undefined })).toBeUndefined();
		expect(whiteFor(w, 0)).toBe(2000);
		expect(whiteFor(w, 1)).toBe(6500);
		expect(whiteFor(w, 0.5)).toBe(4250);
		expect(whiteFor(w, 0.33)).toBe(3500);
		expect(whiteFor(w, 2)).toBe(6500);
	});
});
