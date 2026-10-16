import { describe, expect, it } from 'vitest';
import {
	clock,
	configFrom,
	createBody,
	helperKinds,
	idFor,
	kindOf,
	remaining,
	slugOf,
	valuesFrom
} from './helpers.js';
import { problems, valuesOf } from './descriptor.js';
import { descriptorOf } from './helpers.js';

describe('helpers', () => {
	it('knows all eleven of homeCore’s kinds', () => {
		expect(helperKinds().map((k) => k.type)).toEqual([
			'switch',
			'timer',
			'counter',
			'number',
			'select',
			'text',
			'button',
			'datetime',
			'group',
			'threshold',
			'schedule'
		]);
	});

	it('names it as homeCore will', () => {
		expect(slugOf('Deck Door Opens')).toBe('deck_door_opens');
		expect(slugOf('  Café — Lights! ')).toBe('cafe_lights');
		expect(idFor('counter', 'Deck Door Opens')).toBe('counter_deck_door_opens');
	});

	it('makes a group with `members`, and a timer’s minutes as seconds', () => {
		expect(createBody('group', 'Deck doors', { member_ids: ['a', 'b'], mode: 'any' })).toEqual({
			type: 'group',
			id: 'deck_doors',
			name: 'Deck doors',
			config: { members: ['a', 'b'], mode: 'any' }
		});
		const t = kindOf('timer')!;
		expect(configFrom('timer', t.edit, { duration_mins: 5, repeat: false })).toEqual({
			duration_secs: 300,
			repeat: false
		});
		expect(valuesFrom('timer', { duration_secs: 90 }).duration_mins).toBe(1.5);
	});

	it('a schedule’s blocks can be set when made but not changed', () => {
		const s = kindOf('schedule')!;
		const blocks = [{ days: ['Mon'], start: '08:00', end: '17:00' }];
		expect(configFrom('schedule', s.create, { blocks })).toEqual({ blocks });
		expect(configFrom('schedule', s.edit, { blocks })).toEqual({});
	});

	it('a select needs choices; a threshold needs a device', () => {
		const sel = descriptorOf(kindOf('select')!.create);
		expect(Object.keys(problems(sel, valuesOf(sel, {})))).toEqual(['options']);
		const th = descriptorOf(kindOf('threshold', [{ value: 'd', label: 'D' }])!.create);
		expect(Object.keys(problems(th, valuesOf(th, {})))).toEqual(['source_device_id']);
	});

	it('counts a running timer down from when it started', () => {
		const now = Date.parse('2026-10-16T12:00:00Z');
		expect(
			remaining({ state: 'running', duration_secs: 300, started_at: '2026-10-16T11:58:00Z' }, now)
		).toBe(180);
		expect(remaining({ state: 'idle' }, now)).toBeNull();
		expect(clock(138)).toBe('2:18');
		expect(clock(3725)).toBe('1:02:05');
	});
});
