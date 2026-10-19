import { describe, expect, test } from 'vitest';
import { DEVICES } from './fixtures/rules.js';
import {
	commandOf,
	commandsOf,
	featuresOf,
	ifChecks,
	ifCondition,
	keepExtras,
	momentOf,
	momentsOf,
	newOf,
	problemsOf,
	rebuild,
	stateOf,
	statesOf,
	stepKindOf,
	vocabFields,
	buttonsOf,
	whenKindOf,
	whensOf,
	withWhens,
	blankRule,
	withPickers,
	PER_MODE,
	variablesIn,
	webhookAddress,
	webhookName,
	webhookProblem,
	newWhen,
	newStep,
	offered,
	checkKindOf,
	WHEN_KINDS,
	type Lists,
	type VariantSpec
} from './ruleEdit.js';
import type { CoreDevice } from './devices.js';

const d = (id: string) => DEVICES.find((x) => x.device_id === id)!;
const labels = (xs: { label: string }[]) => xs.map((x) => x.label);
const before = featuresOf({ triggers: [], conditions: [], actions: [] });
const after = featuresOf({
	triggers: [],
	conditions: [],
	actions: [],
	features: ['triggers', 'if_checks', 'test_draft', 'rule_events']
});

describe('a device’s moments, in its own words', () => {
	test('a door opens and closes; a keypad button is pressed; a sensor rises above', () => {
		expect(labels(momentsOf(d('zz_door_1'))).slice(0, 2)).toEqual(['opens', 'closes']);
		expect(labels(momentsOf(d('zz_keypad')))).toContain('button 1 is pressed');
		expect(labels(momentsOf(d('timer_den_fan')))).toContain('finishes');
		expect(labels(momentsOf(d('zz_air')))).toContain('humidity rises above…');
	});

	test('built and read back the same', () => {
		for (const dev of [d('zz_door_1'), d('zz_keypad'), d('zz_air'), d('zz_lamp_1')])
			for (const m of momentsOf(dev)) {
				const t = m.build([dev.device_id], { for: m.lasting ? 300 : undefined, value: 30 });
				const read = momentOf(t);
				expect(read?.key, `${dev.name} ${m.label}`).toBe(m.key);
				expect(whenKindOf(t)).toBe('device');
			}
	});

	test('several devices, and what the editor doesn’t draw, are kept', () => {
		const m = momentsOf(d('zz_door_1'))[0]!;
		const t = m.build(['zz_door_1', 'zz_door_2'], {});
		expect(t).toEqual({
			DeviceStateChanged: {
				device_id: 'zz_door_1',
				device_ids: ['zz_door_2'],
				attribute: 'open',
				to: true
			}
		});
		const before = {
			DeviceStateChanged: {
				device_id: 'zz_door_1',
				attribute: 'open',
				to: false,
				change_kind: 'physical'
			}
		};
		expect(keepExtras(before, t).DeviceStateChanged.change_kind).toBe('physical');
		expect(
			momentOf({ DeviceStateChanged: { device_id: 'x', attribute: 'open', from: true } })
		).toBeUndefined();
	});
});

describe('checks about a device', () => {
	test('in its own words, built and read back', () => {
		expect(labels(statesOf(d('zz_door_1')))).toEqual(['is open', 'is closed']);
		for (const s of statesOf(d('zz_air')))
			expect(stateOf(s.build('zz_air', { value: 35 }))?.key).toBe(s.key);
	});

	test('a mode is checked as a mode', () => {
		const on = statesOf(d('mode_night'))[0]!;
		expect(on.build('mode_night', {})).toEqual({ ModeIs: { mode_id: 'mode_night', on: true } });
		expect(stateOf({ ModeIs: { mode_id: 'mode_night', on: false } })?.key).toBe('is:on:false');
	});
});

