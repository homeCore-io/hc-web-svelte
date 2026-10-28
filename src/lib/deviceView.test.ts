import { describe, expect, it } from 'vitest';
import { chartable, readingsOf, sayValue, usesOf } from './deviceView.js';
import type { CoreDevice } from './devices.js';
import { reading, uncamel } from './card.js';

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
	// Reported in °F, read in the person's °C.
	expect(r[0]!.value).toBe('22.4°C');
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

it('charts what moves, not a track’s progress or a speaker’s tone settings', () => {
	const speaker: CoreDevice = {
		device_id: 'sonos_bathroom',
		name: 'Bathroom',
		available: true,
		attributes: {
			bass: 0,
			treble: 0,
			loudness: true,
			duration_secs: 0,
			media_duration: 0,
			position_secs: 0,
			volume: 15,
			muted: false
		},
		attributes_changed_at: {
			volume: '2026-10-17T12:00:00Z',
			muted: '2026-10-10T12:00:00Z'
		}
	};
	expect(chartable(speaker).map((c) => c.attr)).toEqual(['volume', 'muted']);
});

describe('values said for a person, not as JSON', () => {
	const names: Record<string, string> = { sonos_bathroom: 'Bathroom' };
	const nameOf = (id: string) => names[id];

	it('lists of names, lists of things, blocks, ids and addresses', () => {
		expect(sayValue(['ALT Radio', 'Piano for Sleeping'])).toEqual({
			value: 'ALT Radio, Piano for Sleeping'
		});
		expect(sayValue([])).toEqual({ value: 'None' });
		expect(sayValue(['sonos_bathroom'], nameOf)).toEqual({ value: 'Bathroom' });
		const items = sayValue([{ title: 'ALT Radio', image_url: 'https://x' }, { title: 'Piano' }]);
		expect(items?.value).toBe('ALT Radio, Piano');
		expect(items?.detail).toContain('"image_url": "https://x"');
		expect(sayValue([{ a: 1 }, { b: 2 }])?.value).toBe('2 items');
		expect(sayValue({ favorites: [], group_members: [] })?.value).toBe('favorites, group members');
		expect(sayValue('sonos_bathroom', nameOf)).toEqual({ value: 'Bathroom' });
		expect(sayValue('https://i.iheart.com/v3/re/assets')).toEqual({
			value: 'https://i.iheart.com/v3/re/assets'
		});
		expect(sayValue('paused')).toBeUndefined();
		expect(sayValue(15)).toBeUndefined();
	});

	it('colours as colours and small blocks in a line', () => {
		expect(sayValue({ b: 0, g: 128, r: 255 })).toEqual({
			value: 'Red 255 · green 128 · blue 0',
			swatch: 'rgb(255, 128, 0)'
		});
		expect(sayValue({ duration_min: 30, mode: 'FadeOut' })?.value).toBe(
			'Duration min 30 · mode fade out'
		);
		expect(sayValue({ enabled: true })).toEqual({ value: 'Enabled yes' });
		expect(sayValue({ action: 'unlocked', at: '2026-10-21T17:35:17Z' })?.value).not.toContain(
			'T17'
		);
	});

	it('times, named numbers, run-together words and whole percents', () => {
		const at = '2026-10-21T17:20:56Z';
		const said = reading({ last_alert_at: at }, { attributes: {} }, 'last_alert_at')!;
		expect(said).not.toContain('T17');
		expect(said).toBe(
			new Date(at).toLocaleString([], {
				day: 'numeric',
				month: 'short',
				hour: 'numeric',
				minute: '2-digit'
			})
		);
		const wled = {
			attributes: {
				effect: { kind: 'integer' as const, options: [{ value: '51', label: 'Rainbow' }] }
			}
		};
		expect(reading({ effect: 51 }, wled, 'effect')).toBe('Rainbow');
		expect(reading({ last_alert: 'LockFailed' }, { attributes: {} }, 'last_alert')).toBe(
			'Lock failed'
		);
		expect(uncamel('HDMI1')).toBe('HDMI1');
		expect(uncamel('TV Input')).toBe('TV Input');
		const pct = { attributes: { brightness_pct: { kind: 'float' as const, unit: '%' } } };
		expect(reading({ brightness_pct: 50.2 }, pct, 'brightness_pct')).toBe('50%');
	});
});
