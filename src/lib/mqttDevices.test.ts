import { describe, expect, it } from 'vitest';
import {
	deviceOf,
	draftProfile,
	ecosystemName,
	givesOf,
	guessPattern,
	slug,
	likelyTypes,
	readingsLine,
	suggestionChanges,
	typeLabel,
	untypedOf,
	type ProfileDevice
} from './mqttDevices.js';

const device = (over: Partial<ProfileDevice>): ProfileDevice => ({
	device_id: 'zigbee_x',
	name: 'X',
	device_type: null,
	configured: null,
	suggestion: null,
	available: true,
	last_seen: '2026-11-26T20:00:00Z',
	readings: {},
	...over
});

describe('the words for devices over MQTT', () => {
	it('names the shipped ecosystems as people know them, and others as they are', () => {
		expect(ecosystemName('zigbee2mqtt')).toBe('Zigbee2MQTT');
		expect(ecosystemName('shelly-gen1')).toBe('Shelly (original firmware)');
		expect(ecosystemName('my-firmware')).toBe('my-firmware');
	});

	it('says a type in words', () => {
		expect(typeLabel('dimmer_light')).toBe('Dimmer light');
		expect(typeLabel('switch')).toBe('Switch');
	});

	it('says what a type gives: its controls, else what it reports', () => {
		expect(
			givesOf({
				name: 'light',
				description: null,
				attributes: [
					{ name: 'on', writable: true },
					{ name: 'brightness_pct', writable: true },
					{ name: 'color_temp', writable: true }
				]
			})
		).toBe('On and off, brightness and warmth');
		expect(
			givesOf({
				name: 'switch',
				description: null,
				attributes: [{ name: 'on', writable: true }]
			})
		).toBe('On and off');
		expect(
			givesOf({
				name: 'motion_sensor',
				description: null,
				attributes: [
					{ name: 'occupied', writable: false },
					{ name: 'battery_pct', writable: false }
				]
			})
		).toBe('Reports occupied and battery');
	});

	it('shows a few plain readings', () => {
		expect(readingsLine({ on: true, brightness_pct: 54, color: { x: 1 }, a: 1, b: 2, c: 3 })).toBe(
			'on: true · brightness_pct: 54 · a: 1 · b: 2'
		);
	});

	it('uses suggestions only for devices with no type, keeping a name already given', () => {
		const ds = [
			device({ device_id: 'a', suggestion: 'light', suggested_name: 'Lamp' }),
			device({ device_id: 'b', suggestion: 'switch', device_type: 'switch' }),
			device({ device_id: 'c' }),
			device({
				device_id: 'd',
				suggestion: 'contact_sensor',
				configured: { device_type: null, name: 'Back door' }
			})
		];
		expect(untypedOf(ds).untyped.map((d) => d.device_id)).toEqual(['a', 'c', 'd']);
		expect(suggestionChanges(ds)).toEqual([
			{ device_id: 'a', device_type: 'light', name: 'Lamp' },
			{ device_id: 'd', device_type: 'contact_sensor', name: 'Back door' }
		]);
	});
});

describe('likely types', () => {
	const known = ['light', 'dimmer_light', 'switch', 'motion_sensor', 'temperature_sensor'];
	it('points from readings to types the catalog has, likeliest first', () => {
		expect(likelyTypes({ on: true, brightness_pct: 54 }, known)).toEqual([
			'light',
			'dimmer_light',
			'switch'
		]);
		expect(likelyTypes({ occupied: false, temperature: 20 }, known)).toEqual([
			'motion_sensor',
			'temperature_sensor'
		]);
		expect(likelyTypes({ linkquality: 112 }, known)).toEqual([]);
	});
});

describe('drafting a profile from a heard topic', () => {
	it('guesses the device from the second level, and reads a topic back by it', () => {
		const p = guessPattern('esphome/garage-door/sensor/state');
		expect(p).toBe('esphome/{device}/sensor/state');
		expect(deviceOf(p, 'esphome/garage-door/sensor/state')).toBe('garage-door');
		expect(deviceOf(p, 'esphome/porch/sensor/state')).toBe('porch');
		expect(deviceOf(p, 'esphome/porch/light/state')).toBeNull();
		expect(deviceOf(p, 'esphome/porch')).toBeNull();
		expect(guessPattern('lonely')).toBe('lonely');
	});

	it('makes plain words for names', () => {
		expect(slug('My Firmware!')).toBe('my-firmware');
	});

	it('drafts a profile, wrapping a plain message under a reading', () => {
		const plain = draftProfile({
			name: 'esphome',
			prefix: 'esphome_',
			pattern: 'esphome/{device}/sensor/state',
			payload: 'closed'
		});
		expect(plain).toContain('name   = "esphome"');
		expect(plain).toContain('pattern = "esphome/{device}/sensor/state"');
		expect(plain).toContain('attribute     = "state"');
		const json = draftProfile({
			name: 'esphome',
			prefix: 'esphome_',
			pattern: 'esphome/{device}/state',
			payload: '{"state":"closed"}'
		});
		expect(json).not.toContain('attribute     =');
	});
});