describe('what a device can be told', () => {
	test('on and off, levels, its declared actions, a timer’s commands', () => {
		expect(labels(commandsOf(d('zz_lamp_1')))).toEqual(['turn on', 'turn off', 'set brightness']);
		expect(labels(commandsOf(d('zz_speaker_den')))).toEqual([
			'set volume',
			'set volume',
			'play a favourite'
		]);
		expect(labels(commandsOf({ ...d('timer_den_fan'), plugin_id: 'core.glue' }))).toEqual([
			'start',
			'cancel',
			'pause',
			'resume',
			'restart',
			'add time to'
		]);
		expect(commandsOf(d('zz_door_1'))).toEqual([]);
	});

	test('a command is read back from the rule, in either form', () => {
		const led = commandsOf(d('zz_keypad'));
		const keyed = { set_led: { button: 1, state: 1 } };
		const found = commandOf(led, keyed)!;
		expect(found.cmd.key).toBe('act:set_led');
		expect(found.values).toEqual({ button: 1, state: '1' });
		// Changing a value keeps the rule's own form.
		expect(rebuild(found.cmd, { ...found.values, state: '0' }, keyed)).toEqual({
			set_led: { button: 1, state: 0 }
		});
		expect(rebuild(found.cmd, { button: 2, state: '1' }, { on: true })).toEqual({
			action: 'set_led',
			button: 2,
			state: '1'
		});
		const vol = commandOf(commandsOf(d('zz_speaker_den')), { action: 'set_volume', volume: 15 })!;
		expect(vol.values).toEqual({ volume: 15 });
	});
});

describe('if/otherwise asks', () => {
	const checks = [
		{ DeviceState: { device_id: 'zz_door_1', attribute: 'open', op: 'Eq', value: true } },
		{ ModeIs: { mode_id: 'mode_night', on: true } }
	];

	test('checks, on a homeCore that takes them', () => {
		expect(ifCondition(checks.slice(0, 1), after)).toEqual(checks[0]);
		expect(ifCondition(checks, after)).toEqual({ And: { conditions: checks } });
		expect(ifChecks({ And: { conditions: checks } })).toEqual(checks);
	});

	test('a script before that, read back as the same checks', () => {
		const script = ifCondition(checks, before);
		expect(script).toBe(
			'device_state("zz_door_1")["open"] == true && device_state("mode_night")["on"] == true'
		);
		expect(ifChecks(script)).toEqual(checks);
		expect(
			ifCondition([{ TimeWindow: { start: '06:00:00', end: '12:00:00' } }], before)
		).toBeUndefined();
		expect(ifChecks('hour() > 6')).toBeUndefined();
		expect(ifChecks('')).toEqual([]);
	});
});

describe('the whole rule', () => {
	test('moments as one list', () => {
		const r = blankRule('x');
		const two = withWhens(r, [
			'SystemStarted',
			{ SunEvent: { event: 'Sunset', offset_minutes: 0 } }
		]);
		expect(two.trigger).toBe('SystemStarted');
		expect(whensOf(two)).toHaveLength(2);
		expect('triggers' in withWhens(two, ['SystemStarted'])).toBe(false);
	});

	test('what stops it being saved', () => {
		const has = (id: string) => DEVICES.some((x) => x.device_id === id);
		expect(problemsOf(blankRule(''), has)).toEqual([
			'It needs a name.',
			'A part still needs its device chosen.',
			'It doesn’t do anything yet — add a step.'
		]);
		const ok = {
			...blankRule('Lamp'),
			trigger: momentsOf(d('zz_door_1'))[0]!.build(['zz_door_1'], {}),
			actions: [
				{
					enabled: true,
					action: {
						SetDeviceState: { device_id: 'nope', state: { on: true }, track_event_value: false }
					}
				}
			]
		};
		expect(problemsOf(ok, has)).toEqual(['It names “nope”, which the house doesn’t have.']);
	});

	test('step kinds', () => {
		expect(stepKindOf({ ActivateScenePerMode: { modes: [], default_scene_id: 's' } })).toBe(
			'scene'
		);
		expect(
			stepKindOf({ ActivateScenePerMode: { modes: [{ mode: 'night', scene_id: 's' }] } })
		).toBe('other');
		expect(stepKindOf('ExitRule')).toBe('other');
	});
});

test('the rest of the vocabulary, as fields', () => {
	const spec = {
		tag: 'RepeatCount',
		fields: [
			{ name: 'count', type: 'integer', required: true },
			{ name: 'actions', type: 'array', required: true },
			{ name: 'interval_ms', type: 'integer', required: false }
		]
	};
	expect(vocabFields(spec).map((f) => f.kind)).toEqual(['number', 'json', 'duration']);
	expect(newOf(spec)).toEqual({ RepeatCount: { count: 0, actions: [] } });
	expect(newOf({ tag: 'ExitRule', fields: [] })).toBe('ExitRule');
	expect(after).toEqual({
		triggers: true,
		ifChecks: true,
		testDraft: true,
		ruleEvents: true,
		runNow: false,
		testAt: false,
		ifAnyCheck: false,
		alertRules: false
	});
	expect(
		featuresOf({
			triggers: [],
			conditions: [],
			actions: [],
			features: ['run_now', 'test_at', 'alert_rules']
		})
	).toMatchObject({ runNow: true, testAt: true, alertRules: true });
});

