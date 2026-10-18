/**
 * Modes (A1): states the whole house is in — Night, Away, Guests — for rules
 * to check. homeCore has three sorts: one that follows the sun, one people
 * and rules turn on and off, and one on whenever a condition holds (a manual
 * mode with a definition).
 */
import { slugOf } from './helpers.js';
import { tagOf } from './ruleWords.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type SunEvent = 'Sunrise' | 'Sunset' | 'SolarNoon' | 'CivilDawn' | 'CivilDusk';

export interface ModeConfig {
	id: string;
	name: string;
	kind: 'solar' | 'manual';
	on_event?: SunEvent;
	off_event?: SunEvent;
	on_offset_minutes?: number;
	off_offset_minutes?: number;
}

/** What turns a manual mode on and off by itself (homeCore's criteria). */
export interface Criteria {
	on_condition: Json;
	/** `inverse`: off when the on-condition stops holding; `explicit`: off by its own condition. */
	off_behavior: 'inverse' | 'explicit';
	off_condition?: Json;
	reevaluate_every_n_minutes: number;
}

export interface Definition {
	mode_id: string;
	criteria: Criteria;
	/** The rules homeCore made from it, and keeps in step with it. */
	generated_rule_ids: string[];
}

export interface CoreMode {
	config: ModeConfig;
	state: { attributes: Record<string, unknown> } | null;
	definition: Definition | null;
}

const SUN: Record<SunEvent, string> = {
	Sunrise: 'sunrise',
	Sunset: 'sunset',
	SolarNoon: 'solar noon',
	CivilDawn: 'dawn',
	CivilDusk: 'dusk'
};
export const sunWords = (e: SunEvent | undefined) => (e ? SUN[e] : 'never');
/** Every sun event, in the day's order. */
export const SUN_EVENTS: SunEvent[] = ['CivilDawn', 'Sunrise', 'SolarNoon', 'Sunset', 'CivilDusk'];

/** "on time", "+15 min", "−30 min". */
export const offsetText = (n: number) =>
	n === 0 ? 'on time' : `${n > 0 ? '+' : '−'}${Math.abs(n)} min`;

/** How a mode decides, in a line. */
export function howOf(m: CoreMode): string {
	const c = m.config;
	if (c.kind === 'solar') {
		if (!c.on_event || !c.off_event) return 'Follows the sun — no times set';
		const on = sunWords(c.on_event);
		const off = sunWords(c.off_event);
		const at = (word: string, n: number | undefined) => (n ? `${word} ${offsetText(n)}` : word);
		const text = `${at(on, c.on_offset_minutes)} to ${at(off, c.off_offset_minutes)}`;
		return text[0]!.toUpperCase() + text.slice(1);
	}
	return m.definition ? 'On while a condition holds' : 'On or off by hand and by rules';
}

/** "18:27" → minutes after midnight, or null. */
export function minutes(hhmm: unknown): number | null {
	if (typeof hhmm !== 'string') return null;
	const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** When it's on today, as spans of the day in minutes; a night wraps midnight. */
export function spans(onAt: number, offAt: number): { from: number; to: number }[] {
	if (onAt === offAt) return [];
	return onAt < offAt
		? [{ from: onAt, to: offAt }]
		: [
				{ from: 0, to: offAt },
				{ from: onAt, to: 1440 }
			];
}

/** The id homeCore needs for a new mode: `mode_` and the name. */
export const modeIdFor = (name: string) => `mode_${slugOf(name)}`;

/** The built-in pair can't be deleted. */
export const builtIn = (id: string) => id === 'mode_night' || id === 'mode_day';

// ---- a definition, as the page edits it ----

/** A condition as a list of checks, all of which must hold. */
export function checksOf(c: Json | undefined | null): Json[] {
	if (c === undefined || c === null) return [];
	const [kind, f] = tagOf(c);
	return kind === 'And' ? [...(f.conditions ?? [])] : [c];
}

/** The checks back as one condition: one alone, several as "all of". */
export const conditionOf = (list: Json[]): Json =>
	list.length === 1 ? list[0] : { And: { conditions: list } };

export interface CriteriaDraft {
	on: Json[];
	explicit: boolean;
	off: Json[];
	every: number;
}

export const draftOf = (d: Definition | null): CriteriaDraft => ({
	on: checksOf(d?.criteria.on_condition),
	explicit: d?.criteria.off_behavior === 'explicit',
	off: checksOf(d?.criteria.off_condition),
	every: d?.criteria.reevaluate_every_n_minutes ?? 1
});

/** The body homeCore's `PUT /modes/{id}/definition` takes. */
export function criteriaOf(d: CriteriaDraft): Criteria {
	return {
		on_condition: conditionOf(d.on),
		off_behavior: d.explicit ? 'explicit' : 'inverse',
		...(d.explicit ? { off_condition: conditionOf(d.off) } : {}),
		reevaluate_every_n_minutes: Math.max(1, Math.round(d.every))
	};
}

/** What stops a draft being saved, in words. */
export function criteriaProblems(modeId: string, d: CriteriaDraft): string[] {
	const out: string[] = [];
	if (d.on.length === 0) out.push('Say when it turns on.');
	if (d.explicit && d.off.length === 0) out.push('Say when it turns off.');
	if (!(d.every >= 1)) out.push('Check at least once a minute or less often.');
	const text = JSON.stringify([d.on, d.explicit ? d.off : []]);
	if (text.includes(`"mode_id":${JSON.stringify(modeId)}`)) out.push('It can’t depend on itself.');
	if (/"device_id":""/.test(text)) out.push('Choose a device for each check.');
	return out;
}
