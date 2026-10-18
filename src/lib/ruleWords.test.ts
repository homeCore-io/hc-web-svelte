import { describe, expect, test } from 'vitest';
import { DEVICES, RULES } from './fixtures/rules.js';
import { houseOf } from './ruleList.js';
import {
	checkPhrase,
	duration,
	moreOf,
	plain,
	readRule,
	readScript,
	refsOf,
	sentence,
	setPhrase,
	stepOf,
	whenPhrase,
	type Rule
} from './ruleWords.js';

const byId = Object.fromEntries(DEVICES.map((d) => [d.device_id, d]));
const h = houseOf(byId, [{ id: 's1', name: 'Movie' }], RULES);
const rule = (id: string) => RULES.find((r) => r.id === id) as Rule;
const say = (id: string) => plain(sentence(h, rule(id)));

describe('a rule in one sentence', () => {
	test('a device’s own verb, and its steps', () => {
		expect(say('r-door')).toBe(
			'When Pantry Door opens → turn Reading Lamp on and start Den Fan Timer for 5 min'
		);
	});

	test('like checks and like steps are said once', () => {
		expect(say('r-btn-on')).toBe(
			'When Den Keypad button 1 is pressed, only if Reading Lamp and Corner Lamp are off → turn Reading Lamp and Corner Lamp on and set the LED of button 1 on Den Keypad to On'
		);
	});

	test('a device named by its name in rules reads as the device', () => {
		expect(say('r-music-am')).toBe(
			'When Porch Door closes, only if it’s between 06:00 and 12:00 → set the volume of Den to 15 % and play the favourite “Morning Piano” on Den'
		);
		expect(refsOf(h, rule('r-music-am')).every((r) => !r.missing)).toBe(true);
	});

	test('a moment without a device starts the sentence itself', () => {
		expect(say('r-gone')).toMatch(/^30 min before sunrise →/);
		expect(say('r-start-1')).toBe(
			'When homeCore starts, only if Pantry Door is open → send “Pantry door was open at start” to telegram'
		);
	});

	test('if/otherwise written as a simple script is read', () => {
		expect(say('r-night')).toBe(
			'When any of Porch Door or Pantry Door opens → if Night is on: turn Corner Lamp on, brightness 30 %'
		);
	});

	test('turned-off steps are left out of the sentence, kept in full', () => {
		expect(say('r-dry')).toBe(
			'When Den Air humidity changes, only if Den Air humidity is below 35 % and Night is off → wait 1 min 30 s'
		);
		const full = readRule(h, rule('r-dry'));
		expect(full.steps.map((s) => s.off)).toEqual([false, true]);
		expect(full.more).toEqual(['Skips a run while one is going', 'Rests 10 min after running']);
	});
});

describe('what a rule names', () => {
	test('a deleted device is missing; a name the house resolves is not', () => {
		expect(refsOf(h, rule('r-gone'))).toEqual([
			{ id: 'DELETED:zz_old_lamp', missing: true },
			{ id: 'reading_lamp', missing: false }
		]);
		expect(plain(sentence(h, rule('r-gone')))).toContain(
			'turn a deleted device and Reading Lamp off'
		);
	});

	test('scripts name devices too', () => {
		expect(refsOf(h, rule('r-night')).map((r) => r.id)).toContain('mode_night');
	});

	test('an id the house lacks is marked', () => {
		const p = setPhrase(h, ['no_such'], { on: true });
		expect(p.find((b) => b.device)).toEqual({ t: 'no_such', device: 'no_such', missing: true });
	});
});