describe('pickers for what a field names', () => {
	const lists: Lists = {
		rules: [
			{ id: 'r2', name: 'Porch at sunset' },
			{ id: 'r1', name: 'Garage close' }
		],
		calendars: ['bins', 'holidays'],
		modes: [{ id: 'mode_night', name: 'Night Mode' }],
		variables: { hub: ['guests'], private: ['armed'], rule: ['count'] }
	};
	const text = (name: string) => ({ kind: 'text' as const, name, label: name });

	test('chooses a rule, a calendar, a mode by name', () => {
		const r = withPickers('PauseRule', text('rule_id'), lists);
		expect(r).toMatchObject({ kind: 'choice', label: 'Rule' });
		expect(r.kind === 'choice' && r.options.map((o) => o.label)).toEqual([
			'Garage close',
			'Porch at sunset'
		]);
		expect(withPickers('CalendarActive', text('calendar_id'), lists)).toMatchObject({
			kind: 'choice',
			options: [
				{ value: 'bins', label: 'bins' },
				{ value: 'holidays', label: 'holidays' }
			]
		});
		expect(withPickers('X', text('mode_id'), lists)).toMatchObject({ kind: 'choice' });
		expect(withPickers('CaptureDeviceState', text('device_ids'), lists)).toMatchObject({
			kind: 'devices'
		});
	});

	test('suggests variable names of the right sort, and leaves other fields alone', () => {
		expect(withPickers('SetHubVariable', text('name'), lists)).toMatchObject({
			suggest: ['guests']
		});
		expect(withPickers('PrivateBooleanIs', text('name'), lists)).toMatchObject({
			suggest: ['armed']
		});
		expect(withPickers('Notify', text('name'), lists)).toEqual(text('name'));
		// No calendars known: still words, so a rule can name one not loaded yet.
		expect(
			withPickers('CalendarEvent', text('calendar_id'), { ...lists, calendars: [] })
		).toMatchObject({ kind: 'text' });
	});

	test('steps and checks inside a part get the editor’s own forms', () => {
		const json = (name: string) => ({ kind: 'json' as const, name, label: name });
		expect(withPickers('RepeatCount', json('actions'), lists)).toMatchObject({
			kind: 'steps',
			label: 'Steps'
		});
		expect(withPickers('PingHost', json('else_actions'), lists)).toMatchObject({
			kind: 'steps',
			label: 'If it doesn’t answer'
		});
		expect(withPickers('Xor', json('conditions'), lists)).toMatchObject({
			kind: 'checks',
			label: 'Exactly one of these'
		});
		expect(withPickers('Not', json('condition'), lists)).toMatchObject({ kind: 'check' });
		// A script's condition stays words.
		expect(withPickers('RepeatUntil', text('condition'), lists)).toEqual(text('condition'));
		expect(PER_MODE.has('DelayPerMode')).toBe(true);
	});

	test('finds the variable names the house’s rules use', () => {
		const rules = [
			{
				trigger: { HubVariableChanged: { name: 'guests' } },
				actions: [
					{
						action: {
							Conditional: {
								condition: { PrivateBooleanIs: { name: 'armed', value: true } },
								then_actions: [{ SetVariable: { name: 'count', op: 'Set', value: 1 } }]
							}
						}
					}
				]
			}
		];
		expect(variablesIn(rules)).toEqual({ hub: ['guests'], private: ['armed'], rule: ['count'] });
	});
});

describe('helpers, told what homeCore understands', () => {
	const helper = (id: string, device_type: string, attributes: Record<string, unknown> = {}) =>
		({ device_id: id, plugin_id: 'core.glue', device_type, name: id, attributes }) as never;

	test('a counter resets; a number has no reset to give (glue/number.rs drops it)', () => {
		expect(labels(commandsOf(helper('counter_x', 'counter')))).toContain('reset');
		expect(labels(commandsOf(helper('number_x', 'number')))).toEqual([
			'add one to',
			'take one from',
			'set to'
		]);
	});

	test('a choice list is set to one of its choices, or stepped on and back', () => {
		const cs = commandsOf(helper('select_house', 'select', { options: ['Home', 'Away'] }));
		expect(labels(cs)).toEqual([
			'set to',
			'move on to the next choice of',
			'move back to the previous choice of'
		]);
		const set = cs[0]!;
		expect(set.fields[0]).toMatchObject({
			kind: 'choice',
			options: [{ value: 'Home' }, { value: 'Away' }]
		});
		expect(set.build({ option: 'Away' })).toEqual({ command: 'select', option: 'Away' });
		expect(commandOf(cs, { command: 'select', option: 'Away' })?.values).toEqual({
			option: 'Away'
		});
		expect(commandOf(cs, { command: 'next' })?.cmd.key).toBe('cmd:next');
	});

	test('words and dates are set or cleared', () => {
		for (const type of ['text', 'datetime']) {
			const cs = commandsOf(helper(`${type}_x`, type));
			expect(labels(cs)).toEqual(['set to', 'clear']);
			expect(cs[0]!.build({ value: '08:00:00' })).toEqual({ command: 'set', value: '08:00:00' });
			expect(cs[1]!.build({})).toEqual({ command: 'clear' });
		}
	});
});

