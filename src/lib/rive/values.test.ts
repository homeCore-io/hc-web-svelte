import { describe, expect, it } from 'vitest';
import type { Thermostat } from '../thermostat.js';
import { climateValues } from './values.js';

const t: Thermostat = {
	unit: '°F',
	now: 67.4,
	target: 70,
	attr: 'setpoint',
	dual: false,
	doing: 'heating',
	modes: [],
	min: 50,
	max: 90,
	step: 1
};

describe('a Rive drawing’s values', () => {
	it('gives a thermostat’s state, reading, target and scale', () => {
		expect(climateValues(t, undefined, true)).toEqual({
			heating: true,
			cooling: false,
			on: true,
			temperature: 67,
			target: 70,
			low: 50,
			high: 90,
			moving: true,
			unit: '°F'
		});
	});

	it('shows a target being pressed toward, halves in °C, and off', () => {
		const c = { ...t, unit: '°C', now: 20.3, step: 0.5, doing: 'off' as const, min: 5, max: 35 };
		expect(climateValues(c, 21.5, false)).toMatchObject({
			on: false,
			heating: false,
			temperature: 20.5,
			target: 21.5,
			moving: false
		});
	});

	it('aims at the reading when it says no target', () => {
		expect(climateValues({ ...t, target: undefined }, undefined, false).target).toBe(67);
		expect(climateValues({ ...t, target: 54.7 }, undefined, false).target).toBe(55);
	});
});
