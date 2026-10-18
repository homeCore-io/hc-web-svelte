/**
 * Why a rule did or didn't run (A2, doc 09 §2.4): homeCore records every
 * time a rule's trigger matched — what started it, each check's answer, each
 * step's outcome — and this says it in the house's words.
 *
 * The record is homeCore's ring of the last 20, kept in memory: it starts
 * empty when homeCore restarts.
 */
import {
	deviceBit,
	checkPhrase,
	stepOf,
	tagOf,
	valueText,
	whenPhrase,
	type House,
	type Phrase,
	type Rule
} from './ruleWords.js';
import type { LastRuns } from './ruleList.js';

/** One record of `GET /automations/{id}/history`. */
export interface Record_ {
	timestamp: string;
	trigger_type: string;
	trigger_context: {
		device_id?: string | null;
		attribute?: string | null;
		value?: unknown;
		prev_value?: unknown;
		change_kind?: string;
		change_actor_name?: string;
		trigger_label?: string;
		/** Which of the rule's moments matched, when it has several. */
		trigger_index?: number;
	};
	outcome: { type: string; at_index?: number; reason?: string; remaining_secs?: number };
	conditions: {
		condition_type: string;
		passed: boolean;
		actual?: unknown;
		expected?: unknown;
		reason: string;
	}[];
	actions: {
		index: number;
		action_type: string;
		description: string;
		outcome: { status: 'ok' | 'error' | 'skipped'; message?: string };
		duration_ms: number;
	}[];
	eval_ms: number;
}

export type Tone = 'good' | 'quiet' | 'bad' | 'muted';

/** What a check found: "20:13" for a time, else the value in words. */
export function actualText(v: unknown): string {
	if (typeof v === 'string') {
		const m = /^(\d\d:\d\d)(:\d\d(\.\d+)?)?$/.exec(v);
		if (m) return m[1]!;
	}
	return valueText(undefined, v);
}

export interface Line {
	label: string;
	words: Phrase;
	mark: string;
	tone: Tone;
}

export interface Run {
	at: string;
	ran: boolean;
	/** "Ran", "Skipped", "Resting". */
	outcome: string;
	tone: Tone;
	/** What started it, and why it stopped if it did. */
	summary: Phrase;
	lines: Line[];
}

const SKIP: Record<string, string> = {
	cooldown: 'Resting',
	paused: 'Paused',
	required_expression_failed: 'Skipped',
	trigger_gate_failed: 'Skipped',
	skipped: 'Skipped',
	condition_failed: 'Skipped'
};

/** What started it: "Bathroom Door Sensor closed (was open)". */
export function cause(h: House, rule: Rule, r: Record_): Phrase {
	const c = r.trigger_context;
	if (c.device_id && c.attribute) {
		const spec = h.device(c.device_id)?.schema?.attributes?.[c.attribute];
		const main =
			c.attribute === 'on' ||
			c.attribute === 'state' ||
			h.device(c.device_id)?.schema?.primary?.[0] === c.attribute;
		const out: Phrase = [
			deviceBit(h, c.device_id),
			{
				t: `${main ? '' : ` ${spec?.display_name?.toLowerCase() ?? c.attribute.replace(/_/g, ' ')}`} ${valueText(spec, c.value)}`
			}
		];
		if (c.prev_value !== undefined && c.prev_value !== null)
			out.push({ t: ` (was ${valueText(spec, c.prev_value)})` });
		if (c.change_actor_name) out.push({ t: `, by ${c.change_actor_name}` });
		return out;
	}
	if (c.device_id) return [deviceBit(h, c.device_id)];
	if (r.trigger_type === 'ManualRun')
		return [{ t: `run now${c.change_actor_name ? ` by ${c.change_actor_name}` : ''}` }];
	// A moment with no device: the rule's own words for it.
	const moment = [rule.trigger, ...(rule.triggers ?? [])][c.trigger_index ?? 0] ?? rule.trigger;
	const when = whenPhrase(h, moment);
	return tagOf(moment)[0] === r.trigger_type
		? when
		: [{ t: r.trigger_type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() }];
}

/**
 * The records for the rule's own steps. homeCore records a step inside an
 * if/otherwise under its parent's index, before the parent's own record.
 */
function topLevel(rule: Rule, actions: Record_['actions']): Record_['actions'] {
	return actions.filter((a) => {
		const step = rule.actions?.[a.index];
		return !step || tagOf(step.action)[0] === a.action_type;
	});
}

