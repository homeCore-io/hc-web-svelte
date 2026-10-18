import { describe, expect, it } from 'vitest';
import {
	alertsAfter,
	byDevice,
	describeIgnore,
	describeRule,
	devicesFor,
	ignoreFor,
	levelChoices,
	levelLabel,
	ranOut,
	ruleName,
	sameState,
	stateChoices,
	type Alert,
	type AlertIgnore
} from './alerts.js';
import type { CoreDevice } from './devices.js';

const a = (id: string, severity: Alert['severity'], at: string, device = 'd'): Alert => ({
	id,
	kind: 'rule',
	device_id: device,
	message: id,
	reason: id,
	severity,
	raised_at: at
});

describe('alerts from the event stream (H4)', () => {
	it('the snapshot replaces the list; a frame without alerts leaves it alone', () => {
		const list = [a('x', 'warning', '2026-10-16T10:00:00Z')];
		expect(alertsAfter([], { type: 'snapshot', alerts: list } as never)).toEqual(list);
		expect(alertsAfter(list, { type: 'snapshot' })).toBeUndefined();
		expect(alertsAfter(list, { type: 'device_state_changed' })).toBeUndefined();
	});

	it('raised adds or replaces by id; cleared removes', () => {
		let list = alertsAfter([], {
			type: 'alert_raised',
			alert: a('x', 'warning', '2026-10-16T10:00:00Z')
		} as never)!;
		list = alertsAfter(list, {
			type: 'alert_raised',
			alert: a('x', 'critical', '2026-10-16T10:05:00Z')
		} as never)!;
		expect(list).toHaveLength(1);
		expect(list[0]!.severity).toBe('critical');
		expect(alertsAfter(list, { type: 'alert_cleared', alert_id: 'x' } as never)).toEqual([]);
	});

	it('most serious first, then newest', () => {
		const list = alertsAfter([], {
			type: 'snapshot',
			alerts: [
				a('old', 'warning', '2026-10-16T09:00:00Z'),
				a('new', 'warning', '2026-10-16T11:00:00Z'),
				a('bad', 'critical', '2026-10-16T08:00:00Z')
			]
		} as never)!;
		expect(list.map((x) => x.id)).toEqual(['bad', 'new', 'old']);
	});

	it('a card shows its device’s most serious alert', () => {
		const m = byDevice([
			a('w', 'warning', '2026-10-16T11:00:00Z', 'garage'),
			a('c', 'critical', '2026-10-16T09:00:00Z', 'garage')
		]);
		expect(m.get('garage')?.id).toBe('c');
	});
});

describe('writing a time rule', () => {
	const door = {
		device_id: 'oh1',
		name: 'Garage OH1 Door Sensor',
		available: true,
		attributes: { open: false, battery: 100 },
		schema: {
			attributes: {
				open: {
					kind: 'bool',
					states: { when_true: { label: 'Open' }, when_false: { label: 'Closed' } }
				},
				battery: { kind: 'integer', category: 'diagnostic' },
				mode: { kind: 'enum', options: ['home', { value: 'away', label: 'Away' }] }
			}
		}
	} as unknown as CoreDevice;

	it('offers the device’s states in its own words, not its diagnostics', () => {
		expect(stateChoices(door).map((c) => c.label)).toEqual([
			'Open',
			'Closed',
			'Mode: Home',
			'Mode: Away'
		]);
	});

	it('works from the readings when a device has no schema', () => {
		const bare = { ...door, schema: undefined, attributes: { locked: true, level: 3 } } as never;
		expect(stateChoices(bare).map((c) => c.label)).toEqual(['Locked: yes', 'Locked: no']);
	});

	it('says what a rule means', () => {
		expect(describeRule({ after: '22:00', until: '06:00', for_minutes: 10 }, 'Open')).toBe(
			'Open between 22:00 and 06:00 for 10 min'
		);
		expect(describeRule({ after: '22:00' }, 'Open')).toBe('Open after 22:00');
		expect(describeRule({ for_minutes: 30 }, 'Unlocked')).toBe('Unlocked for 30 min');
	});
});

