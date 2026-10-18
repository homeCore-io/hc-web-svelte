import { describe, expect, it } from 'vitest';
import {
	keptOf,
	auditMatches,
	auditRows,
	auditWords,
	directiveOf,
	eventRow,
	folded,
	onlyNoise,
	readLevel,
	sourceOf,
	type AuditEntry,
	type EventHouse,
	type EventRow
} from './system.js';

const text = (w: { t: string }[]) => w.map((x) => x.t).join('');

describe('the log level', () => {
	it('reads the house’s own string for what it is', () => {
		// As found on the house: two bare levels, and the last wins.
		const r = readLevel('warn,rumqttc::state=info,rumqttd=info,info');
		expect(r.preset).toBeNull();
		expect(r.level).toBe('info');
		expect(r.note).toMatch(/last one wins/);
	});

	it('knows its presets, and keeps the broker quiet in each', () => {
		expect(directiveOf('detailed')).toBe('debug,rumqttc::state=info,rumqttd=info');
		expect(readLevel(directiveOf('quiet')).preset).toBe('quiet');
		expect(readLevel('info').preset).toBe('normal');
		const set = readLevel('info,hc_core=debug');
		expect(set.preset).toBeNull();
		expect(set.note).toMatch(/hc_core=debug/);
		expect(readLevel('debug').note).toMatch(/broker/);
	});
});

describe('log lines', () => {
	it('says where a line came from', () => {
		const at = (target: string, fields?: Record<string, unknown>) =>
			sourceOf({ timestamp: '', level: 'INFO', target, message: '', fields });
		expect(at('hc_core::timer_manager')).toBe('homeCore');
		expect(at('rumqttd::router::routing')).toBe('the broker');
		expect(at('hc_yolink::bridge', { plugin_id: 'plugin.yolink' })).toBe('YoLink');
	});
});

describe('events, in words', () => {
	const house: EventHouse = {
		name: (id) => ({ fan: 'Exhaust Fan', plug: 'Office AC' })[id],
		schema: () => ({ attributes: { on: { type: 'boolean' } } }) as never,
		room: (id) => (id === 'fan' ? 'Bathroom' : undefined)
	};

	it('says what changed, and who changed it', () => {
		const r = eventRow(
			{
				type: 'device_state_changed',
				timestamp: '2026-10-17T16:19:00Z',
				device_id: 'fan',
				changed: ['on'],
				current: { on: true },
				change: { kind: 'homecore', source: 'rule', actor_name: 'Exhaust On at Close' }
			},
			house
		)!;
		expect(text(r.words)).toBe('Exhaust Fan — on · by Exhaust On at Close');
		expect(r.room).toBe('Bathroom');
		expect(
			text(eventRow({ type: 'rule_fired', rule_id: 'x', rule_name: 'Door Opened' }, house)!.words)
		).toBe('Rule Door Opened ran');
		expect(eventRow({ type: 'plugin_heartbeat' }, house)).toBeUndefined();
	});

	it('folds readings that change all the time, and repeated re-declarations', () => {
		const power = {
			type: 'device_state_changed',
			device_id: 'plug',
			changed: ['power'],
			current: { power: 30 }
		};
		expect(onlyNoise(power)).toBe(true);
		expect(onlyNoise({ ...power, changed: ['on', 'power'] })).toBe(false);
		const rows: EventRow[] = [
			...[1, 2, 3].map(() => eventRow({ ...power, timestamp: 't' }, house)!),
			...[1, 2].map(() => eventRow({ type: 'device_schema_changed', device_id: 'fan' }, house)!),
			eventRow({ type: 'rule_fired', rule_id: 'r', rule_name: 'R' }, house)!
		];
		const out = folded(rows, (r) => r.key.startsWith('d:plug'));
		expect(out).toHaveLength(3);
		expect(out[0]!.count).toBe(3);
		expect(text(out[0]!.words)).toBe('Office AC — Power changed 3 times');
		expect(text(out[1]!.words)).toBe('Exhaust Fan re-declared its controls 2 times');
		expect(out[1]!.kind).toBe('warn');
	});
});

describe('the audit, in words', () => {
	const entry = (over: Partial<AuditEntry>): AuditEntry => ({
		id: 1,
		ts: '2026-10-17T15:07:00Z',
		actor_type: 'user',
		actor_id: 'u',
		actor_label: 'user:admin',
		event_type: 'auth.login',
		target_kind: null,
		target_id: null,
		ip: null,
		user_agent: null,
		result: 'success',
		detail: {},
		...over
	});

	it('puts who did what to what as a sentence', () => {
		expect(text(auditWords(entry({})))).toBe('admin signed in');
		expect(
			text(
				auditWords(
					entry({
						event_type: 'automation.updated',
						target_kind: 'automation',
						detail: { name: 'Porch at sunset', fields: ['enabled'], enabled: false }
					})
				)
			)
		).toBe('admin turned off the rule Porch at sunset');
		expect(
			text(
				auditWords(
					entry({
						event_type: 'area.updated',
						target_kind: 'area',
						detail: { name: 'Den', renamed_to: 'Snug', fields: ['name'] }
					})
				)
			)
		).toBe('admin renamed the room Den to Snug');
		expect(
			text(
				auditWords(
					entry({ event_type: 'area.deleted', target_kind: 'area', detail: { name: 'Den' } })
				)
			)
		).toBe('admin removed the room Den');
		expect(
			text(
				auditWords(
					entry({
						result: 'denied',
						actor_type: 'anonymous',
						actor_label: 'attempted_username:bob'
					})
				)
			)
		).toBe('someone as “bob” couldn’t sign in — wrong password');
		expect(
			text(
				auditWords(entry({ event_type: 'api_key.revoked', actor_label: 'api_key:nas', detail: {} }))
			)
		).toBe('the key “nas” revoked the API key');
	});

	it('groups a day’s sign-ins, never changes', () => {
		const rows = auditRows(
			[
				entry({ id: 5, ts: '2026-10-17T16:00:00Z' }),
				entry({ id: 4, ts: '2026-10-17T15:00:00Z' }),
				entry({ id: 3, event_type: 'area.created', target_kind: 'area' }),
				entry({ id: 2, event_type: 'area.created', target_kind: 'area' }),
				entry({ id: 1, ts: '2026-10-16T12:00:00Z' })
			],
			'UTC'
		);
		expect(rows.map((r) => r.all.length)).toEqual([2, 1, 1, 1]);
	});

	it('filters by kind', () => {
		expect(auditMatches(entry({}), 'signins')).toBe(true);
		expect(auditMatches(entry({}), 'changes')).toBe(false);
		expect(auditMatches(entry({ result: 'denied' }), 'refused')).toBe(true);
		expect(auditMatches(entry({ event_type: 'scene.deleted' }), 'changes')).toBe(true);
	});
});

describe('a log level, kept', () => {
	it('is everything’s level and each module’s', () => {
		expect(keptOf('info')).toEqual({ level: 'info', targets: {} });
		expect(keptOf('debug,rumqttd=warn,hc_core::engine=trace')).toEqual({
			level: 'debug',
			targets: { rumqttd: 'warn', 'hc_core::engine': 'trace' }
		});
		expect(keptOf('hc_core=debug')).toBeNull();
	});
});
