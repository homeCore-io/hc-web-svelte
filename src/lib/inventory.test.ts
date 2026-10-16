import { describe, expect, it } from 'vitest';
import {
	counts,
	kindLabel,
	pluginLabel,
	plugins,
	rowsOf,
	seenText,
	shownRows
} from './inventory.js';
import type { CoreDevice } from './devices.js';
import type { Room } from './house.js';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const dev = (id: string, o: Partial<CoreDevice>): CoreDevice => ({
	device_id: id,
	name: id,
	available: true,
	attributes: {},
	last_seen: '2026-10-16T11:59:30Z',
	...o
});
const rooms: Room[] = [
	{ id: 'garage', name: 'Garage', slug: 'garage', aliases: [], deviceIds: [] }
];
const devices = {
	a: dev('a', {
		name: 'Ch 1',
		plugin_id: 'plugin.ecowitt',
		device_type: 'temperature_sensor',
		attributes: { battery_low: true }
	}),
	b: dev('b', {
		name: 'Door',
		plugin_id: 'plugin.yolink',
		device_type: 'contact_sensor',
		area: 'garage'
	}),
	c: dev('c', { name: 'Movie', plugin_id: 'plugin.hue', device_type: 'scene' }),
	d: dev('d', {
		name: 'Exhaust',
		plugin_id: 'core.glue',
		device_type: 'timer',
		available: false,
		area: 'garage'
	})
};

describe('the device list', () => {
	const rows = rowsOf(devices, rooms, NOW);
	const s = { plugin: '', scenes: false, query: '' };

	it('names plugins and kinds as a person would', () => {
		expect(pluginLabel('plugin.zwave')).toBe('Z-Wave');
		expect(pluginLabel('core.mode')).toBe('homeCore modes');
		expect(pluginLabel('core.glue')).toBe('homeCore helpers');
		expect(pluginLabel('plugin.new_thing')).toBe('New thing');
		expect(kindLabel('temperature_sensor')).toBe('Temperature sensor');
	});

	it('counts each filter, leaving plugin scenes out unless asked', () => {
		expect(counts(rows, s)).toEqual({ all: 3, noroom: 1, battery: 1, offline: 1 });
		expect(counts(rows, { ...s, scenes: true }).all).toBe(4);
		expect(shownRows(rows, { ...s, filter: 'noroom' }).map((r) => r.id)).toEqual(['a']);
	});

	it('finds by name, room, kind, id or plugin', () => {
		expect(shownRows(rows, { ...s, filter: 'all', query: 'garage' }).map((r) => r.id)).toEqual([
			'b',
			'd'
		]);
		expect(shownRows(rows, { ...s, filter: 'all', query: 'no room' }).map((r) => r.id)).toEqual([
			'a'
		]);
		expect(
			shownRows(rows, { ...s, filter: 'all', query: 'ecowitt temp' }).map((r) => r.id)
		).toEqual(['a']);
	});

	it('says what is wrong', () => {
		const a = rows.find((r) => r.id === 'a')!;
		expect(a.batteryLow && a.warn).toBe(true);
		expect(a.now).toMatch(/battery low/);
		expect(rows.find((r) => r.id === 'd')!.now).toBe('Offline');
		expect(seenText(devices.a, NOW)).toBe('now');
		expect(seenText({ ...devices.a, last_seen: '2026-10-16T11:00:00Z' }, NOW)).toBe('1 h ago');
		expect(seenText({ ...devices.a, last_seen: undefined }, NOW)).toBe('never');
	});

	it('lists plugins with how many devices each has', () => {
		expect(plugins(rows, false).map((p) => `${p.label} ${p.count}`)).toEqual([
			'Ecowitt 1',
			'homeCore helpers 1',
			'YoLink 1'
		]);
	});
});