describe('homeCore’s fixed lists, as choices', () => {
	const lists: Lists = {
		rules: [],
		calendars: [],
		modes: [],
		variables: { hub: [], private: [], rule: [] }
	};
	const text = (name: string) => ({ kind: 'text' as const, name, label: name });
	const json = (name: string) => ({ kind: 'json' as const, name, label: name });
	const values = (f: unknown) =>
		(f as { options: { value: string }[] }).options.map((o) => o.value);

	test('a log message’s level is spelled as homeCore’s LogLevel — Info, not info', () => {
		const f = withPickers('LogMessage', text('level'), lists);
		expect(f).toMatchObject({ kind: 'choice', optional: true });
		expect(values(f)).toEqual(['Trace', 'Debug', 'Info', 'Warn', 'Error']);
	});

	test('what had to be typed exactly is chosen', () => {
		expect(values(withPickers('ButtonEvent', text('event'), lists))).toEqual([
			'Pushed',
			'Held',
			'DoubleTapped',
			'Released'
		]);
		expect(values(withPickers('NumericThreshold', text('op'), lists))).toContain('CrossesAbove');
		expect(values(withPickers('DeviceState', text('op'), lists))).toEqual([
			'Eq',
			'Ne',
			'Gt',
			'Gte',
			'Lt',
			'Lte'
		]);
		expect(values(withPickers('DeviceLastChange', text('kind'), lists))).toContain('physical');
		expect(values(withPickers('SetVariable', json('op'), lists))).toContain('Toggle');
		expect(values(withPickers('CallService', text('method'), lists))).toContain('POST');
		// Another kind's `op` is its own business.
		expect(withPickers('Comment', text('op'), lists)).toEqual(text('op'));
	});

	test('one value is typed plainly; a reading is suggested from the device', () => {
		expect(withPickers('DeviceState', json('value'), lists)).toMatchObject({ kind: 'value' });
		expect(withPickers('DeviceStateChanged', json('not_from'), lists)).toMatchObject({
			kind: 'value'
		});
		// A fade's target is one value too: 0, 40, "warm".
		expect(withPickers('FadeDevice', json('target'), lists)).toMatchObject({ kind: 'value' });
		expect(
			withPickers('TimeElapsed', text('attribute'), { ...lists, attributes: ['battery', 'on'] })
		).toMatchObject({ kind: 'text', label: 'Reading', suggest: ['battery', 'on'] });
	});
});

describe('times, and buttons by name', () => {
	test('seconds and milliseconds are lengths of time', () => {
		const spec = {
			tag: 'WaitForExpression',
			fields: [
				{ name: 'timeout_ms', type: 'integer', required: false },
				{ name: 'for_duration_secs', type: 'integer', required: false },
				{ name: 'count', type: 'integer', required: true }
			]
		} as VariantSpec;
		expect(vocabFields(spec)).toEqual([
			{ kind: 'duration', name: 'timeout_ms', label: 'Timeout', optional: true, ms: true },
			{ kind: 'duration', name: 'for_duration_secs', label: 'For', optional: true },
			{ kind: 'number', name: 'count', label: 'Count', optional: false }
		]);
	});

	test('a keypad’s buttons are offered by their names', () => {
		const keypad = {
			...d('zz_keypad'),
			button_names: { '1': 'Lights', '3': 'Fan' }
		};
		expect(buttonsOf(keypad).find((b) => b.value === '1')).toEqual({
			value: '1',
			label: '1 — Lights'
		});
		expect(buttonsOf(keypad).map((b) => b.value)).toContain('3');
		const lists: Lists = {
			rules: [],
			calendars: [],
			modes: [],
			variables: { hub: [], private: [], rule: [] },
			buttons: buttonsOf(keypad)
		};
		expect(
			withPickers('ButtonEvent', { kind: 'number', name: 'button_number', label: 'B' }, lists)
		).toMatchObject({ kind: 'choice', numeric: true, label: 'Button' });
	});
});

