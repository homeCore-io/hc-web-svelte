import { describe, expect, it } from 'vitest';
import { alertsAfter, byDevice, describeRule, stateChoices, type Alert } from './alerts.js';
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
