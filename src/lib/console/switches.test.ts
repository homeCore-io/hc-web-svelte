import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import {
	drawOf,
	flips,
	partsOf,
	PER_COL,
	setsWithSwitches,
	setTitle,
	switchCols
} from './switches.js';

const sw = (name: string, plugin: string, attributes: Record<string, unknown> = { on: false }) =>
	({
		device_id: `${plugin}_${name}`,
		name,
		device_type: 'switch',
		plugin_id: plugin,
		available: true,
		attributes
	}) as CoreDevice;

const shape = (list: CoreDevice[]) =>
	switchCols(list).map((c) => [c.title, c.together, c.devices.map((d) => d.name)]);

describe('the Switches tab', () => {
	it('puts a numbered set in its own column, and the rest by system', () => {
		expect(
			shape([
				sw('Holiday Lights 2', 'plugin.lutron'),
				sw('Holiday Lights 1', 'plugin.lutron'),
				sw('Front', 'plugin.lutron'),
				sw('Plug Power Meter', 'plugin.yolink', { on: true, power: 3.71 })
			])
		).toEqual([
			['Holiday Lights', true, ['Holiday Lights 1', 'Holiday Lights 2']],
			['Switches', false, ['Front']],
			['Plug', false, ['Plug Power Meter']]
		]);
	});

	it('leaves a lone numbered switch with the others', () => {
		expect(shape([sw('Lamp 1', 'p'), sw('Fan', 'p')])).toEqual([
			['Switches', false, ['Fan', 'Lamp 1']]
		]);
	});

	it('goes on in another column past the most a column holds', () => {
		const many = Array.from({ length: PER_COL + 2 }, (_, i) =>
			sw(`Thing ${String.fromCharCode(65 + i)}`, 'p')
		);
		const cols = switchCols(many);
		expect(cols.map((c) => [c.title, c.devices.length])).toEqual([
			['Switches', PER_COL],
			['Switches, more', 2]
		]);
	});

	it('says what a plug draws, and which switches can be flipped', () => {
		expect(drawOf(sw('a', 'p', { power: 3.71 }))).toBe('3.7 W');
		expect(drawOf(sw('a', 'p', { power: 1234.4 }))).toBe('1234 W');
		expect(drawOf(sw('a', 'p'))).toBeUndefined();
		expect(flips(sw('a', 'p'))).toBe(true);
		expect(flips(sw('a', 'p', { remaining: 30 }))).toBe(false);
	});
});

describe('switches and timers together', () => {
	const timer = (name: string) =>
		({ ...sw(name, 'core.glue', { state: 'idle' }), device_type: 'timer' }) as CoreDevice;
	const button = { ...sw('Doorbell', 'p', {}), device_type: 'button' } as CoreDevice;

	it('sorts switches, timers and the rest', () => {
		const p = partsOf([sw('Fan', 'p'), timer('Close'), button]);
		expect(p.switches.map((d) => d.name)).toEqual(['Fan']);
		expect(p.timers.map((d) => d.name)).toEqual(['Close']);
		expect(p.others.map((d) => d.name)).toEqual(['Doorbell']);
	});

	it('heads a set by what is in it', () => {
		expect(setTitle([sw('a', 'p'), sw('b', 'p')])).toBe('Switches');
		expect(setTitle([timer('a')])).toBe('Timer');
		expect(setTitle([sw('a', 'p'), timer('b')])).toBe('Switches and timers');
		expect(setTitle([sw('a', 'p'), button])).toBe('Also here');
	});

	it('titles a system’s column of timers as timers', () => {
		expect(shape([timer('Close'), timer('Lights')])).toEqual([
			['Timers', false, ['Close', 'Lights']]
		]);
	});

	it('takes a switch or a timer to sit with the switches on another tab, and no sensor', () => {
		expect(setsWithSwitches(sw('a', 'p'))).toBe(true);
		expect(setsWithSwitches(timer('t'))).toBe(true);
		const motion = { ...sw('m', 'p', { on: true }), device_type: 'motion_sensor' } as CoreDevice;
		expect(setsWithSwitches(motion)).toBe(false);
	});
});
