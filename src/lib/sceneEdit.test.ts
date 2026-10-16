import { expect, it } from 'vitest';
import { describeState, sceneable, settingsOf, stateNow } from './sceneEdit.js';
import type { CoreDevice } from './devices.js';

const dimmer: CoreDevice = {
	device_id: 'lutron_overhead',
	name: 'Overhead',
	available: true,
	device_type: 'light',
	attributes: { on: true, brightness_pct: 75, brightness: 191 },
	schema: {
		attributes: {
			on: { kind: 'bool', writable: true, display_name: 'Power' },
			brightness_pct: {
				kind: 'integer',
				writable: true,
				min: 0,
				max: 100,
				step: 1,
				unit: '%',
				display_name: 'Brightness'
			},
			brightness: { kind: 'integer' }
		},
		primary: ['on', 'brightness_pct']
	}
};
const sensor: CoreDevice = {
	device_id: 's',
	name: 'S',
	available: true,
	attributes: { temperature: 20 },
	schema: { attributes: { temperature: { kind: 'float' } } }
};

it('a scene sets what a device says is writable', () => {
	expect(settingsOf(dimmer).map((s) => s.attr)).toEqual(['on', 'brightness_pct']);
	expect(sceneable(dimmer)).toBe(true);
	expect(sceneable(sensor)).toBe(false);
});

it('takes how it is now, and off is just off', () => {
	expect(stateNow(dimmer)).toEqual({ on: true, brightness_pct: 75 });
	expect(stateNow({ ...dimmer, attributes: { on: false, brightness_pct: 40 } })).toEqual({
		on: false
	});
});

it('says a state in words', () => {
	const s = settingsOf(dimmer);
	expect(describeState({ on: true, brightness_pct: 30 }, s)).toBe('on · 30 %');
	expect(describeState({ on: false }, s)).toBe('off');
	expect(describeState({ actions: [] }, s)).toBe('runs its own steps');
});
