import { expect, it } from 'vitest';
import { chartable, readingsOf, usesOf } from './deviceView.js';
import type { CoreDevice } from './devices.js';

const sensor: CoreDevice = {
	device_id: 'ecowitt_temp_1',
	name: 'Temp/Humidity Ch 1',
	canonical_name: 'temp_humidity_ch_1',
	available: true,
	attributes: {
		temperature: 72.3,
		humidity: 60,
		battery_low: true,
		temperature_unit: '°F',
		rssi: -60
	},
	schema: {
		attributes: {
			temperature: { kind: 'float', unit: '°F' },
			humidity: { kind: 'float', unit: '%' },
			battery_low: {
				kind: 'bool',
				display_name: 'Battery',
				states: { when_true: { label: 'Low' }, when_false: { label: 'OK' } }
			},
			rssi: { kind: 'integer', category: 'diagnostic' }
		},
		primary: ['temperature', 'humidity']
	}
};

it('lists readings primary first and diagnostics last, in words', () => {
	const r = readingsOf(sensor);
	expect(r.map((x) => x.attr)).toEqual(['temperature', 'humidity', 'battery_low', 'rssi']);
	expect(r[0]!.value).toBe('72.3°F');
	expect(r[2]).toMatchObject({ label: 'Battery', value: 'Low' });
});

it('charts numbers and on/offs, not battery or signal', () => {
	expect(chartable(sensor).map((c) => c.attr)).toEqual(['temperature', 'humidity']);
});

it('finds rules by id or name in rules, scenes and alert rules', () => {
	const u = usesOf(
		sensor,
		[
			{ id: 'r1', name: 'By canonical', trigger: { device: 'temp_humidity_ch_1' } },
			{ id: 'r2', name: 'Other', trigger: { device: 'x' } }
		],
		[{ id: 's1', name: 'Cosy', states: { ecowitt_temp_1: { on: true } } }],
		[{ id: 'a1', name: 'Hot', device_ids: ['ecowitt_temp_1'] }]
	);
	expect(u.rules.map((r) => r.name)).toEqual(['By canonical']);
	expect(u.scenes.map((s) => s.name)).toEqual(['Cosy']);
	expect(u.alertRules.map((s) => s.name)).toEqual(['Hot']);
});
