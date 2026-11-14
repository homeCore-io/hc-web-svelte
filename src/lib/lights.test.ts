import { describe, expect, it } from 'vitest';
import type { CoreDevice } from './devices.js';
import { isLamp, isLit, lightsCount, powersNamed, whereLit } from './lights.js';

const dev = (
	id: string,
	type: string,
	name: string,
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: id,
	name,
	device_type: type,
	plugin_id: 'plugin.test',
	available: true,
	attributes: { on: true },
	...more
});

describe('a light', () => {
	it('is a light, a dimmer, or a switch named as one', () => {
		expect(isLamp(dev('a', 'light', 'Overhead'))).toBe(true);
		expect(isLamp(dev('b', 'dimmer', 'Kitchen'))).toBe(true);
		expect(isLamp(dev('c', 'switch', 'Holiday Lights 1'))).toBe(true);
		expect(isLamp(dev('d', 'switch', 'Zone 03', { ui_hint: 'light' }))).toBe(true);
	});

	it('is never an AC outlet, a fan, a power meter or a virtual switch', () => {
		expect(isLamp(dev('a', 'switch', 'Outlet - Living Room AC'))).toBe(false);
		expect(isLamp(dev('b', 'switch', 'Bathroom Exhaust Fan'))).toBe(false);
		expect(isLamp(dev('c', 'switch', 'YoLink Plug Power Meter'))).toBe(false);
		expect(isLamp(dev('d', 'switch', 'Porch Light', { plugin_id: 'core.glue' }))).toBe(false);
	});

	it('knows a name that powers something else', () => {
		for (const n of [
			'Garage Heater',
			'Outlet - MBR AC',
			'Exhaust Fan',
			'Spare Plug',
			'Water Valve'
		])
			expect(powersNamed(n)).toBe(true);
		for (const n of ['Zone 03', 'Overhead', 'Stair Light']) expect(powersNamed(n)).toBe(false);
	});

	it('is on only while it answers', () => {
		expect(isLit(dev('a', 'light', 'A'))).toBe(true);
		expect(isLit(dev('a', 'light', 'A', { available: false }))).toBe(false);
		expect(isLit(dev('a', 'light', 'A'), { a: { want: { on: false } } })).toBe(false);
	});
});

describe('the lights on', () => {
	const room = { id: 'r' };
	it('counts rooms, never No room, and the lights in no room apart', () => {
		const c = lightsCount([
			{ room, lights: [dev('a', 'light', 'A'), dev('b', 'light', 'B')] },
			{ room: { id: 's' }, lights: [dev('c', 'light', 'C', { attributes: { on: false } })] },
			{ lights: [dev('d', 'light', 'D')] }
		]);
		expect(c).toEqual({ on: 3, all: 4, rooms: 1, loose: 1 });
		expect(whereLit(c)).toBe('in 1 room and 1 with no room');
		expect(whereLit({ rooms: 10, loose: 0 })).toBe('in 10 rooms');
		expect(whereLit({ rooms: 0, loose: 2 })).toBe('with no room');
	});
});