describe('a webhook', () => {
	test('a new one gets a name hard to guess, which passes its own checks', () => {
		const a = webhookName();
		expect(a).toMatch(/^hook-[a-z0-9]{10}$/);
		expect(webhookName()).not.toBe(a);
		expect(webhookProblem(a)).toBeNull();
		expect(newWhen('webhook')).toMatchObject({
			WebhookReceived: { path: expect.stringMatching(/^hook-/) }
		});
		expect(whenKindOf({ WebhookReceived: { path: a } })).toBe('webhook');
	});

	test('a name homeCore wouldn’t match, or the app wouldn’t pass on, is said so', () => {
		expect(webhookProblem('')).toBe('It needs a name.');
		expect(webhookProblem('/garage-door-opener')).toMatch(/Leave out the “\/”/);
		expect(webhookProblem('garage door')).toMatch(/no spaces/);
		expect(webhookProblem('.hidden-name-here')).toMatch(/only/);
		expect(webhookProblem('garage')).toMatch(/easy to guess/);
	});

	test('its address is this app’s, under homeCore’s webhooks', () => {
		expect(webhookAddress('http://10.0.10.150:3001', 'hook-abc')).toBe(
			'http://10.0.10.150:3001/api/v1/webhooks/hook-abc'
		);
	});

	test('a rule with a broken webhook name can’t be saved; a short one only warns', () => {
		const rule = (path: string) =>
			({
				name: 'Doorbell',
				trigger: { WebhookReceived: { path } },
				conditions: [],
				actions: [{ action: { Comment: { text: 'x' } } }]
			}) as never;
		expect(problemsOf(rule('/doorbell-ring-x'), () => true)).toEqual([
			'A webhook’s name: Leave out the “/” — homeCore matches the name exactly.'
		]);
		expect(problemsOf(rule('doorbell'), () => true)).toEqual([]);
	});
});

describe('alerts and WLED controllers in rules', () => {
	const it = test;
	const wled = {
		device_id: 'wled_1',
		name: 'Eaves lights',
		plugin_id: 'plugin.wled',
		available: true,
		attributes: {
			presets: [
				{ id: 14, name: 'Halloween 1', kind: 'look' },
				{ id: 20, name: 'Halloween night', kind: 'playlist' }
			]
		},
		schema: {
			attributes: {
				preset_id: { kind: 'integer', writable: true, display_name: 'Preset' },
				on: { kind: 'bool', writable: true }
			}
		}
	} as unknown as CoreDevice;

	it('a WLED offers its presets and playlists by name, and never “preset rises above”', () => {
		const m = momentsOf(wled).map((x) => x.label);
		expect(m).toContain('starts preset “Halloween 1”');
		expect(m).toContain('starts playlist “Halloween night”');
		expect(m.some((l) => l.startsWith('preset rises'))).toBe(false);
		const s = statesOf(wled);
		const running = s.find((x) => x.label === 'is running preset “Halloween 1”')!;
		const c = running.build('wled_1', {});
		expect(c).toEqual({
			DeviceState: { device_id: 'wled_1', attribute: 'preset_id', op: 'Eq', value: 14 }
		});
		expect(stateOf(c)?.key).toBe(running.key);
	});

	it('the alert kinds are only offered by a homeCore that has them', () => {
		const on = featuresOf({ triggers: [], conditions: [], actions: [], features: ['alert_rules'] });
		const off = featuresOf({ triggers: [], conditions: [], actions: [], features: [] });
		expect(offered(WHEN_KINDS, on).some((k) => k.kind === 'alert')).toBe(true);
		expect(offered(WHEN_KINDS, off).some((k) => k.kind === 'alert')).toBe(false);
		// …unless the rule already has one.
		expect(offered(WHEN_KINDS, off, 'alert').some((k) => k.kind === 'alert')).toBe(true);
		expect(whenKindOf({ AlertCleared: { filter: {} } })).toBe('alert');
		expect(checkKindOf('TriggerAlertActive')).toBe('alert');
		expect(stepKindOf({ ForEachAlert: { filter: {}, actions: [] } })).toBe('alert');
		expect(newStep('alert')).toEqual({ PressAlert: {} });
	});
});