describe('every kind homeCore has reads as words', () => {
	test.each([
		[{ SunEvent: { event: 'Sunset', offset_minutes: 0 } }, 'at sunset'],
		[{ SunEvent: { event: 'CivilDusk', offset_minutes: 15 } }, '15 min after dusk'],
		[
			{ TimeOfDay: { time: '07:30:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] } },
			'at 07:30 on weekdays'
		],
		[{ TimeOfDay: { time: '09:00:00', days: [] } }, 'at 09:00 every day'],
		[{ Periodic: { every_n: 5, unit: 'Minutes' } }, 'every 5 minutes'],
		[
			{ ButtonEvent: { device_id: 'zz_keypad', button_number: 2, event: 'Held' } },
			'Den Keypad button 2 is held'
		],
		[
			{
				NumericThreshold: {
					device_id: 'zz_air',
					attribute: 'humidity_pct',
					op: 'CrossesBelow',
					value: 30
				}
			},
			'Den Air humidity falls below 30 %'
		],
		[
			{ DeviceAvailabilityChanged: { device_id: 'zz_door_1', to: false, for_duration_secs: 600 } },
			'Pantry Door goes offline for 10 min'
		],
		[{ DeviceBatteryLow: {} }, 'any device’s battery runs low'],
		[{ ModeChanged: { mode_id: 'mode_night', to: true } }, 'Night turns on'],
		[
			{ DeviceStateChanged: { device_id: 'timer_den_fan', attribute: 'state', to: 'finished' } },
			'Den Fan Timer finishes'
		],
		[
			{
				DeviceStateChanged: {
					device_id: 'zz_door_1',
					attribute: 'open',
					to: true,
					for_duration_secs: 300,
					change_kind: 'physical'
				}
			},
			'Pantry Door opens and stays so for 5 min by hand'
		],
		['ManualTrigger', 'someone runs it'],
		[{ Cron: { expression: '0 7 * * *' } }, 'on the schedule 0 7 * * *'],
		[{ WebhookReceived: { path: 'doorbell' } }, 'the web address /webhooks/doorbell is called'],
		[{ SomethingNew: { a: 1 } }, 'Something new {"a":1}']
	])('%j', (trigger, words) => {
		expect(plain(whenPhrase(h, trigger))).toBe(words);
	});

	test.each([
		[
			{ TimeElapsed: { device_id: 'zz_door_1', attribute: 'open', duration_secs: 3600 } },
			'Pantry Door hasn’t changed for 1 h'
		],
		[{ Not: { condition: { ModeIs: { mode_id: 'mode_night', on: true } } } }, 'not (Night is on)'],
		[{ ScriptExpression: { script: 'hour() > 7' } }, 'hour() > 7'],
		[{ PrivateBooleanIs: { name: 'armed', value: true } }, 'its flag armed is set']
	])('%j', (condition, words) => {
		expect(plain(checkPhrase(h, condition))).toBe(words);
	});

	test.each([
		[
			{ Notify: { channel: 'all', message: 'Hi', title: 'Door' } },
			'send “Door: Hi” to every channel'
		],
		[{ SetMode: { mode_id: 'mode_night', command: 'Off' } }, 'turn Night off'],
		[{ RunRuleActions: { rule_id: 'r-door' } }, 'do the steps of “Pantry Door - Opened”'],
		[{ PauseRule: { rule_id: 'gone' } }, 'pause a rule that no longer exists'],
		[
			{ FadeDevice: { device_id: 'zz_lamp_1', target: 0, duration_secs: 120 } },
			'fade Reading Lamp to 0 over 2 min'
		],
		[
			{ CaptureDeviceState: { key: 'before', device_ids: ['zz_lamp_1', 'zz_lamp_2'] } },
			'remember how Reading Lamp and Corner Lamp are set, as before'
		],
		['ExitRule', 'stop here'],
		[{ PublishMqtt: { topic: 'x/y', payload: '1', retain: false } }, 'publish 1 to x/y']
	])('%j', (action, words) => {
		expect(plain(stepOf(h, action).words)).toBe(words);
	});
});

test('scripts it can’t read stay as written', () => {
	expect(
		readScript(h, 'device_state("zz_air")["temperature"] > 21.5 && hour() < 6')
	).toBeUndefined();
	expect(plain(readScript(h, 'device_state("zz_air")["temperature"] > 21.5')!)).toBe(
		'Den Air is above 21.5 °C'
	);
});

test('durations', () => {
	expect([30, 90, 300, 3600, 5400, 172800].map(duration)).toEqual([
		'30 s',
		'1 min 30 s',
		'5 min',
		'1 h',
		'1 h 30 min',
		'2 days'
	]);
});

test('advanced options in words', () => {
	expect(
		moreOf({ ...rule('r-door'), run_mode: { Queued: { max_queue: 3 } }, log_actions: true })
	).toEqual(['Queues up to 3 runs', 'Writes what it does to the log']);
});

describe('several moments and checked ifs (E2, E3)', () => {
	test('every moment is said', () => {
		const r = {
			...rule('r-door'),
			triggers: [{ SunEvent: { event: 'Sunset', offset_minutes: 0 } }, 'SystemStarted']
		};
		expect(say2(r)).toBe(
			'When Pantry Door opens, or at sunset, or when homeCore starts → turn Reading Lamp on and start Den Fan Timer for 5 min'
		);
		expect(readRule(h, r).whens.map(plain)).toEqual([
			'Pantry Door opens',
			'at sunset',
			'homeCore starts'
		]);
	});

	test('an if that asks a check, and running a scene', () => {
		expect(
			plain(
				stepOf(h, {
					Conditional: {
						condition: {
							Or: {
								conditions: [
									{ ModeIs: { mode_id: 'mode_night', on: true } },
									{ TimeWindow: { start: '22:00:00', end: '06:00:00' } }
								]
							}
						},
						then_actions: [],
						else_actions: []
					}
				}).words
			)
		).toBe('if any of: Night is on or it’s between 22:00 and 06:00');
		expect(
			plain(stepOf(h, { ActivateScenePerMode: { modes: [], default_scene_id: 's1' } }).words)
		).toBe('run Movie');
		expect(
			refsOf(h, {
				...rule('r-door'),
				actions: [
					{
						enabled: true,
						action: {
							Conditional: {
								condition: {
									DeviceState: { device_id: 'gone', attribute: 'on', op: 'Eq', value: true }
								},
								then_actions: [],
								else_actions: []
							}
						}
					}
				]
			})
		).toContainEqual({ id: 'gone', missing: true });
	});
});

const say2 = (r: Rule) => plain(sentence(h, r));

describe('helpers told what to do', () => {
	test('a choice list set, stepped on; words cleared', () => {
		expect(plain(setPhrase(h, ['select_house'], { command: 'select', option: 'Away' }))).toMatch(
			/^set .+ to Away$/
		);
		expect(plain(setPhrase(h, ['select_house'], { command: 'next' }))).toMatch(
			/^move .+ to its next choice$/
		);
		expect(plain(setPhrase(h, ['text_note'], { command: 'clear' }))).toMatch(/^clear /);
	});
});
