import { describe, expect, test } from 'vitest';
import type { Alert, AlertRule } from './alerts.js';
import type { CoreDevice } from './devices.js';
import {
	bySource,
	cardLine,
	draftOf,
	matches,
	placeOf,
	readStart,
	scopesForAlert,
	scopesForKind,
	scopesForRule,
	startHref,
	startOf,
	startedBy,
	startsText,
	triggerOf,
	type AutomationAlerts,
	type Names
} from './alertStarts.js';

const dev = (id: string, name: string, plugin: string, attrs: Record<string, unknown> = {}) =>
	({ device_id: id, name, plugin_id: plugin, available: true, attributes: attrs }) as CoreDevice;
const DEVICES = [
	dev('dish', 'Dishwasher Leak Sensor', 'plugin.yolink', { water_detected: true }),
	dev('sink', 'Kitchen Sink Leak Sensor', 'plugin.yolink', { water_detected: false }),
	dev('freezer', 'Garage Freezer Temperature', 'plugin.yolink', { temperature: -4 }),
	dev('porch', 'Porch light', 'plugin.hue', { on: false }),
	dev('eaves', 'Eaves lights', 'plugin.wled', {})
];
const RULES: AlertRule[] = [
	{
		id: 'r1',
		name: 'Freezer warming up',
		enabled: true,
		device_ids: ['freezer'],
		attribute: 'temperature',
		value: -10,
		op: 'above',
		severity: 'warning'
	},
	{
		id: 'r2',
		name: 'Garage door left open at night',
		enabled: false,
		device_ids: ['freezer'],
		attribute: 'open',
		value: true,
		severity: 'warning'
	}
];
const names: Names = {
	device: (id) => DEVICES.find((d) => d.device_id === id),
	deviceName: (id) => DEVICES.find((d) => d.device_id === id)?.name ?? id,
	pluginName: (id) =>
		({ 'plugin.yolink': 'YoLink', 'plugin.hue': 'Hue', 'plugin.wled': 'WLED' })[id] ?? id,
	devices: DEVICES,
	rules: RULES,
	topicLabel: (p, t) => (t === 'firmware_update' ? 'Firmware update available' : undefined)
};
const alert = (over: Partial<Alert>): Alert => ({
	id: 'x',
	kind: 'wet',
	device_id: 'dish',
	message: 'Dishwasher Leak Sensor: wet',
	reason: 'Wet',
	severity: 'critical',
	raised_at: '2026-10-21T10:00:00Z',
	device_plugin_id: 'plugin.yolink',
	...over
});

describe('“For”: this one, any like it, broader', () => {
	test('one of homeCore’s own kinds', () => {
		const s = scopesForAlert(alert({}), names);
		expect(s.map((x) => x.name)).toEqual([
			'Only Dishwasher Leak Sensor',
			'Any YoLink leak sensor',
			'Anything wet in the house'
		]);
		expect(s[1]!.help).toBe('2 sensors now, and any you add later');
		expect(s.map((x) => x.filter)).toEqual([
			{ kind: 'wet', device_ids: ['dish'] },
			{ kind: 'wet', plugin_id: 'plugin.yolink' },
			{ kind: 'wet' }
		]);
	});

	test('offline reads this one, any, then one plugin’s', () => {
		const s = scopesForAlert(
			alert({ kind: 'offline', device_id: 'porch', device_plugin_id: 'plugin.hue' }),
			names
		);
		expect(s.map((x) => x.name)).toEqual([
			'Only Porch light',
			'Any device going offline',
			'Any Hue device going offline'
		]);
		expect(s[2]!.filter).toEqual({ kind: 'offline', plugin_id: 'plugin.hue' });
	});

	test('an alert rule’s', () => {
		const s = scopesForAlert(alert({ kind: 'rule', rule_id: 'r1', severity: 'warning' }), names);
		expect(s.map((x) => x.name)).toEqual([
			'Only this rule, “Freezer warming up”',
			'Any of your alert rules',
			'Anything this serious or worse'
		]);
		expect(s[0]!.help).toBe('Garage Freezer Temperature');
		expect(s[1]!.help).toBe('All 2 rules');
		expect(s[2]!.help).toBe('Warnings and above, from anywhere');
		expect(s[2]!.filter).toEqual({ min_severity: 'warning' });
	});

	test('a plugin’s, from its own fields only', () => {
		const s = scopesForAlert(
			alert({
				kind: 'plugin',
				device_id: 'eaves',
				plugin_id: 'plugin.wled',
				topic: 'firmware_update',
				key: '17.0.0',
				severity: 'info'
			}),
			names
		);
		expect(s.map((x) => x.filter)).toEqual([
			{ kind: 'plugin', plugin_id: 'plugin.wled', topic: 'firmware_update', device_ids: ['eaves'] },
			{ kind: 'plugin', plugin_id: 'plugin.wled', topic: 'firmware_update' },
			{ min_severity: 'info' }
		]);
		expect(s[1]!.name).toBe('Firmware update available on any WLED device');
	});

	test('from a rule’s or a kind’s row, with no alert', () => {
		expect(scopesForRule(RULES[0]!, names)[0]!.filter).toEqual({ kind: 'rule', rule_id: 'r1' });
		expect(scopesForKind('wet', names).map((x) => x.name)).toEqual([
			'Anything wet in the house',
			'Any YoLink leak sensor'
		]);
	});
});

