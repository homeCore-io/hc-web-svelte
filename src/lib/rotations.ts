/**
 * Rotations (core v0.1.130): a shared list of commands for one kind of
 * device — WLED presets, Sonos playlists and favorites — that rules play one
 * at a time, so what plays changes on its own. Words and choices here; the
 * live list is `rotations.svelte.ts`.
 */
import type { CoreDevice, DeviceAction, ParamSpec } from './devices.js';
import { optionsFromList, type Option } from './details.js';

export type RotationOrder = 'in_turn' | 'shuffle' | 'random';
export type PeriodUnit = 'hour' | 'day' | 'week';
export type RotationAdvance =
	'each_use' | { every: { n: number; unit: PeriodUnit } } | { schedule: { cron: string } };

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** When a choice may play (homeCore 0.1.130): every part given must hold. */
export interface ChoiceWhen {
	/** One of these modes is on (mode device ids). */
	modes?: string[];
	/** Local times, "22:00:00"; a start after the end runs past midnight. */
	between?: { start: string; end: string };
	days?: Weekday[];
}

export interface RotationChoice {
	label?: string;
	command: Record<string, unknown>;
	only_when?: ChoiceWhen;
}

export interface RotationNow {
	current: number | null;
	current_name: string | null;
	next: number | null;
	next_name: string | null;
	missing: number[];
	missing_names: string[];
	last_played: string | null;
	/** Whether each choice may play now (its times, days, modes). */
	for_now?: boolean[];
}

export interface Rotation {
	id: string;
	name: string;
	device_id: string;
	choices: RotationChoice[];
	order: RotationOrder;
	advance: RotationAdvance;
	now?: RotationNow;
}

/** What a rotation is sent as when saved. */
export type RotationDraft = Omit<Rotation, 'id' | 'now'>;

/**
 * Something on a device a rotation can choose among: an action with one
 * parameter that has a list (Sonos's favorites and playlists, WLED's presets
 * and playlists), and that list as the device has it now.
 */
export interface ChoiceSource {
	action: DeviceAction;
	param: ParamSpec;
	options: Option[];
}

/**
 * Actions that play or apply something: what a rotation is for. Not every
 * action with a list is one — WLED's "Delete a preset" and "Preset at
 * power-on" take a preset too, Sonos's Repeat a mode.
 */
export const PLAYS =
	/^(apply|start|launch|select|activate|show)_|^play_(?!pause)|^set_(effect|palette|scene)$/;

export function choiceSources(d: CoreDevice): ChoiceSource[] {
	const out: ChoiceSource[] = [];
	for (const action of d.schema?.actions ?? []) {
		if (!PLAYS.test(action.id) || action.confirm) continue;
		const params = action.params ?? [];
		// The list to choose from: a live one (presets, favorites), or a fixed
		// one it must be given. An optional fixed list beside it (a WLED
		// effect's `segment`) is a detail, not a second list.
		const listed = params.filter(
			(p) => typeof p.options_from === 'object' || (p.options && p.required)
		);
		// One list to choose from, and nothing else it must be told.
		if (listed.length !== 1) continue;
		const param = listed[0]!;
		if (params.some((p) => p !== param && p.required)) continue;
		const from = typeof param.options_from === 'object' ? param.options_from.attribute : undefined;
		const options = param.options
			? param.options.map((o) => ({ value: o.value, label: o.label ?? o.value }))
			: from
				? optionsFromList(d.attributes[from.attribute], from.label_key, from.value_key)
				: [];
		if (from || param.options) out.push({ action, param, options });
	}
	// What it plays (presets, playlists, favorites) before how it looks (effects).
	return out.sort(
		(a, b) => Number(a.action.id.startsWith('set_')) - Number(b.action.id.startsWith('set_'))
	);
}

/** Devices a rotation can be made for. */
export const rotatable = (d: CoreDevice) => choiceSources(d).length > 0;

/** The command choosing `option` from `source`. A number stays a number. */
export function commandFor(source: ChoiceSource, option: Option): Record<string, unknown> {
	const numeric = ['int', 'float'].includes(source.param.kind);
	const value = numeric && option.value.trim() !== '' ? Number(option.value) : option.value;
	return {
		action: source.action.id,
		[source.param.name]: Number.isNaN(value) ? option.value : value
	};
}

