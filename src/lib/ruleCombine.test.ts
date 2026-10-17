import { describe, expect, test } from 'vitest';
import { DEVICES, RULES } from './fixtures/rules.js';
import { PATTERNS, combine, stateAfter } from './ruleCombine.js';
import { featuresOf, problemsOf } from './ruleEdit.js';
import { houseOf } from './ruleList.js';
import { plain, sentence, type Rule } from './ruleWords.js';

const yes = featuresOf({
	triggers: [],
	conditions: [],
	actions: [],
	features: ['triggers', 'if_checks']
});
const no = featuresOf({ triggers: [], conditions: [], actions: [] });
const h = houseOf(Object.fromEntries(DEVICES.map((d) => [d.device_id, d])));
const rule = (id: string) => RULES.find((r) => r.id === id)!;
const set = (device_id: string, state: unknown) => ({
	enabled: true,
	action: { SetDeviceState: { device_id, state, track_event_value: false } }
});

test('the state a moment leaves behind', () => {
	expect(stateAfter({ DeviceStateChanged: { device_id: 'a', attribute: 'on', to: true } })).toEqual(
		{ DeviceState: { device_id: 'a', attribute: 'on', op: 'Eq', value: true } }
	);
	expect(
		stateAfter({
			DeviceStateChanged: { device_id: 'a', device_ids: ['b'], attribute: 'open', to: false }
		})
	).toEqual({
		Or: {
			conditions: [
				{ DeviceState: { device_id: 'a', attribute: 'open', op: 'Eq', value: false } },
				{ DeviceState: { device_id: 'b', attribute: 'open', op: 'Eq', value: false } }
			]
		}
	});
	expect(stateAfter('SystemStarted')).toBeUndefined();
	expect(stateAfter({ DeviceStateChanged: { device_id: 'a', attribute: 'on' } })).toBeUndefined();
});

describe('combining a family', () => {
	test('a keypad button’s on and off: one moment, each part its own checks', () => {
		const done = combine([rule('r-btn-on'), rule('r-btn-off')], 'Keypad Btn1 - Den', yes);
		if ('reason' in done) throw new Error(done.reason);
		expect(done.rule.triggers).toBeUndefined();
		expect(plain(sentence(h, done.rule))).toBe(
			'When Den Keypad button 1 is pressed → if all of: Reading Lamp is off and Corner Lamp is off: turn Reading Lamp on, turn Corner Lamp on and set the LED of button 1 on Den Keypad to On and if any of: Reading Lamp is on or Corner Lamp is on: turn Reading Lamp off and turn Corner Lamp off'
		);
		expect(done.rule.tags).toEqual(['den']);
	});

	test('an LED following a lamp: two moments, told apart by what each leaves behind', () => {
		const on: Rule = {
			...rule('r-door'),
			id: 'a',
			name: 'LED on',
			trigger: { DeviceStateChanged: { device_id: 'zz_lamp_1', attribute: 'on', to: true } },
			actions: [set('zz_keypad', { set_led: { button: 2, state: 1 } })]
		};
		const off: Rule = {
			...on,
			id: 'b',
			name: 'LED off',
			trigger: { DeviceStateChanged: { device_id: 'zz_lamp_1', attribute: 'on', to: false } },
			actions: [set('zz_keypad', { set_led: { button: 2, state: 0 } })]
		};
		const done = combine([on, off], 'LED', yes);
		if ('reason' in done) throw new Error(done.reason);
		expect(done.rule.triggers).toHaveLength(1);
		expect(plain(sentence(h, done.rule))).toBe(
			'When Reading Lamp turns on, or when Reading Lamp turns off → if Reading Lamp is on: set the LED of button 2 on Den Keypad to On and if Reading Lamp is off: set the LED of button 2 on Den Keypad to Off'
		);
	});

	test('what it can’t do, said', () => {
		expect(combine([rule('r-btn-on'), rule('r-btn-off')], 'x', no)).toHaveProperty('reason');
		expect(combine([rule('r-start-1'), rule('r-door')], 'x', yes)).toEqual({
			reason:
				'“Startup Check - Pantry Door Open” starts at a moment that leaves nothing to check, so its part can’t be told apart.'
		});
		expect(
			combine([rule('r-dry'), { ...rule('r-dry'), id: 'z', cooldown_secs: 60 }], 'x', yes)
		).toHaveProperty('reason');
	});

	test('rules that start together stay independent', () => {
		const done = combine([rule('r-start-1'), rule('r-start-2')], 'When homeCore starts', yes);
		if ('reason' in done) throw new Error(done.reason);
		// Two separate ifs, not if/otherwise: each runs when its door is open.
		expect(done.rule.actions?.map((a) => Object.keys(a.action)[0])).toEqual([
			'Conditional',
			'Conditional'
		]);
		expect(
			done.rule.actions?.every(
				(a) =>
					(a.action as { Conditional: { else_actions: unknown[] } }).Conditional.else_actions
						.length === 0
			)
		).toBe(true);
	});
});

test('patterns start a draft that says what it still needs', () => {
	for (const p of PATTERNS) {
		const d = p.draft();
		expect(problemsOf(d, () => true)).toContain('A part still needs its device chosen.');
	}
});
