import { describe, expect, it } from 'vitest';
import { apart } from './apart.js';
import type { CoreDevice } from '../devices.js';

const dev = (device_id: string, name: string, plugin_id: string) =>
	({ device_id, name, plugin_id, attributes: {}, available: true }) as unknown as CoreDevice;
const nameOf = (d: CoreDevice) => d.name;

describe('telling apart things shown with the same name', () => {
	it('leaves names shown once alone', () => {
		expect(
			apart([dev('a', 'Lamp', 'plugin.hue'), dev('b', 'Fan', 'plugin.hue')], nameOf).size
		).toBe(0);
	});
	it('says their brands when those differ', () => {
		const m = apart(
			[
				dev('sbx_mbr_temp', 'MBR Temperature', 'sbx.standin'),
				dev('yolink_ee02', 'MBR Temperature', 'plugin.yolink')
			],
			nameOf
		);
		expect(m.get('sbx_mbr_temp')).toBe('Stand-in');
		expect(m.get('yolink_ee02')).toBe('YoLink');
	});
	it('else says what differs in their ids', () => {
		const m = apart(
			[
				dev('ecowitt_aisle_1', 'Temp/Humidity Ch 1', 'plugin.ecowitt'),
				dev('ecowitt_temp_1', 'Temp/Humidity Ch 1', 'plugin.ecowitt'),
				dev('zwave_44', 'Test Door Sensor', 'plugin.zwave'),
				dev('zwave_45', 'Test Door Sensor', 'plugin.zwave')
			],
			nameOf
		);
		expect(m.get('ecowitt_aisle_1')).toBe('aisle 1');
		expect(m.get('ecowitt_temp_1')).toBe('temp 1');
		expect(m.get('zwave_44')).toBe('44');
		expect(m.get('zwave_45')).toBe('45');
	});
});
