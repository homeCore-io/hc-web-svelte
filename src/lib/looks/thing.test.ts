import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import { celsius } from './thing.js';

const device = (unit?: string, sibling?: string): CoreDevice =>
	({
		device_id: 'd',
		name: 'Probe',
		attributes: sibling ? { temperature_unit: sibling } : {},
		schema: { attributes: unit ? { temperature: { type: 'number', unit } } : {} }
	}) as unknown as CoreDevice;

describe('a thing’s readings', () => {
	it('reach a drawing in °C, whatever the device reports in', () => {
		expect(celsius(device('°C'), 21.5)).toBe(21.5);
		expect(celsius(device('°F'), 69.8)).toBeCloseTo(21, 5);
		// A reading kept from an older plugin, labelled by its own unit.
		expect(celsius(device('°C', '°F'), 50)).toBeCloseTo(10, 5);
		expect(celsius(device(), 20)).toBe(20);
		expect(celsius(device('°C'), 'warm')).toBeNull();
	});
});
