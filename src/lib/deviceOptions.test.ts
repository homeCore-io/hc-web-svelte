import { describe, expect, it } from 'vitest';
import { deviceDescriptor, deviceKind, typeWords } from './deviceOptions.js';
import { HOUSE } from './fixtures/house.js';
import type { CoreDevice } from './devices.js';

const byId = (id: string): CoreDevice => {
	const d = HOUSE.find((x) => x.device_id === id);
	if (!d) throw new Error(id);
	return d;
};
const keys = (id: string, o = {}) =>
	deviceDescriptor(byId(id), o).sections.flatMap((s) => s.fields.map((f) => f.key ?? f.kind));

describe("a device card's sheet (G23–G26)", () => {
	it('a light: what it says, its two sliders on Large, tapping, a symbol', () => {
		expect(keys('hue_lamp')).toEqual(
			expect.arrayContaining([
				'main',
				'last',
				'extra_brightness_pct',
				'extra_color_temp',
				'tap',
				'symbol'
			])
		);
	});

	it('a sensor has nothing to switch, so no tapping', () => {
		const k = keys('hue_motion');
		expect(k).not.toContain('tap');
		expect(k).toEqual(expect.arrayContaining(['show_temperature', 'show_illuminance']));
	});

	it('a lock locks or unlocks when the whole card is tapped', () => {
		const tap = deviceDescriptor(byId('yolink_front_lock'))
			.sections.flatMap((s) => s.fields)
			.find((f) => f.key === 'tap');
		expect(tap?.options?.map((o) => o.label)).toEqual(['Opens its page', 'Locks or unlocks it']);
	});

	it('size where it has sizes; Large extras only where it can be Large', () => {
		expect(
			keys('hue_lamp', { forms: { all: ['compact', 'standard', 'large'], now: 'standard' } })[0]
		).toBe('size');
		expect(
			keys('hue_lamp', { forms: { all: ['compact', 'standard'], now: 'standard' } })
		).not.toContain('extra_brightness_pct');
	});

	it('a plugin-drawn card offers its size only', () => {
		expect(
			keys('hue_lamp', {
				pluginDrawn: true,
				forms: { all: ['standard', 'large'], now: 'standard' }
			})
		).toEqual(['size', 'note']);
	});

	it('every card of a type: no symbol', () => {
		expect(keys('hue_lamp', { everyCard: true })).not.toContain('symbol');
	});

	it('keeps defaults per device type', () => {
		expect(deviceKind(byId('hue_lamp'))).toBe('device:light');
		expect(typeWords(byId('hue_motion'))).toBe('motion sensor');
	});
});

describe('grouped like the mockup', () => {
	const sections = (id: string) => deviceDescriptor(byId(id)).sections.map((s) => s.title);
	it('a light: main reading, what is on the card, tapping, symbol', () => {
		expect(sections('hue_lamp')).toEqual([
			'Main reading',
			'On the card',
			'Tapping the card',
			'Symbol'
		]);
		expect(keys('hue_lamp').some((k) => k.startsWith('show_'))).toBe(false);
	});
	it('a sensor: main reading, also show, symbol — each choice with its value now', () => {
		expect(sections('hue_motion')).toEqual(['Main reading', 'Also show', 'Symbol']);
		const main = deviceDescriptor(byId('hue_motion')).sections[0]!.fields[0]!;
		expect(main.render).toBe('choices');
		expect(main.options?.every((o) => typeof o.sub === 'string')).toBe(true);
	});
});

describe('no reading offered twice', () => {
	const fields = (id: string) => deviceDescriptor(byId(id)).sections.flatMap((s) => s.fields);
	it('a lock: "As usual" already says locked, so Lock is not a second choice', () => {
		const main = fields('yolink_front_lock').find((f) => f.key === 'main')!;
		expect(main.options?.map((o) => o.value)).not.toContain('locked');
		expect(main.options?.map((o) => o.value)).toContain('door_open');
	});
	it('the main reading is not offered under Also show beside itself', () => {
		const door = fields('yolink_front_lock').find((f) => f.key === 'show_door_open')!;
		expect(door.visible_when).toEqual({ field: 'main', ne: 'door_open' });
	});
	it('a light that is on: Power says what "As usual" says', () => {
		const main = fields('hue_lamp').find((f) => f.key === 'main')!;
		expect(main.options?.map((o) => o.value)).not.toContain('on');
	});
});

describe('a thermostat’s sheet', () => {
	const nuheat = {
		device_id: 'nh_1',
		name: 'Living Room',
		device_type: 'thermostat',
		available: true,
		attributes: { temperature: 22, setpoint: 12.8, schedule_mode: 'auto', hvac_action: 'idle' },
		schema: {
			attributes: {
				temperature: { kind: 'float', unit: '°C', writable: false },
				setpoint: { kind: 'float', unit: '°C', writable: true, min: 5, max: 30 },
				schedule_mode: { kind: 'enum', writable: true }
			},
			actions: [
				{ id: 'resume_schedule', label: 'Resume', writes: 'schedule_mode' },
				{
					id: 'hold_temperature',
					label: 'Hold',
					writes: 'setpoint',
					params: [
						{ name: 'setpoint', kind: 'float' },
						{ name: 'hours', kind: 'int' }
					]
				},
				{
					id: 'set_permanent_hold',
					label: 'Hold indefinitely',
					writes: 'setpoint',
					params: [{ name: 'setpoint', kind: 'float' }]
				}
			]
		}
	} as CoreDevice;

	it('offers how long − and + hold it, until the schedule changes unless chosen; no readings to lead', () => {
		const fields = deviceDescriptor(nuheat).sections.flatMap((s) => s.fields);
		const hold = fields.find((f) => f.key === 'hold');
		expect(hold?.options?.map((o) => o.value)).toEqual(['next', 'hour', 'two', 'perm']);
		expect(hold?.default).toBe('next');
		expect(fields.some((f) => f.key === 'main' || f.key === 'last')).toBe(false);
	});
});
