import { describe, expect, it } from 'vitest';
import { devicesAfter, fromList, unitOf, withReadingUnits, type CoreDevice } from './devices.js';
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

describe('the unit each reading is in', () => {
	const stale: CoreDevice = {
		device_id: 'hue_motion',
		name: 'Office Motion',
		available: true,
		attributes: { temperature: 71.6, temperature_unit: 'F' },
		schema: { attributes: { temperature: { kind: 'float', unit: '°C', writable: false } } }
	} as CoreDevice;

	it('follows a reading kept in another unit, and only then', () => {
		const d = withReadingUnits(stale);
		expect(d.schema!.attributes.temperature!.unit).toBe('°F');
		expect(unitOf(d, 'temperature')).toBe('°F');
		const plain = { ...stale, attributes: { temperature: 22 } };
		expect(withReadingUnits(plain)).toBe(plain);
	});

	it('goes back to the declared unit once the plugin stops sending one', () => {
		const at = { [stale.device_id]: withReadingUnits(stale) };
		const u = devicesAfter(at, {
			type: 'device_state_changed',
			timestamp: '2026-10-31T12:00:00Z',
			device_id: stale.device_id,
			current: { temperature: 22 },
			changed: ['temperature']
		});
		const d = u!.devices[stale.device_id]!;
		expect(d.schema!.attributes.temperature!.unit).toBe('°C');
		expect(unitOf(d, 'temperature')).toBe('°C');
	});
});
