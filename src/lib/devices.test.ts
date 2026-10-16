import { describe, expect, it } from 'vitest';
import { devicesAfter, fromList } from './devices.js';
import { HOUSE } from './fixtures/house.js';

const house = fromList(HOUSE);

describe('devices after a frame', () => {
	it('a state report replaces the attributes and records what changed when', () => {
		const u = devicesAfter(house, {
			type: 'device_state_changed',
			timestamp: '2026-10-16T12:05:00Z',
			device_id: 'hue_lamp',
			current: { on: false, brightness_pct: 80 },
			changed: ['on'],
			change: { kind: 'physical' }
		})!;
		const lamp = u.devices.hue_lamp!;
		expect(lamp.attributes).toEqual({ on: false, brightness_pct: 80 });
		expect(lamp.attributes_changed_at?.on).toBe('2026-10-16T12:05:00Z');
		expect(lamp.last_change?.kind).toBe('physical');
		// Every other device keeps the object it had, so its card doesn't redraw.
		expect(u.devices.hue_ceiling).toBe(house.hue_ceiling);
	});

	it('a metadata change keeps the schema the record does not carry', () => {
		const { schema: _schema, ...record } = house.hue_lamp!;
		const u = devicesAfter(house, {
			type: 'device_metadata_changed',
			device: { ...record, name_override: 'Lamp' }
		})!;
		expect(u.devices.hue_lamp!.name_override).toBe('Lamp');
		expect(u.devices.hue_lamp!.schema).toBe(house.hue_lamp!.schema);
		expect(u.fetchSchema).toEqual([]);
	});

	it('a new device is added, and its schema fetched', () => {
		const u = devicesAfter(house, {
			type: 'device_added',
			device: { device_id: 'new', name: 'New', available: true, attributes: {} }
		})!;
		expect(u.devices.new?.name).toBe('New');
		expect(u.fetchSchema).toEqual(['new']);
	});

	it('removal, availability and an old-style rename', () => {
		expect(
			'hue_lamp' in devicesAfter(house, { type: 'device_removed', device_id: 'hue_lamp' })!.devices
		).toBe(false);
		expect(
			devicesAfter(house, {
				type: 'device_availability_changed',
				timestamp: 'x',
				device_id: 'hue_lamp',
				available: false
			})!.devices.hue_lamp!.available
		).toBe(false);
		expect(
			devicesAfter(house, {
				type: 'device_name_changed',
				device_id: 'hue_lamp',
				current_name: 'Lamp 2'
			})!.devices.hue_lamp!.name
		).toBe('Lamp 2');
	});

	it('a snapshot replaces everything; one without devices leaves them', () => {
		expect(
			Object.keys(devicesAfter(house, { type: 'snapshot', devices: [HOUSE[0]!] })!.devices)
		).toEqual(['hue_lamp']);
		expect(devicesAfter(house, { type: 'snapshot' })).toBeUndefined();
	});

	it('frames about unknown devices or other things change nothing', () => {
		expect(devicesAfter(house, { type: 'device_removed', device_id: 'nope' })).toBeUndefined();
		expect(devicesAfter(house, { type: 'rule_fired' })).toBeUndefined();
	});
});
