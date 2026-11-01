import { describe, expect, it } from 'vitest';
import { deviceDescriptor, deviceKind, typeWords } from './deviceOptions.js';
import { HOUSE } from './fixtures/house.js';
import type { CoreDevice } from './devices.js';

const byId = (id: string): CoreDevice => {
	const d = HOUSE.find((x) => x.device_id === id);
	if (!d) throw new Error(id);
	return d;
};
const keys = (id: string, o = {}) =>
	deviceDescriptor(byId(id), o).sections.flatMap((s) => s.fields.map((f) => f.key ?? f.kind));

describe("a device card's sheet (G23–G26)", () => {
	it('a light: what it says, its two sliders on Large, tapping, a symbol', () => {
		expect(keys('hue_lamp')).toEqual(
			expect.arrayContaining([
				'main',
				'last',
				'extra_brightness_pct',
				'extra_color_temp',
				'tap',
				'symbol'
			])
		);
	});

	it('a sensor has nothing to switch, so no tapping', () => {
		const k = keys('hue_motion');
		expect(k).not.toContain('tap');
		expect(k).toEqual(expect.arrayContaining(['show_temperature', 'show_illuminance']));
	});

	it('a lock locks or unlocks when the whole card is tapped', () => {
		const tap = deviceDescriptor(byId('yolink_front_lock'))
			.sections.flatMap((s) => s.fields)
			.find((f) => f.key === 'tap');
		expect(tap?.options?.map((o) => o.label)).toEqual(['Opens its page', 'Locks or unlocks it']);
	});

	it('size where it has sizes; Large extras only where it can be Large', () => {
		expect(
			keys('hue_lamp', { forms: { all: ['compact', 'standard', 'large'], now: 'standard' } })[0]
		).toBe('size');
		expect(
			keys('hue_lamp', { forms: { all: ['compact', 'standard'], now: 'standard' } })
		).not.toContain('extra_brightness_pct');
	});

	it('a plugin-drawn card offers its size only', () => {
		expect(
			keys('hue_lamp', {
				pluginDrawn: true,
				forms: { all: ['standard', 'large'], now: 'standard' }
			})
		).toEqual(['size', 'note']);
	});

	it('every card of a type: no symbol', () => {
		expect(keys('hue_lamp', { everyCard: true })).not.toContain('symbol');
	});

	it('keeps defaults per device type', () => {
		expect(deviceKind(byId('hue_lamp'))).toBe('device:light');
		expect(typeWords(byId('hue_motion'))).toBe('motion sensor');
	});
});
