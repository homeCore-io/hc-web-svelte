import { expect, test } from 'vitest';
import { DEVICES, RULES } from './fixtures/rules.js';
import { houseOf } from './ruleList.js';
import { plain } from './ruleWords.js';
import { actualText, lastRuns, runOf, runsOf, tested, type Record_ } from './ruleRuns.js';

const h = houseOf(Object.fromEntries(DEVICES.map((d) => [d.device_id, d])));
const rule = (id: string) => RULES.find((r) => r.id === id)!;

// As homeCore records them (`GET /automations/{id}/history`).
const skipped: Record_ = {
	timestamp: '2026-10-16T09:04:00Z',
	trigger_type: 'DeviceStateChanged',
	trigger_context: { device_id: 'zz_door_2', attribute: 'open', value: false, prev_value: true },
	outcome: {
		type: 'condition_failed',
		at_index: 0,
		reason: 'now 05:04:00 within [06:00:00, 12:00:00] → FAIL'
	},
	conditions: [{ condition_type: 'time_window', passed: false, actual: '05:04:00', reason: '…' }],
	actions: [],
	eval_ms: 0
};
const fired: Record_ = {
	timestamp: '2026-10-16T10:49:00Z',
	trigger_type: 'DeviceStateChanged',
	trigger_context: { device_id: 'zz_door_2', attribute: 'open', value: false, prev_value: true },
	outcome: { type: 'fired' },
	conditions: [{ condition_type: 'time_window', passed: true, actual: '08:49:12.5', reason: '…' }],
	actions: [
		{
			index: 0,
			action_type: 'SetDeviceState',
			description: '…',
			outcome: { status: 'ok' },
			duration_ms: 1
		},
		{
			index: 1,
			action_type: 'SetDeviceState',
			description: 'den ← play',
			outcome: { status: 'error', message: 'no reply' },
			duration_ms: 5000
		}
	],
	eval_ms: 0
};

test('a skipped run says which check said no, and what it found', () => {
	const run = runOf(h, rule('r-music-am'), skipped);
	expect(run.outcome).toBe('Skipped');
	expect(plain(run.summary)).toBe(
		'Porch Door closed (was open) — a check said no: it’s between 06:00 and 12:00'
	);
	expect(run.lines.map((l) => [l.label, plain(l.words), l.mark])).toEqual([
		['When', 'Porch Door closed (was open)', ''],
		['Check', 'it’s between 06:00 and 12:00', 'no — it was 05:04'],
		['', 'Nothing done.', '']
	]);
});

test('a run with a failed step says so', () => {
	const run = runOf(h, rule('r-music-am'), fired);
	expect(run.outcome).toBe('Ran, with a failure');
	expect(run.lines.slice(2).map((l) => [plain(l.words), l.mark, l.tone])).toEqual([
		['set the volume of Den to 15 %', 'done', 'good'],
		['play the favourite “Morning Piano” on Den', 'failed: no reply', 'bad']
	]);
});

test('newest first; the list’s view of it', () => {
	expect(runsOf(h, rule('r-music-am'), [skipped, fired]).map((r) => r.at)).toEqual([
		fired.timestamp,
		skipped.timestamp
	]);
	expect(lastRuns([skipped, fired])).toEqual({
		tried: fired.timestamp,
		ran: fired.timestamp,
		failed: 'no reply'
	});
	expect(lastRuns([fired, skipped])).toEqual({
		tried: skipped.timestamp,
		ran: fired.timestamp,
		failed: 'no reply'
	});
});

test('a moment with no device reads as the rule says it', () => {
	const run = runOf(h, rule('r-start-1'), {
		...skipped,
		trigger_type: 'SystemStarted',
		trigger_context: {},
		outcome: { type: 'cooldown', remaining_secs: 40 },
		conditions: []
	});
	expect(plain(run.summary)).toBe('homeCore starts — resting after its last run (40 s left).');
});

test('a test against the house as it is now', () => {
	const no = tested(h, rule('r-music-am'), {
		conditions_pass: false,
		would_fire: false,
		conditions: [{ passed: false, actual: '20:14:08.08' }]
	});
	expect(no.headline).toBe('It wouldn’t run now — a check says no.');
	expect(no.lines.map((l) => l.mark)).toEqual(['no — it’s 20:14']);
	const yes = tested(h, rule('r-door'), {
		conditions_pass: true,
		would_fire: true,
		conditions: []
	});
	expect(yes.headline).toBe('It has no checks, so it would run.');
	expect(yes.lines.map((l) => plain(l.words))).toEqual([
		'turn Reading Lamp on',
		'start Den Fan Timer for 5 min'
	]);
});

test('times found by a check read as times', () => {
	expect([
		actualText('05:04:00'),
		actualText('20:14:08.083937598'),
		actualText(true),
		actualText(35)
	]).toEqual(['05:04', '20:14', 'on', '35']);
});
