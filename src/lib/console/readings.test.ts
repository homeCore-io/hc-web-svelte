import { describe, expect, it } from 'vitest';
import type { CoreDevice, Schema } from '../devices.js';
import type { Units } from '../units.js';
import { between, readingOf, sensorsTab } from './sensors.js';
import { valveOpen, valveWant, waterTab, wet } from './water.js';

const F: Units = { temperature: 'F', measures: 'us' };
const C: Units = { temperature: 'C', measures: 'metric' };

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	schema?: Schema
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	available: true,
	attributes,
	...(schema ? { schema } : {})
});
const ids = (list: { device_id: string }[]) => list.map((d) => d.device_id);
const celsius: Schema = {
	attributes: {
		temperature: { kind: 'float', unit: '°C' },
		temp_limit_low: { kind: 'float', unit: '°C' },
		temp_limit_high: { kind: 'float', unit: '°C' }
	}
};

describe('the Sensors tab', () => {
	it('reads a temperature in the person’s units, with its limits', () => {
		const freezer = dev(
			'freezer',
			'temperature_sensor',
			{ temperature: -15, temp_limit_low: -20, temp_limit_high: -5, too_cold: false },
			celsius
		);
		const r = readingOf(freezer, F)!;
		expect(r.temp).toBeCloseTo(5);
		expect(r.low).toBeCloseTo(-4);
		expect(r.high).toBeCloseTo(23);
		expect(r.state).toBe('ok');
		expect(between(r)).toBeCloseTo(1 / 3);
		expect(readingOf(freezer, C)!.temp).toBe(-15);
	});

	it('says when a reading is past its limit, and takes °C when no unit is given', () => {
		const r = readingOf(dev('t', 'temperature_sensor', { temperature: 40, too_warm: true }), F)!;
		expect(r.temp).toBeCloseTo(104);
		expect(r.state).toBe('warm');
		expect(between(r)).toBeUndefined();
	});

	it('reads humidity alone', () => {
		expect(readingOf(dev('h', 'humidity_sensor', { humidity: 55 }), C)).toMatchObject({
			humidity: 55
		});
	});

	it('keeps sensors that notice things in the watched list, even with a temperature', () => {
		const tab = sensorsTab(
			[
				dev('temp', 'temperature_sensor', { temperature: 20 }),
				dev('motion', 'motion_sensor', { motion: false, temperature: 21 }),
				dev('trap', 'vibration_sensor', { vibration: false })
			],
			C
		);
		expect(ids(tab.readings.map((r) => r.device))).toEqual(['temp']);
		expect(ids(tab.watch)).toEqual(['motion', 'trap']);
	});
});

describe('the Water tab', () => {
	it('sorts leak sensors from valves', () => {
		const tab = waterTab([dev('leak', 'water_sensor'), dev('Water Valve', 'switch')]);
		expect(ids(tab.leaks)).toEqual(['leak']);
		expect(ids(tab.valves)).toEqual(['Water Valve']);
		expect(tab.other).toEqual([]);
	});

	it('keeps what was put here that is no valve apart', () => {
		const virtual = { ...dev('Water Valve', 'switch'), plugin_id: 'core.glue' };
		const tab = waterTab([dev('Pump', 'switch'), virtual, dev('Garden', 'sprinkler')]);
		expect(ids(tab.valves)).toEqual(['Garden']);
		expect(ids(tab.other)).toEqual(['Pump', 'Water Valve']);
	});

	it('knows a wet sensor', () => {
		expect(wet(dev('l', 'water_sensor', { water_detected: true }))).toBe(true);
		expect(wet(dev('l', 'water_sensor', { water_detected: false }))).toBe(false);
	});

	it('reads a valve by its own open, else a relay that is on to shut it, and a command on its way', () => {
		const sw = dev('v', 'switch', { on: false });
		expect(valveOpen(sw)).toBe(true);
		expect(valveOpen(sw, { on: true })).toBe(false);
		expect(valveWant(sw, false)).toEqual({ on: true });
		expect(valveWant(sw, true)).toEqual({ on: false });
		const valve = dev('v', 'valve', { open: false });
		expect(valveOpen(valve)).toBe(false);
		expect(valveWant(valve, true)).toEqual({ open: true });
	});
});