describe('one rule, several devices', () => {
	const sensor = (device_id: string, attrs: Record<string, unknown>) =>
		({
			device_id,
			name: device_id,
			available: true,
			attributes: {},
			schema: { attributes: attrs }
		}) as unknown as CoreDevice;
	const doorA = sensor('door_a', { open: { kind: 'bool' } });
	const doorB = sensor('door_b', { open: { kind: 'bool' } });
	const lock = sensor('lock', { locked: { kind: 'bool' } });

	it('shares a state only with devices that have the same reading and value', () => {
		const open = { attribute: 'open', value: true };
		expect(devicesFor([doorA, doorB, lock], open).map((d) => d.device_id)).toEqual([
			'door_a',
			'door_b'
		]);
		expect(sameState(open, { attribute: 'open', value: false })).toBe(false);
		expect(
			sameState({ attribute: 'mode', value: 'away' }, { attribute: 'mode', value: 'away' })
		).toBe(true);
	});

	it('names itself from what it watches when its maker doesn’t', () => {
		expect(ruleName(['Garage Door'], 'Open after 22:00')).toBe('Garage Door: Open after 22:00');
		expect(ruleName(['Garage Door', 'Back Door'], 'Open')).toBe('Garage Door, Back Door: Open');
		expect(ruleName(['A', 'B', 'C'], 'Open')).toBe('A and 2 more: Open');
	});
});

describe('levels, ignores and acknowledgements (0.1.81)', () => {
	const freezer = {
		device_id: 'freezer',
		name: 'Freezer',
		available: true,
		attributes: { temperature: -18, battery_pct: 80 },
		schema: {
			attributes: {
				temperature: { kind: 'float', unit: '°C', display_name: 'Temperature' },
				battery_pct: { kind: 'integer', unit: '%', category: 'diagnostic' }
			}
		}
	} as unknown as CoreDevice;

	it('a reading is watched going over or under a line', () => {
		const c = levelChoices(freezer);
		expect(c.map((x) => x.label)).toEqual(['Temperature above', 'Temperature below']);
		expect(levelLabel(c[0]!, -10)).toBe('Temperature above -10 °C');
		expect(sameState(c[0]!, { attribute: 'temperature', value: -5, op: 'above' })).toBe(true);
		expect(sameState(c[0]!, c[1]!)).toBe(false);
		expect(devicesFor([freezer], { attribute: 'temperature', value: 0, op: 'below' })).toHaveLength(
			1
		);
	});

	const low: Alert = {
		id: 'low_battery:lock',
		kind: 'low_battery',
		device_id: 'lock',
		message: 'Front Lock: battery low',
		reason: 'Battery low',
		severity: 'warning',
		raised_at: '2026-10-18T10:00:00Z'
	};
	const ruled: Alert = { ...low, id: 'rule:r1:lock', kind: 'rule', rule_id: 'r1' };

	it('an alert is ignored just so, every one of its kind, or its whole device', () => {
		expect(ignoreFor(low, 'this')).toEqual({ kind: 'low_battery', device_id: 'lock' });
		expect(ignoreFor(low, 'kind')).toEqual({ kind: 'low_battery' });
		expect(ignoreFor(low, 'device', '2026-10-25T00:00:00Z')).toEqual({
			device_id: 'lock',
			until: '2026-10-25T00:00:00Z'
		});
		expect(ignoreFor(ruled, 'this')).toEqual({ rule_id: 'r1', device_id: 'lock' });
		expect(ignoreFor(ruled, 'kind')).toEqual({ rule_id: 'r1' });
	});

	it('an ignore reads as a sentence', () => {
		const name = (id: string) => (id === 'lock' ? 'Front Lock' : id);
		const rule = (id: string) => (id === 'r1' ? 'Garage at night' : undefined);
		const say = (i: Omit<AlertIgnore, 'id'>) => describeIgnore({ id: 'x', ...i }, name, rule);
		expect(say({ kind: 'low_battery' })).toBe('Every low battery');
		expect(say({ kind: 'low_battery', device_id: 'lock' })).toBe('Low battery on Front Lock');
		expect(say({ device_id: 'lock' })).toBe('Everything about Front Lock');
		expect(say({ rule_id: 'r1' })).toBe('Everything “Garage at night” raises');
		expect(say({ rule_id: 'gone', device_id: 'lock' })).toBe('“a deleted rule” on Front Lock');
		expect(say({ kind: 'offline', until: 'Sunday' })).toBe('Every offline, until Sunday');
		expect(ranOut({ id: 'x', until: '2026-10-18T00:00:00Z' }, Date.parse('2026-10-19'))).toBe(true);
		expect(ranOut({ id: 'x' }, Date.now())).toBe(false);
	});

	it('an acknowledgement arrives as the alert raised again', () => {
		const seen = { ...low, acknowledged: { by: 'sam', at: '2026-10-18T10:05:00Z' } };
		const list = alertsAfter([low], { type: 'alert_raised', alert: seen } as never)!;
		expect(list).toHaveLength(1);
		expect(list[0]!.acknowledged?.by).toBe('sam');
	});
});
