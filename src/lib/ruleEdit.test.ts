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
	whenKindOf,
	whensOf,
	withWhens,
	blankRule,
	withPickers,
	PER_MODE,
	variablesIn,
	type Lists
} from './ruleEdit.js';

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
			'restart'
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
	expect(vocabFields(spec).map((f) => f.kind)).toEqual(['number', 'json', 'number']);
	expect(newOf(spec)).toEqual({ RepeatCount: { count: 0, actions: [] } });
	expect(newOf({ tag: 'ExitRule', fields: [] })).toBe('ExitRule');
	expect(after).toEqual({ triggers: true, ifChecks: true, testDraft: true, ruleEvents: true });
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