/** Whether a choice is `option` from `source`. */
export function isChoice(c: RotationChoice, source: ChoiceSource, option: Option): boolean {
	return (
		c.command.action === source.action.id && String(c.command[source.param.name]) === option.value
	);
}

/** A choice's name: its label, else the option it is, else its first value. */
export function choiceName(c: RotationChoice, sources: ChoiceSource[] = []): string {
	if (c.label?.trim()) return c.label;
	for (const s of sources) for (const o of s.options) if (isChoice(c, s, o)) return o.label;
	const v = Object.entries(c.command).find(([k]) => k !== 'action')?.[1];
	return v === undefined ? String(c.command.action ?? '') : String(v);
}

/** What kind of choice it is, as the device's action says: "Play a playlist". */
export function choiceKind(c: RotationChoice, sources: ChoiceSource[]): string | undefined {
	return sources.find((s) => s.action.id === c.command.action)?.action.label;
}

export const ORDERS: { value: RotationOrder; label: string; hint: string }[] = [
	{ value: 'in_turn', label: 'In turn', hint: 'First to last, then round again' },
	{ value: 'shuffle', label: 'Shuffled', hint: 'Each once, in a new order every round' },
	{ value: 'random', label: 'Random', hint: 'Any, but never the same twice running' }
];

const UNIT_WORDS: Record<PeriodUnit, [string, string]> = {
	hour: ['hour', 'hours'],
	day: ['day', 'days'],
	week: ['week', 'weeks']
};

/** How often it moves on, in words: "each time", "every day", "every 2 hours". */
export function advanceWords(a: RotationAdvance): string {
	if (a === 'each_use') return 'each time it plays';
	if ('every' in a) {
		const { n, unit } = a.every;
		const [one, many] = UNIT_WORDS[unit];
		return n === 1 ? `every ${one}` : `every ${n} ${many}`;
	}
	return `on the schedule ${a.schedule.cron}`;
}

export function orderWords(o: RotationOrder): string {
	return ORDERS.find((x) => x.value === o)?.label.toLowerCase() ?? o;
}

/** One line for a list: "4 choices · shuffled · new every day". */
export function summary(r: Pick<Rotation, 'choices' | 'order' | 'advance'>): string {
	const n = r.choices.length;
	const pace = r.advance === 'each_use' ? 'next each time' : `new ${advanceWords(r.advance)}`;
	return `${n === 1 ? 'One choice' : `${n} choices`} · ${orderWords(r.order)} · ${pace}`;
}

/** `when` with its empty parts left out; undefined when nothing is left. */
export function tidyWhen(when: ChoiceWhen): ChoiceWhen | undefined {
	const out: ChoiceWhen = {};
	if (when.modes?.length) out.modes = when.modes;
	if (when.between) out.between = when.between;
	// Seven days ticked stay ticked: the same as none to homeCore, but the
	// chips going blank at the seventh looked like it had undone them.
	if (when.days?.length) out.days = WEEKDAYS.filter((d) => when.days!.includes(d));
	return Object.keys(out).length ? out : undefined;
}

/** "22:00:00" → "22:00". */
export const hhmm = (t: string) => t.slice(0, 5);
/** "22:00" → "22:00:00", as homeCore reads a time. */
export const fullTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

/** When a choice plays, in words: "only when Night is on · 22:00–06:00 · Sat, Sun". */
export function whenWords(when: ChoiceWhen | undefined, modeName: (id: string) => string): string {
	if (!when) return 'any time';
	const parts: string[] = [];
	if (when.modes?.length) parts.push(`when ${when.modes.map(modeName).join(' or ')} is on`);
	if (when.between) parts.push(`${hhmm(when.between.start)}–${hhmm(when.between.end)}`);
	if (when.days?.length) parts.push(when.days.join(', '));
	return parts.length ? `only ${parts.join(' · ')}` : 'any time';
}

/** Cron as the scheduler reads it: six fields, seconds first. */
export const cronLooksRight = (cron: string) => cron.trim().split(/\s+/).length >= 6;
