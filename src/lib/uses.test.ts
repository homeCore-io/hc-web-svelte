import { expect, it } from 'vitest';
import { mentions, rulesNaming } from './uses.js';

it('finds rules naming a device anywhere, but not by key or substring', () => {
	const rules = [
		{ id: '1', name: 'B', trigger: { DeviceStateChanged: { device_id: 'yolink_oh1' } } },
		{
			id: '2',
			name: 'A',
			actions: [
				{
					action: {
						Parallel: { actions: [{ action: { SetDeviceState: { device_id: 'yolink_oh1' } } }] }
					}
				}
			]
		},
		{ id: '3', name: 'C', actions: [{ action: { SetDeviceState: { device_id: 'yolink_oh10' } } }] },
		{ id: '4', name: 'D', conditions: [{ yolink_oh1: true }] }
	];
	expect(rulesNaming(rules, 'yolink_oh1').map((r) => r.name)).toEqual(['A', 'B']);
	expect(mentions({ a: [1, { b: 'x' }] }, 'x')).toBe(true);
});
