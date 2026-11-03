/**
 * Making a scene (A1): homeCore's own scenes set chosen devices to chosen
 * states (`Scene.states`: device id → attributes). What a scene can set on a
 * device comes from its schema — the attributes it says are writable — so
 * any plugin's devices can be in one.
 */
import { cap, words } from './card.js';
import type { CoreDevice } from './devices.js';
import { readingText } from './units.js';

/** How many settings an entry shows, and takes from the device, to begin with. */
export const FIRST = 3;

export interface Setting {
	attr: string;
	label: string;
	kind: 'bool' | 'range' | 'enum';
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	options?: { value: string; label: string }[];
}

/**
 * The settings a scene can give a device, primary ones first; none for
 * sensors. The first few are what a new entry takes and what's shown at once;
 * `Infinity` gives them all.
 */
export function settingsOf(d: CoreDevice, max = FIRST): Setting[] {
	const attrs = d.schema?.attributes ?? {};
	const primary = d.schema?.primary ?? [];
	const rank = (a: string) => (primary.includes(a) ? primary.indexOf(a) : a === 'on' ? -1 : 100);
	const out: Setting[] = [];
	for (const [attr, spec] of Object.entries(attrs)) {
		if (!spec.writable || spec.category === 'config' || spec.category === 'diagnostic') continue;
		const label = spec.display_name ?? cap(words(attr));
		if (spec.kind === 'bool') out.push({ attr, label, kind: 'bool' });
		else if (
			(spec.kind === 'integer' || spec.kind === 'float' || spec.kind === 'color_temp') &&
			spec.min !== undefined &&
			spec.max !== undefined
		)
			out.push({
				attr,
				label,
				kind: 'range',
				min: spec.min,
				max: spec.max,
				step: spec.step ?? 1,
				unit: spec.unit
			});
		else if (spec.kind === 'enum' && spec.options?.length)
			out.push({
				attr,
				label,
				kind: 'enum',
				options: spec.options.map((o) =>
					typeof o === 'string'
						? { value: o, label: cap(words(o)) }
						: { value: o.value, label: o.label ?? cap(words(o.value)) }
				)
			});
	}
	return out.sort((a, b) => rank(a.attr) - rank(b.attr)).slice(0, max);
}

/** Whether a device can be in a scene at all. */
export const sceneable = (d: CoreDevice) => d.device_type !== 'scene' && settingsOf(d).length > 0;

/** What the device is set to now, for the settings a scene can give it. */
export function stateNow(d: CoreDevice, settings = settingsOf(d)): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const s of settings) {
		const v = d.attributes[s.attr];
		if (v !== undefined && v !== null) out[s.attr] = v;
	}
	// Off is off: a dimmer's last brightness says nothing a scene should set.
	if (out.on === false) for (const s of settings) if (s.attr !== 'on') delete out[s.attr];
	return out;
}

/** A device's entry in words: "on · 30 %", "off". */
export function describeState(state: Record<string, unknown>, settings: Setting[]): string {
	if (isSteps(state)) {
		const n = stepsOf(state).length;
		return n === 1 ? 'one step' : `${n} steps, in order`;
	}
	if (state.on === false) return 'off';
	const parts = settings
		.filter((s) => s.attr !== 'on' && state[s.attr] !== undefined)
		.map((s) =>
			s.kind === 'range'
				? valueText(s, state[s.attr])
				: (s.options?.find((o) => o.value === state[s.attr])?.label ?? String(state[s.attr]))
		);
	return [state.on === true ? 'on' : '', ...parts].filter(Boolean).join(' · ') || 'as set';
}

/** A range setting's value in the person's units: "21 °C" set, "69.8 °F" shown. */
export function valueText(s: Setting, v: unknown): string {
	if (typeof v !== 'number') return String(v);
	const text = readingText(v, s.unit);
	// A percentage reads "30 %" here, as it always has.
	return s.unit === '%' ? text.replace(/%$/, ' %') : text;
}

/** Whether two scenes' states differ. */
export const differ = (a: Record<string, unknown>, b: Record<string, unknown>) =>
	JSON.stringify(a) !== JSON.stringify(b);

// ---- entries that are steps ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/**
 * An entry homeCore sends as commands, one after another, rather than as
 * one state: `{ actions: [cmd, cmd, …] }` (handlers.rs activate_scene).
 */
export const isSteps = (st: Record<string, unknown>) => Array.isArray(st.actions);
export const stepsOf = (st: Record<string, unknown>): Json[] =>
	Array.isArray(st.actions) ? (st.actions as Json[]) : [];

/**
 * An entry as steps: each thing it set becomes a step of its own, so each
 * reads as one command — power first, as the device would want it.
 */
export function asSteps(st: Record<string, unknown>): { actions: Json[] } {
	if (isSteps(st)) return { actions: stepsOf(st) };
	const keys = Object.keys(st).sort((a, b) => Number(b === 'on') - Number(a === 'on'));
	return { actions: keys.map((k) => ({ [k]: st[k] })) };
}

/**
 * Steps back to one state: kept when it's a single plain state; otherwise
 * how the device is now.
 */
export function asSettings(st: Record<string, unknown>, d: CoreDevice): Record<string, unknown> {
	const steps = stepsOf(st);
	const only = steps.length === 1 ? steps[0] : undefined;
	const settings = settingsOf(d, Infinity);
	if (
		only &&
		typeof only === 'object' &&
		!Array.isArray(only) &&
		Object.keys(only).length > 0 &&
		Object.keys(only).every((k) => settings.some((s) => s.attr === k))
	)
		return { ...only };
	return stateNow(d);
}

/** What an entry sets that the form has no control for — kept, and shown as written. */
export function othersIn(st: Record<string, unknown>, settings: Setting[]): [string, unknown][] {
	if (isSteps(st)) return [];
	return Object.entries(st).filter(([k]) => !settings.some((s) => s.attr === k));
}

/** The settings shown for an entry: the first few, and any it already sets. */
export const shownSettings = (all: Setting[], st: Record<string, unknown>, more: boolean) =>
	more ? all : all.filter((s, i) => i < FIRST || st[s.attr] !== undefined);
