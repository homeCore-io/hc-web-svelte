import { expect, test } from 'vitest';
import { DEVICES } from './fixtures/rules.js';
import { offers, sourceOptions } from './formSources.js';

const rooms = [{ id: 'r1', name: 'Den', slug: 'den', aliases: [], deviceIds: [] }];
const all = DEVICES.map((d) => (d.device_id === 'zz_air' ? { ...d, area: 'den' } : d));

test('devices that offer what a field asks for', () => {
	expect(all.filter((d) => offers(d, 'temperature')).map((d) => d.device_id)).toEqual(['zz_air']);
	expect(all.filter((d) => offers(d, 'switch')).map((d) => d.device_id)).toEqual([
		'zz_lamp_1',
		'zz_lamp_2',
		'mode_night'
	]);
});

test('a source as options, by name and room', () => {
	expect(
		sourceOptions(
			{ kind: 'core_resource', ref: 'all_devices', capability: 'temperature' },
			all,
			rooms
		)
	).toEqual([{ value: 'zz_air', label: 'Den Air — Den' }]);
	expect(sourceOptions({ kind: 'core_resource', ref: 'areas' }, all, rooms)).toEqual([
		{ value: 'den', label: 'Den' }
	]);
	expect(sourceOptions({ kind: 'plugin_action', ref: 'list_bridges' }, all, rooms)).toBeUndefined();
	expect(sourceOptions(undefined, all, rooms)).toBeUndefined();
});
