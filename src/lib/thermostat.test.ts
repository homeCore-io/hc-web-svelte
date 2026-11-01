import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoreDevice } from './devices.js';
import {
	DIAL,
	Nudge,
	along,
	dialOf,
	lengthsOf,
	scheduleWords,
	sendFor,
	stepped,
	targetWords,
	thermostatOf
} from './thermostat.js';
import { followUnits } from './units.js';

const F = () => ({ temperature: 'F' as const, measures: 'us' as const });
const C = () => ({ temperature: 'C' as const, measures: 'metric' as const });

/** A NuHeat-like thermostat: one setpoint, a schedule, and hold actions. */
function floor(attrs: Record<string, unknown> = {}): CoreDevice {
	return {
		device_id: 'nh_1',
		name: 'Living Room',
		device_type: 'thermostat',
		available: true,
		attributes: {
			temperature: 22.2,
			setpoint: 12.8,
			hvac_mode: 'heat',
			hvac_action: 'idle',
			schedule_mode: 'auto',
			...attrs
		},
		schema: {
			attributes: {
				temperature: { kind: 'float', unit: '°C', writable: false },
				setpoint: { kind: 'float', unit: '°C', writable: true, min: 5, max: 30, step: 0.5 },
				hvac_mode: { kind: 'enum', writable: false, options: [{ value: 'heat', label: 'Heat' }] },
				schedule_mode: { kind: 'enum', writable: true },
				hold_until: { kind: 'string', writable: false }
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
}

/** homeCore's own thermostat: one setpoint, heat or cool, no schedule. */
function air(attrs: Record<string, unknown> = {}): CoreDevice {
	return {
		device_id: 'th_1',
		name: 'Hall',
		device_type: 'thermostat',
		available: true,
		attributes: {
			temperature: 21,
			setpoint: 20,
			hvac_mode: 'heat',
			hvac_action: 'idle',
			...attrs
		},
		schema: {
			attributes: {
				temperature: { kind: 'float', unit: '°C', writable: false },
				setpoint: { kind: 'float', unit: '°C', writable: true, min: 10, max: 32, step: 0.5 },
				hvac_mode: {
					kind: 'enum',
					writable: true,
					options: [
						{ value: 'off', label: 'Off' },
						{ value: 'heat', label: 'Heat' },
						{ value: 'cool', label: 'Cool' }
					]
				},
				hvac_action: { kind: 'enum', writable: false }
			}
		}
	} as CoreDevice;
}

afterEach(() => followUnits(C));

describe('the thermostat card reads', () => {
	it('in the person’s units, whole degrees in °F', () => {
		followUnits(F);
		const t = thermostatOf(floor());
		expect(t.unit).toBe('°F');
		expect(Math.round(t.now!)).toBe(72);
		expect(t.step).toBe(1);
		expect(Math.round(t.min)).toBe(41);
		expect(Math.round(t.max)).toBe(86);
		expect(targetWords(t)).toBe('Target 55°');
	});

	it('heating, cooling or idle from what it says it is doing', () => {
		expect(thermostatOf(floor({ hvac_action: 'heating', setpoint: 24 })).doing).toBe('heating');
		expect(thermostatOf(air({ hvac_mode: 'cool', hvac_action: 'cooling' })).doing).toBe('cooling');
		expect(thermostatOf(air()).doing).toBe('idle');
		expect(thermostatOf(air({ hvac_mode: 'off' })).doing).toBe('off');
		expect(targetWords(thermostatOf(air({ hvac_mode: 'off' })))).toBe('Off');
		expect(targetWords(thermostatOf(floor({ hvac_action: 'heating', setpoint: 24 })))).toBe(
			'Heating to 24°'
		);
	});

	it('its schedule: following it, held until when, until changed, or none', () => {
		const at = () => '3:40 PM';
		expect(scheduleWords(thermostatOf(floor()), at)).toBe('Following its schedule');
		expect(scheduleWords(thermostatOf(floor({ schedule_mode: 'hold' })), at)).toBe(
			'Held until the schedule changes'
		);
		expect(
			scheduleWords(
				thermostatOf(floor({ schedule_mode: 'hold', hold_until: '2026-11-01T20:40:00Z' })),
				at
			)
		).toBe('Held until 3:40 PM');
		expect(scheduleWords(thermostatOf(floor({ schedule_mode: 'permanent_hold' })), at)).toBe(
			'Held until changed'
		);
		expect(scheduleWords(thermostatOf(air()), at)).toBe('No schedule');
	});

	it('the modes a person may choose, only where it can do more than one', () => {
		expect(thermostatOf(air()).modes.map((m) => m.label)).toEqual(['Off', 'Heat', 'Cool']);
		expect(thermostatOf(floor()).modes).toEqual([]);
	});

	it('both targets in auto, when it keeps a heat and a cool one', () => {
		const d = air({ hvac_mode: 'auto', heat_setpoint: 20, cool_setpoint: 24 });
		d.schema!.attributes = { ...d.schema!.attributes };
		delete d.schema!.attributes.setpoint;
		d.schema!.attributes.heat_setpoint = { kind: 'float', unit: '°C', writable: true };
		d.schema!.attributes.cool_setpoint = { kind: 'float', unit: '°C', writable: true };
		const t = thermostatOf(d);
		expect(t.dual).toBe(true);
		expect(targetWords(t)).toBe('Heat 20° · Cool 24°');
		expect(dialOf(t).cool).toBeDefined();
	});
});

describe('− and +', () => {
	it('step by 1 °F or 0.5 °C, onto the step, inside the range', () => {
		followUnits(F);
		const t = thermostatOf(floor());
		expect(stepped(t, 70.7, 1)).toBe(71);
		expect(stepped(t, 70.7, -1)).toBe(70);
		expect(stepped(t, 70, 1)).toBe(71);
		// 23.89 °C reads as 75.002 °F: − goes to 74, not to 75.
		expect(stepped(t, 75.002, -1)).toBe(74);
		expect(stepped(t, 74.998, 1)).toBe(76);
		expect(stepped(t, t.max, 1)).toBe(Math.round(t.max * 100) / 100);
		followUnits(C);
		const c = thermostatOf(floor());
		expect(stepped(c, 21.11, 1)).toBe(21.5);
		expect(stepped(c, 21, -1)).toBe(20.5);
		expect(stepped(c, 5, -1)).toBe(5);
	});

	it('on a schedule, hold: until it changes by default, an hour, two, or until changed', () => {
		followUnits(F);
		const d = floor();
		const t = thermostatOf(d);
		const next = sendFor(t, d, 70, 'next');
		expect(next).toEqual({
			kind: 'action',
			id: 'hold_temperature',
			params: { setpoint: 21.11 }
		});
		expect(sendFor(t, d, 70, 'hour')).toMatchObject({ params: { hours: 1 } });
		expect(sendFor(t, d, 70, 'two')).toMatchObject({ params: { hours: 2 } });
		expect(sendFor(t, d, 70, 'perm')).toMatchObject({ id: 'set_permanent_hold' });
		expect(lengthsOf(t)).toEqual(['next', 'hour', 'two', 'perm']);
	});

	it('a permanent hold stays one', () => {
		const d = floor({ schedule_mode: 'permanent_hold' });
		expect(sendFor(thermostatOf(d), d, 22, 'next')).toMatchObject({ id: 'set_permanent_hold' });
	});

	it('with no schedule, the target itself, in the schema’s unit', () => {
		followUnits(F);
		const d = air();
		const t = thermostatOf(d);
		expect(sendFor(t, d, 68, 'next')).toEqual({ kind: 'set', want: { setpoint: 20 } });
		expect(lengthsOf(t)).toEqual([]);
		const cool = air({ hvac_mode: 'cool' });
		expect(thermostatOf(cool).attr).toBe('setpoint');
	});

	it('gather quick presses into one command, showing each at once', () => {
		vi.useFakeTimers();
		const sent: number[] = [];
		const n = new Nudge((v) => sent.push(v), 900);
		const t = { min: 41, max: 86, step: 1 };
		expect(n.press(t, 55, 1)).toBe(56);
		expect(n.press(t, 55, 1)).toBe(57);
		vi.advanceTimersByTime(500);
		expect(n.press(t, 55, 1)).toBe(58);
		expect(sent).toEqual([]);
		vi.advanceTimersByTime(900);
		expect(sent).toEqual([58]);
		n.settle();
		expect(n.value).toBeUndefined();
		vi.useRealTimers();
	});
});

describe('the dial', () => {
	it('runs 270° from the bottom left, low to high across the range', () => {
		const t = { min: 40, max: 90 };
		expect(along(t, 40)).toBe(0);
		expect(along(t, 90)).toBe(1);
		expect(along(t, 100)).toBe(1);
		const d = dialOf({ ...thermostatOf(air()), min: 40, max: 90, now: 65, target: 65 });
		// Halfway is straight up.
		expect(d.now![0]).toBeCloseTo(DIAL.cx, 0);
		expect(d.now![1]).toBeCloseTo(DIAL.cy - DIAL.r, 0);
	});

	it('fills between now and the target only while it heats or cools', () => {
		expect(dialOf(thermostatOf(floor())).fill).toBeUndefined();
		const heating = dialOf(thermostatOf(floor({ hvac_action: 'heating', setpoint: 25 })));
		expect(heating.fill).toMatch(/^M[\d.]+ [\d.]+ A88 88 0 [01] 1 /);
		expect(heating.cooling).toBe(false);
		expect(dialOf(thermostatOf(air({ hvac_mode: 'cool', hvac_action: 'cooling' }))).cooling).toBe(
			true
		);
	});
});