/** A record as a run: outcome, and each check and step in words. */
export function runOf(h: House, rule: Rule, r: Record_): Run {
	const ran = r.outcome.type === 'fired';
	const lines: Line[] = [{ label: 'When', words: cause(h, rule, r), mark: '', tone: 'muted' }];
	r.conditions.forEach((c, i) => {
		const cond = rule.conditions?.[i];
		lines.push({
			label: 'Check',
			words: cond !== undefined ? checkPhrase(h, cond) : [{ t: c.reason }],
			mark: c.passed
				? 'yes'
				: `no${c.actual !== undefined ? ` — it was ${actualText(c.actual)}` : ''}`,
			tone: c.passed ? 'good' : 'bad'
		});
	});
	if (!ran && r.outcome.type !== 'condition_failed') {
		lines.push({ label: '', words: [{ t: notRun(r) }], mark: '', tone: 'quiet' });
	} else if (!ran)
		lines.push({ label: '', words: [{ t: 'Nothing done.' }], mark: '', tone: 'muted' });
	for (const a of topLevel(rule, r.actions)) {
		const step = rule.actions?.[a.index];
		const words = step ? stepOf(h, step.action).words : [{ t: a.description }];
		const gone = words.some((b) => b.missing);
		lines.push({
			label: `Step ${a.index + 1}`,
			words,
			mark:
				a.outcome.status === 'error'
					? `failed${a.outcome.message ? `: ${a.outcome.message}` : ''}`
					: a.outcome.status === 'skipped'
						? 'skipped'
						: gone
							? 'sent — to no such device'
							: 'done',
			tone:
				a.outcome.status === 'error' || gone
					? 'bad'
					: a.outcome.status === 'skipped'
						? 'muted'
						: 'good'
		});
	}
	const failedCheck = r.outcome.type === 'condition_failed' ? r.outcome.at_index : undefined;
	const summary: Phrase = [...cause(h, rule, r)];
	if (failedCheck !== undefined && rule.conditions?.[failedCheck] !== undefined)
		summary.push({ t: ' — a check said no: ' }, ...checkPhrase(h, rule.conditions[failedCheck]));
	else if (!ran) summary.push({ t: ` — ${notRun(r).toLowerCase()}` });
	const bad = r.actions.some((a) => a.outcome.status === 'error');
	return {
		at: r.timestamp,
		ran,
		outcome: ran ? (bad ? 'Ran, with a failure' : 'Ran') : (SKIP[r.outcome.type] ?? 'Didn’t run'),
		tone: ran ? (bad ? 'bad' : 'good') : 'quiet',
		summary,
		lines
	};
}

function notRun(r: Record_): string {
	switch (r.outcome.type) {
		case 'cooldown':
			return `Resting after its last run${r.outcome.remaining_secs ? ` (${r.outcome.remaining_secs} s left)` : ''}.`;
		case 'paused':
			return 'Paused by another rule.';
		case 'required_expression_failed':
		case 'trigger_gate_failed':
			return 'Its own condition said no.';
		case 'skipped':
			return r.outcome.reason ? `Skipped: ${r.outcome.reason}.` : 'Skipped while already running.';
		default:
			return r.outcome.reason ?? 'It didn’t run.';
	}
}

/** Newest first, for the page. */
export const runsOf = (h: House, rule: Rule, records: Record_[]) =>
	records.map((r) => runOf(h, rule, r)).reverse();

/** What the list shows of a rule's history. */
export function lastRuns(records: Record_[]): LastRuns {
	const out: LastRuns = {};
	for (const r of records) {
		out.tried = r.timestamp;
		if (r.outcome.type === 'fired') {
			out.ran = r.timestamp;
			const bad = r.actions.find((a) => a.outcome.status === 'error');
			out.failed = bad ? (bad.outcome.message ?? bad.description) : undefined;
		}
	}
	return out;
}

// ---- Test: a dry run against the house as it is now ----

/** `POST /automations/{id}/test`. */
export interface TestResult {
	conditions_pass: boolean;
	conditions: { passed: boolean; actual?: unknown; reason?: string }[];
	would_fire: boolean;
	/** The time it was judged at, when one was asked for (homeCore 0.1.81). */
	at?: string;
}

/** homeCore's word that a script was judged now, whatever time was asked. */
const JUDGED_NOW = 'a script is judged now';

export interface Tested {
	yes: boolean;
	headline: string;
	lines: Line[];
}

/**
 * A dry run in lines and a headline. `when` names the time it was asked
 * about ("at 22:30"), for a run judged at another time than now.
 */
export function tested(h: House, rule: Rule, res: TestResult, when?: string): Tested {
	const lines: Line[] = res.conditions.map((c, i) => ({
		label: 'Check',
		words:
			rule.conditions?.[i] !== undefined
				? checkPhrase(h, rule.conditions[i])
				: [{ t: c.reason ?? '' }],
		mark:
			(c.passed
				? 'yes'
				: `no${c.actual !== undefined && c.actual !== null ? ` — it’s ${actualText(c.actual)}` : ''}`) +
			(c.reason?.startsWith(JUDGED_NOW) ? ' (a script reads the clock now)' : ''),
		tone: c.passed ? 'good' : 'bad'
	}));
	const then = when ?? 'now';
	if (res.would_fire)
		for (const [i, a] of (rule.actions ?? []).entries()) {
			if (a.enabled === false) continue;
			const words = stepOf(h, a.action).words;
			const gone = words.some((b) => b.missing);
			lines.push({
				label: `Step ${i + 1}`,
				words,
				mark: gone ? 'no such device' : '',
				tone: gone ? 'bad' : 'muted'
			});
		}
	return {
		yes: res.would_fire,
		headline: res.would_fire
			? rule.conditions?.length
				? `Every check passes ${then}, so it would run.`
				: 'It has no checks, so it would run.'
			: `It wouldn’t run ${then} — a check says no.`,
		lines
	};
}
