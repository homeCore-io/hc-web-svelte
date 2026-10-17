/**
 * One intent, one automation (doc 09 §2.1): starting points drawn from the
 * house's own rules (E5), and combining a family of rules into one (E4).
 *
 * Combining needs a homeCore with several moments per rule and checks inside
 * if/otherwise (E2, E3). The combined rule starts on any of its members'
 * moments; each member becomes an "if" — its checks, and the state its own
 * moment leaves behind — doing its steps. Every "if" is asked of the house as
 * it was when the rule started, so the members behave as they did apart.
 */
import { moreOf, tagOf, type Rule } from './ruleWords.js';
import type { Features } from './ruleEdit.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const key = (v: unknown) => JSON.stringify(v);

/**
 * The state a moment leaves behind, as a check: "turns on" → "is on". None
 * for a moment that leaves nothing to check (a time, homeCore starting).
 */
export function stateAfter(trigger: Json): Json | undefined {
	const [kind, f] = tagOf(trigger);
	if (kind === 'DeviceStateChanged') {
		if (f.attribute === undefined || f.to === undefined || f.to === null) return undefined;
		const ids: string[] = [
			...new Set([f.device_id, ...(f.device_ids ?? [])].filter(Boolean) as string[])
		];
		const one = (id: string) => ({
			DeviceState: { device_id: id, attribute: f.attribute, op: 'Eq', value: f.to }
		});
		return ids.length === 1 ? one(ids[0]!) : { Or: { conditions: ids.map(one) } };
	}
	if (kind === 'NumericThreshold') {
		const op = f.op === 'CrossesAbove' || f.op === 'Above' ? 'Gt' : 'Lt';
		return { DeviceState: { device_id: f.device_id, attribute: f.attribute, op, value: f.value } };
	}
	return undefined;
}

export type Combined = { rule: Rule; members: Rule[] } | { reason: string };

/** The family as one rule, or why it can't be. */
export function combine(members: Rule[], name: string, f: Features): Combined {
	if (!f.triggers || !f.ifChecks)
		return {
			reason:
				'Combining needs a homeCore that takes several moments per rule and checks in if/otherwise.'
		};
	if (members.length < 2) return { reason: 'There’s nothing to combine.' };
	const extras = members.map((m) => key(moreOf(m)));
	if (new Set(extras).size > 1)
		return {
			reason:
				'They differ in how they run (cooldowns, run modes or logging) — combine them by hand.'
		};

	const momentsOf = (r: Rule) => [r.trigger, ...(r.triggers ?? [])];
	const sets = members.map((m) => momentsOf(m).map(key).sort().join('|'));
	const sameMoments = new Set(sets).size === 1;

	const triggers: Json[] = [];
	for (const m of members)
		for (const t of momentsOf(m)) if (!triggers.some((x) => key(x) === key(t))) triggers.push(t);

	const actions: Json[] = [];
	for (const m of members) {
		const checks: Json[] = [];
		if (!sameMoments) {
			const states = momentsOf(m).map(stateAfter);
			if (states.some((s) => s === undefined))
				return {
					reason: `“${m.name}” starts at a moment that leaves nothing to check, so its part can’t be told apart.`
				};
			checks.push(states.length === 1 ? states[0] : { Or: { conditions: states } });
		}
		checks.push(...(m.conditions ?? []));
		const steps = (m.actions ?? []).filter((a) => a.enabled !== false).map((a) => a.action);
		if (checks.length === 0) {
			actions.push(...steps.map((action) => ({ enabled: true, action })));
			continue;
		}
		actions.push({
			enabled: true,
			action: {
				Conditional: {
					condition: checks.length === 1 ? checks[0] : { And: { conditions: checks } },
					then_actions: steps,
					else_actions: []
				}
			}
		});
	}

	const [first, ...rest] = triggers;
	const base = members[0]!;
	const rule: Rule = {
		...base,
		id: '',
		name,
		enabled: true,
		priority: Math.max(...members.map((m) => m.priority ?? 0)),
		tags: [...new Set(members.flatMap((m) => m.tags ?? []))],
		trigger: first,
		...(rest.length ? { triggers: rest } : {}),
		conditions: [],
		actions
	};
	delete (rule as Json).error;
	if (!rest.length) delete (rule as Json).triggers;
	return { rule, members };
}

// ---- starting points (E5) ----

export interface Pattern {
	id: string;
	name: string;
	what: string;
	example: string;
	/** The house's rules it's like, by family — shown when the house has them. */
	like: RegExp;
	draft(): Rule;
}

const rule = (name: string, r: Partial<Rule>): Rule => ({
	id: '',
	name,
	enabled: true,
	priority: 0,
	tags: [],
	trigger: 'ManualTrigger',
	conditions: [],
	actions: [],
	...r
});
const set = (device_id: string, state: Json) => ({
	SetDeviceState: { device_id, state, track_event_value: false }
});

export const PATTERNS: Pattern[] = [
	{
		id: 'follow',
		name: 'Keep in step',
		what: 'One device follows another — on while it’s on, off when it’s off.',
		example: 'A keypad LED follows a lamp',
		like: /led sync|follow|in step/i,
		draft: () =>
			rule('Keep in step', {
				trigger: { DeviceStateChanged: { device_id: '', attribute: 'on' } },
				actions: [
					{
						enabled: true,
						action: {
							Conditional: {
								condition: {
									DeviceState: { device_id: '', attribute: 'on', op: 'Eq', value: true }
								},
								then_actions: [set('', { on: true })],
								else_actions: [set('', { on: false })]
							}
						}
					}
				]
			})
	},
	{
		id: 'toggle',
		name: 'A button toggles',
		what: 'A press turns things off if they’re on, otherwise on.',
		example: 'Keypad button 1 → the living room lamps',
		like: /keypad|button|btn/i,
		draft: () =>
			rule('A button toggles', {
				trigger: { DeviceStateChanged: { device_id: '', attribute: 'button_1', to: 'press' } },
				actions: [
					{
						enabled: true,
						action: {
							Conditional: {
								condition: {
									DeviceState: { device_id: '', attribute: 'on', op: 'Eq', value: true }
								},
								then_actions: [set('', { on: false })],
								else_actions: [set('', { on: true })]
							}
						}
					}
				]
			})
	},
	{
		id: 'after',
		name: 'Off after a while',
		what: 'Something turns on; a while later it turns off. Each new start begins the wait again.',
		example: 'The exhaust fan, off 5 min after the door opens',
		like: /timer|after|close/i,
		draft: () =>
			rule('Off after a while', {
				trigger: { DeviceStateChanged: { device_id: '', attribute: 'open', to: true } },
				run_mode: 'Restart',
				actions: [
					{ enabled: true, action: set('', { on: true }) },
					{ enabled: true, action: { Delay: { duration_secs: 300, cancelable: true } } },
					{ enabled: true, action: set('', { on: false }) }
				]
			})
	},
	{
		id: 'time',
		name: 'At a time of day',
		what: 'At a time, or at sunrise or sunset with an offset.',
		example: 'At sunset → the deck lights on',
		like: /sunset|sunrise|night|morning/i,
		draft: () =>
			rule('At sunset', {
				trigger: { SunEvent: { event: 'Sunset', offset_minutes: 0 } },
				actions: [{ enabled: true, action: set('', { on: true }) }]
			})
	}
];