describe('making the automation', () => {
	test('its trigger, from “When it”', () => {
		const f = { kind: 'wet' as const, device_ids: ['dish'] };
		expect(triggerOf('raised', f)).toEqual({ AlertRaised: { filter: f } });
		expect(triggerOf('cleared', f)).toEqual({ AlertCleared: { filter: f } });
		expect(triggerOf('still', f, 15)).toEqual({ AlertActiveFor: { filter: f, minutes: 15 } });
		expect(triggerOf('raised', { kind: 'wet', device_ids: [] })).toEqual({
			AlertRaised: { filter: { kind: 'wet' } }
		});
	});

	test('named for what starts it, and carried to the editor in its address', () => {
		const [one] = scopesForAlert(alert({}), names);
		const s = startOf(one!, 'raised', 10, 'own', placeOf(alert({})));
		expect(s.name).toBe('When Dishwasher Leak Sensor is wet');
		expect(s.banner).toBe('wet — Dishwasher Leak Sensor');
		expect(s.href).toBe('/settings/alerts#kind-wet');
		expect(startOf(one!, 'still', 10, 'own', '').name).toBe(
			'When the wet alert for Dishwasher Leak Sensor is still on after 10 min'
		);
		const back = readStart(decodeURIComponent(startHref(s).split('alert=')[1]!));
		expect(back).toEqual(s);
		expect(readStart('not json')).toBeNull();
		const draft = draftOf(s, { id: '', name: '', enabled: true, trigger: 'ManualTrigger' });
		expect(draft.trigger).toEqual({
			AlertRaised: { filter: { kind: 'wet', device_ids: ['dish'] } }
		});
		expect(draft.name).toBe(s.name);
	});
});

describe('what an alert starts', () => {
	const flash: AutomationAlerts = {
		id: 'a1',
		name: 'Freezer — flash garage light',
		enabled: true,
		links: [{ index: 0, when: 'raised', filter: { rule_id: 'r1' }, sources: ['rule:r1'] }],
		other_triggers: 0,
		waiting: false,
		alert_deleted: false
	};
	const leaks: AutomationAlerts = {
		...flash,
		id: 'a2',
		name: 'Any YoLink leak',
		links: [
			{
				index: 0,
				when: 'raised',
				filter: { kind: 'wet', plugin_id: 'plugin.yolink' },
				sources: ['kind:wet']
			}
		]
	};

	test('matches as homeCore does, a plugin meaning its devices for homeCore’s own kinds', () => {
		expect(matches({ kind: 'wet', plugin_id: 'plugin.yolink' }, alert({}))).toBe(true);
		expect(matches({ kind: 'wet', plugin_id: 'plugin.hue' }, alert({}))).toBe(false);
		expect(matches({ min_severity: 'error' }, alert({ severity: 'warning' }))).toBe(false);
		expect(startedBy(alert({}), [flash, leaks]).map((x) => x.id)).toEqual(['a2']);
		expect(startsText([flash])).toBe('Starts 1 automation: Freezer — flash garage light');
	});

	test('grouped by what raises the alert', () => {
		const m = bySource([flash, leaks]);
		expect(m.get('rule:r1')!.map((x) => x.id)).toEqual(['a1']);
		expect(m.get('kind:wet')!.map((x) => x.id)).toEqual(['a2']);
	});

	test('a card says which alert, or that it waits, or that it was deleted', () => {
		expect(cardLine(flash, names)).toEqual({
			text: 'Started by the alert “Freezer warming up”',
			tone: 'by'
		});
		const waiting = {
			...flash,
			waiting: true,
			links: [{ ...flash.links[0]!, filter: { rule_id: 'r2' }, waiting: 'off' as const }]
		};
		expect(cardLine(waiting, names).text).toBe(
			'Its alert “Garage door left open at night” is turned off'
		);
		expect(cardLine({ ...flash, alert_deleted: true }, names).tone).toBe('bad');
		expect(cardLine({ ...leaks, other_triggers: 1 }, names).text).toBe(
			'Started by the alert “Wet” from YoLink, or something else'
		);
	});
});
