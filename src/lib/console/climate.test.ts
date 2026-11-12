import { describe, expect, it } from 'vitest';
import type { CoreDevice, Schema } from '../devices.js';
import { thermostatOf } from '../thermostat.js';
import type { Units } from '../units.js';
import {
	aimWord,
	climateTab,
	dialAt,
	dialSpan,
	fanSpeeds,
	planSend,
	plansOf,
	speedLabel,
	speedWant,
	spinOf
} from './climate.js';

const F: Units = { temperature: 'F', measures: 'us' };
const C: Units = { temperature: 'C', measures: 'metric' };

const dev = (
	id: string,
	type: string,
	attributes: Record<string, unknown> = {},
	schema?: Schema
): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: type,
	available: true,
	attributes,
	...(schema ? { schema } : {})
});
const ids = (list: { device_id: string }[]) => list.map((d) => d.device_id);

const fanSchema = (options: string[]): Schema => ({
	attributes: {
		on: { kind: 'bool', writable: true },
		speed: { kind: 'enum', writable: true, options }
	}
});

describe('the Climate tab’s parts', () => {
	it('puts each thermostat with the switch it runs, and leaves that switch out of the rest', () => {
		const t = dev('ac', 'thermostat', { actuator_device_id: 'plug' });
		const plug = dev('plug', 'switch');
		const fan = dev('fan', 'fan');
		const hum = dev('humidifier', 'switch');
		const tab = climateTab([t, plug, fan, hum]);
		expect(tab.thermostats).toEqual([{ device: t, runs: plug }]);
		expect(ids(tab.fans)).toEqual(['fan']);
		expect(ids(tab.switches)).toEqual(['humidifier']);
	});

	it('finds a switch a thermostat runs in another room', () => {
		const t = dev('heat', 'thermostat', { actuator_device_id: 'far' });
		const far = dev('far', 'switch');
		expect(climateTab([t], { far }).thermostats[0]!.runs).toBe(far);
		expect(climateTab([t]).thermostats[0]!.runs).toBeUndefined();
	});
});

describe('the dial', () => {
	it('spans a room’s temperatures, not the thermostat’s widest range', () => {
		expect(dialSpan({ unit: '°F', min: -40, max: 113, now: 44, target: 45 }, F)).toEqual({
			lo: 41,
			hi: 95
		});
		expect(dialSpan({ unit: '°C', min: -40, max: 45, now: 20, target: 21 }, C)).toEqual({
			lo: 5,
			hi: 35
		});
	});

	it('stretches to take in a cold reading, inside what the thermostat takes', () => {
		expect(dialSpan({ unit: '°C', min: 2, max: 30, now: 1, target: 7 }, C)).toEqual({
			lo: 2,
			hi: 30
		});
		expect(dialSpan({ unit: '°C', min: -40, max: 45, now: 1, target: 7 }, C).lo).toBe(1);
	});

	it('places a temperature along it', () => {
		expect(dialAt({ lo: 40, hi: 90 }, 65)).toBe(0.5);
		expect(dialAt({ lo: 40, hi: 90 }, 100)).toBe(1);
		expect(dialAt({ lo: 40, hi: 90 }, undefined)).toBe(0);
	});

	it('says what the target is for', () => {
		expect(aimWord({ mode: 'heat', doing: 'idle' })).toBe('Heat to');
		expect(aimWord({ mode: 'cool', doing: 'idle' })).toBe('Cool to');
		expect(aimWord({ doing: 'idle' })).toBe('Set to');
	});
});

describe('a schedule’s choices', () => {
	const nuheat = dev(
		'floor',
		'thermostat',
		{ setpoint: 21, temperature: 22, schedule_mode: 'auto', hvac_mode: 'heat' },
		{
			attributes: { setpoint: { kind: 'float', unit: '°C', writable: true } },
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
	);

	it('offers the schedule, a hold and a hold until changed', () => {
		const t = thermostatOf(nuheat);
		expect(plansOf(t).map((p) => p.label)).toEqual(['Schedule', 'Hold', 'Until changed']);
	});

	it('resumes the schedule, or holds today’s target in the thermostat’s own unit', () => {
		const t = thermostatOf(nuheat);
		expect(planSend(t, nuheat, 'auto')).toEqual({
			kind: 'action',
			id: 'resume_schedule',
			params: {}
		});
		expect(planSend(t, nuheat, 'permanent_hold')).toEqual({
			kind: 'action',
			id: 'set_permanent_hold',
			params: { setpoint: 21 }
		});
		expect(planSend(t, nuheat, 'hold')).toMatchObject({ id: 'hold_temperature' });
	});

	it('offers nothing without a schedule', () => {
		const t = thermostatOf(dev('plain', 'thermostat', { setpoint: 20 }));
		expect(plansOf(t)).toEqual([]);
	});
});

describe('a fan’s speeds', () => {
	it('reads its speeds from its schema, off first', () => {
		const fan = dev(
			'f',
			'fan',
			{ on: true, speed: 'medium' },
			fanSchema(['off', 'low', 'medium', 'high'])
		);
		expect(fanSpeeds(fan)).toEqual({ options: ['off', 'low', 'medium', 'high'], value: 'medium' });
	});

	it('adds off where the fan has none, and turns it off for that', () => {
		const fan = dev('f', 'fan', { on: false, speed: 'low' }, fanSchema(['low', 'high']));
		expect(fanSpeeds(fan)).toEqual({ options: ['off', 'low', 'high'], value: 'off' });
		expect(speedWant(fan, 'off')).toEqual({ on: false });
		expect(speedWant(fan, 'high')).toEqual({ speed: 'high' });
	});

	it('has no speeds without a writable speed', () => {
		expect(fanSpeeds(dev('f', 'fan', { on: true }))).toBeUndefined();
	});

	it('names speeds short, and turns faster at higher ones', () => {
		expect(speedLabel('medium-high')).toBe('Med hi');
		expect(speedLabel('low')).toBe('Low');
		const o = ['off', 'low', 'medium', 'high'];
		expect(spinOf({ options: o, value: 'off' })).toBe(0);
		expect(spinOf({ options: o, value: 'low' })).toBe(1.8);
		expect(spinOf({ options: o, value: 'high' })).toBe(0.5);
	});
});
