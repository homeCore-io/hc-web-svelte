import { describe, expect, it } from 'vitest';
import { actionBody, detailsFor, ready } from './details.js';
import { activityOf, byWhom } from './activity.js';
import { HOUSE, FIXTURE_NOW } from './fixtures/house.js';
import type { CoreDevice } from './devices.js';

const byId = (id: string): CoreDevice => HOUSE.find((d) => d.device_id === id)!;
const details = (id: string) => detailsFor(byId(id), HOUSE, FIXTURE_NOW);

describe('device details, generated from the schema (D3)', () => {
	it('a light: colour as a control; on, brightness and warmth stay with the card', () => {
		const d = details('hue_lamp');
		expect(d.controls.map((c) => c.kind)).toEqual(['colour']);
		expect(d.readings).toEqual([]);
		expect(d.more.map((m) => m.label)).toContain('Supports dimming');
		expect(d.chart).toMatchObject({ attr: 'brightness_pct', bool: false });
	});

	it('a TV: actions grouped by the plugin’s categories, Power first', () => {
		expect(details('roku_den').groups.map((g) => g.title)).toEqual(['Power', 'Transport', 'Apps']);
		expect(details('roku_den').chart).toBeUndefined();
	});

	it('an action that claims an attribute replaces its control', () => {
		const d = details('roku_den');
		expect(d.controls.find((c) => c.attr === 'source')).toBeUndefined();
		const select = d.groups.flatMap((g) => g.actions).find((a) => a.id === 'select_source')!;
		expect(select.fields[0]).toMatchObject({
			kind: 'choice',
			options: [
				{ value: 'Netflix', label: 'Netflix' },
				{ value: 'YouTube', label: 'YouTube' },
				{ value: 'HDMI 1', label: 'HDMI 1' }
			]
		});
	});

	it('options come from the device’s own attributes, by the keys the plugin names', () => {
		const launch = details('roku_den')
			.groups.flatMap((g) => g.actions)
			.find((a) => a.id === 'launch_app')!;
		expect(launch.fields[0]).toMatchObject({
			kind: 'choice',
			options: [
				{ value: '12', label: 'Netflix' },
				{ value: '837', label: 'YouTube' }
			]
		});
	});

	it('optional parameters are left to their defaults: a plain button', () => {
		const next = details('roku_den')
			.groups.flatMap((g) => g.actions)
			.find((a) => a.id === 'next')!;
		expect(next.fields).toEqual([]);
		expect(actionBody(next, {})).toEqual({ action: 'next' });
	});

	it('a keypad button press sends the button’s number, not its name', () => {
		const press = details('lutron_keypad')
			.groups.flatMap((g) => g.actions)
			.find((a) => a.id === 'press_button')!;
		expect(press.fields[0]).toMatchObject({ kind: 'choice', numeric: true, value: '2' });
		expect(actionBody(press, { button: '5' })).toEqual({ action: 'press_button', button: 5 });
		expect(ready(press, {})).toBe(true);
	});

	it('a fan’s percentage is a control; its speed steps stay on the card', () => {
		const d = details('lutron_fan');
		expect(d.controls).toEqual([
			{
				kind: 'slider',
				attr: 'speed_pct',
				label: 'Speed',
				value: 50,
				min: 0,
				max: 100,
				step: 1,
				unit: '%'
			}
		]);
	});

	it('a sensor: its readings, and a chart of the first number', () => {
		const d = details('hue_motion');
		expect(d.controls).toEqual([]);
		expect(d.readings).toEqual([
			{ label: 'Motion', value: 'Clear' },
			{ label: 'Temperature', value: '22.1°C' },
			{ label: 'Illuminance', value: '26 lux' }
		]);
		expect(d.chart).toMatchObject({ attr: 'motion', bool: true });
		expect(details('ecowitt_den').chart).toMatchObject({ attr: 'temperature' });
	});

	it('an action with nothing to choose from is not offered', () => {
		const roku = byId('roku_den');
		const tv = { ...roku, attributes: { ...roku.attributes, available_apps: [] } };
		const ids = detailsFor(tv, HOUSE, FIXTURE_NOW).groups.flatMap((g) =>
			g.actions.map((a) => a.id)
		);
		expect(ids).not.toContain('launch_app');
		expect(ids).toContain('select_source');
	});

	it('battery and other housekeeping go under More', () => {
		expect(details('yolink_front_lock').more).toEqual([{ label: 'Battery', value: '90%' }]);
	});
});

describe('activity, saying who changed it', () => {
	const lamp = byId('hue_lamp').schema!;
	it('says what changed and by whom, newest first', () => {
		const lines = activityOf(
			[
				{
					timestamp: '2026-10-16T08:00:00Z',
					changed: ['on'],
					current: { on: true },
					change: { kind: 'physical' }
				},
				{
					timestamp: '2026-10-16T09:00:00Z',
					changed: ['brightness_pct', 'on'],
					current: { on: true, brightness_pct: 40 },
					change: { kind: 'homecore', source: 'rule', actor_name: 'Evening' }
				}
			],
			lamp
		);
		expect(lines.map((l) => l.text)).toEqual([
			'Brightness 40%, On · by Evening',
			'On · at the wall'
		]);
	});

	it('leaves out changes nobody made', () => {
		expect(activityOf([{ timestamp: 'x', changed: ['last_seen'], current: {} }], lamp)).toEqual([]);
		expect(
			activityOf([{ timestamp: 'x', changed: ['media_position_ms'], current: {} }], lamp)
		).toEqual([]);
	});

	it('names people, rules, scenes, walls and other apps', () => {
		expect(byWhom({ kind: 'homecore', source: 'api', actor_name: 'sam' })).toBe('by sam');
		expect(byWhom({ kind: 'homecore', source: 'scene', actor_name: 'Movie time' })).toBe(
			'by Movie time'
		);
		expect(byWhom({ kind: 'external', source: 'hue_app' })).toBe('from hue app');
		expect(byWhom(undefined)).toBe('');
	});
});
