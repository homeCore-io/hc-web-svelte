/**
 * What a device's details show (D3): everything it can do and report,
 * generated from its schema.
 *
 * - **Controls** for every writable attribute the card doesn't already hold,
 *   except one an action claims (`writes`) — a Roku's `select_source` stands in
 *   for its writable `source`, so it is offered once.
 * - **Actions**, grouped by the plugin's own categories. One that needs
 *   nothing is a button; one that needs a choice or a value gets its fields,
 *   with options from the schema, from the device's own attributes
 *   (`options_from.attribute`), or from other devices (`options_from.devices`).
 * - **Readings**, then the diagnostic and config attributes in a "More" fold.
 * - Which reading to **chart** over the last day.
 *
 * Customising details per device or kind (D3) slots in here later: a layout
 * would choose and order these parts rather than replace the generator.
 */
import { cardFor, kindOf, reading, type CardView } from './card.js';
import {
	displayName,
	type AttributeSchema,
	type CoreDevice,
	type ParamSpec,
	type Schema
} from './devices.js';

export interface Option {
	value: string;
	label: string;
	/** A meaning ("fan") the plugin gave it, drawn when the app has one. */
	icon?: string;
}

export type DetailControl =
	| { kind: 'toggle'; attr: string; label: string; value: boolean }
	| {
			kind: 'slider';
			attr: string;
			label: string;
			value: number;
			min: number;
			max: number;
			step: number;
			unit?: string;
	  }
	| { kind: 'choice'; attr: string; label: string; value: string; options: Option[] }
	| { kind: 'colour'; attr: string; label: string; value: { x: number; y: number } | null }
	| { kind: 'text'; attr: string; label: string; value: string };

export type Field =
	| {
			kind: 'choice';
			name: string;
			label: string;
			options: Option[];
			value: string;
			numeric: boolean;
	  }
	| {
			kind: 'number';
			name: string;
			label: string;
			value: number;
			min?: number;
			max?: number;
			unit?: string;
	  }
	| { kind: 'toggle'; name: string; label: string; value: boolean }
	| { kind: 'text'; name: string; label: string; value: string };

export interface ActionView {
	id: string;
	label: string;
	confirm?: string;
	/** Required parameters, as fields; empty for a plain button. */
	fields: Field[];
}

export interface ActionGroup {
	title: string;
	actions: ActionView[];
}

export interface Line {
	/** The attribute it reads — unique, unlike its label. */
	attr: string;
	label: string;
	value: string;
}

export interface DetailsView {
	card: CardView;
	name: string;
	controls: DetailControl[];
	groups: ActionGroup[];
	readings: Line[];
	more: Line[];
	/** The reading worth a chart of the last day, if any. */
	chart?: { attr: string; label: string; unit?: string; bool: boolean };
}

/** Kinds whose leftover readings go under More rather than Readings. */
const QUIET_READINGS = new Set([
	'light',
	'switch',
	'outlet',
	'fan',
	'media_player',
	'tv',
	'speaker'
]);

/** What the card's own control and Large extras already cover, by kind. */
function onCard(card: CardView): Set<string> {
	const covered = new Set<string>();
	if (card.control?.kind === 'switch') covered.add(card.control.attr);
	if (card.control?.kind === 'lock') covered.add('locked');
	for (const e of card.extras) if ('attr' in e) covered.add(e.attr);
	for (const c of card.channels) covered.add(c.attr);
	return covered;
}

export function detailsFor(d: CoreDevice, all: CoreDevice[] = [], now = Date.now()): DetailsView {
	const card = cardFor(d, now);
	const s: Schema = d.schema ?? { attributes: {} };
	const a = d.attributes;
	const claimed = new Set((s.actions ?? []).map((x) => x.writes).filter(Boolean));
	const covered = onCard(card);

	const names = ordered(s);
	const controls: DetailControl[] = [];
	const readings: Line[] = [];
	const more: Line[] = [];

	for (const name of names) {
		const spec = s.attributes[name]!;
		const value = a[name];
		if (spec.category !== undefined) {
			const text = lineFor(a, s, name);
			if (text !== undefined) more.push({ attr: name, label: labelOf(name, spec), value: text });
			continue;
		}
		if (spec.writable && !covered.has(name) && !claimed.has(name)) {
			const control = controlFor(name, spec, value, a);
			if (control !== undefined) {
				controls.push(control);
				continue;
			}
		}
		if (spec.writable && (covered.has(name) || claimed.has(name))) continue;
		if (spec.kind === 'json') continue;
		const text = lineFor(a, s, name);
		if (text === undefined) continue;
		// A light, switch or fan says what matters on its card and controls;
		// whatever else its bridge reports (Hue's mirek, its effect state) is
		// housekeeping to everyone but the curious.
		(QUIET_READINGS.has(card.kind) ? more : readings).push({
			attr: name,
			label: labelOf(name, spec),
			value: text
		});
	}

	return {
		card,
		name: displayName(d),
		controls,
		groups: groupsOf(d, s, all),
		readings: once(readings),
		more: once(more),
		chart: chartFor(d, s)
	};
}

function controlFor(
	name: string,
	spec: AttributeSchema,
	value: unknown,
	a: Record<string, unknown>
): DetailControl | undefined {
	const label = labelOf(name, spec);
	switch (spec.kind) {
		case 'bool':
			return { kind: 'toggle', attr: name, label, value: value === true };
		case 'integer':
		case 'float':
		case 'color_temp':
			if (spec.min === undefined || spec.max === undefined) return undefined;
			return {
				kind: 'slider',
				attr: name,
				label: spec.kind === 'color_temp' ? 'Warmth' : label,
				value: typeof value === 'number' ? value : spec.min,
				min: spec.min,
				max: spec.max,
				step: spec.step ?? (spec.kind === 'color_temp' ? 50 : spec.kind === 'integer' ? 1 : 0.1),
				unit: spec.unit
			};
		case 'enum':
			return {
				kind: 'choice',
				attr: name,
				label,
				value: String(value ?? ''),
				options: (spec.options ?? []).map((o) =>
					typeof o === 'string'
						? { value: o, label: words(o) }
						: {
								value: o.value,
								label: o.label ?? words(o.value),
								...(o.icon ? { icon: o.icon } : {})
							}
				)
			};
		case 'color_xy':
			return {
				kind: 'colour',
				attr: name,
				label: 'Colour',
				value: isXy(value) ? value : null
			};
		case 'string': {
			// A writable string with a published list beside it is a choice:
			// `source` and `available_sources`.
			const list = a[`available_${name}s`] ?? a[`available_${name}`];
			const options = optionsFromList(list);
			if (options.length > 0)
				return { kind: 'choice', attr: name, label, value: String(value ?? ''), options };
			return { kind: 'text', attr: name, label, value: String(value ?? '') };
		}
		default:
			return undefined;
	}
}

const CATEGORY_ORDER = ['Power', 'Transport', 'Volume', 'Apps', 'Content', 'Live TV', 'Buttons'];

function groupsOf(d: CoreDevice, s: Schema, all: CoreDevice[]): ActionGroup[] {
	const groups = new Map<string, ActionView[]>();
	for (const action of s.actions ?? []) {
		const fields = (action.params ?? [])
			.filter((p) => p.required)
			.map((p) => fieldFor(p, d, all))
			.filter((f): f is Field => f !== undefined);
		// A choice with nothing to choose from (a Roku that publishes no TV
		// channels) can't be run; offering it would be a dead control.
		if (fields.some((f) => f.kind === 'choice' && f.options.length === 0)) continue;
		const view: ActionView = {
			id: action.id,
			label: action.label,
			confirm: action.confirm,
			fields
		};
		const title = action.category ?? 'Actions';
		const list = groups.get(title);
		if (list) list.push(view);
		else groups.set(title, [view]);
	}
	const rank = (t: string) => {
		const i = CATEGORY_ORDER.indexOf(t);
		return i < 0 ? CATEGORY_ORDER.length : i;
	};
	return [...groups.entries()]
		.sort(([x], [y]) => rank(x) - rank(y) || x.localeCompare(y))
		.map(([title, actions]) => ({ title, actions }));
}

function fieldFor(p: ParamSpec, d: CoreDevice, all: CoreDevice[]): Field | undefined {
	const label = p.label ?? words(p.name);
	let options: Option[] | undefined;
	if (p.options)
		options = p.options.map((o) => ({ value: o.value, label: o.label ?? words(o.value) }));
	else if (p.options_from?.attribute) {
		const src = p.options_from.attribute;
		options = optionsFromList(d.attributes[src.attribute], src.label_key, src.value_key);
	} else if (p.options_from?.devices) {
		const want = p.options_from.devices;
		options = all
			.filter((x) => !(want.exclude_self && x.device_id === d.device_id))
			.filter((x) => !want.plugin_id || x.plugin_id === want.plugin_id)
			.filter(
				(x) => !(want.device_type ?? want.facet) || kindOf(x) === (want.device_type ?? want.facet)
			)
			.map((x) => ({ value: x.device_id, label: displayName(x) }))
			.sort((x, y) => x.label.localeCompare(y.label));
	}
	if (options !== undefined) {
		return {
			kind: 'choice',
			name: p.name,
			label,
			options,
			value: p.default !== undefined ? String(p.default) : (options[0]?.value ?? ''),
			numeric: p.kind === 'int' || p.kind === 'float'
		};
	}
	switch (p.kind) {
		case 'int':
		case 'float':
		case 'duration':
			return {
				kind: 'number',
				name: p.name,
				label,
				value: typeof p.default === 'number' ? p.default : (p.min ?? 0),
				min: p.min,
				max: p.max,
				unit: p.kind === 'duration' ? 's' : p.unit
			};
		case 'bool':
			return { kind: 'toggle', name: p.name, label, value: p.default === true };
		case 'string':
		case 'enum':
			return {
				kind: 'text',
				name: p.name,
				label,
				value: typeof p.default === 'string' ? p.default : ''
			};
		default:
			// Colour pickers and raw JSON parameters wait for customised details.
			return undefined;
	}
}

/** The command body for an action and the values its fields hold. */
export function actionBody(
	action: ActionView,
	values: Record<string, unknown>
): Record<string, unknown> {
	const body: Record<string, unknown> = { action: action.id };
	for (const f of action.fields) {
		const v = values[f.name] ?? f.value;
		body[f.name] = f.kind === 'choice' && f.numeric ? Number(v) : v;
	}
	return body;
}

/** Whether every field of an action has something in it. */
export function ready(action: ActionView, values: Record<string, unknown>): boolean {
	return action.fields.every((f) => {
		const v = values[f.name] ?? f.value;
		return f.kind === 'toggle' || (v !== '' && v !== undefined && v !== null);
	});
}

function chartFor(d: CoreDevice, s: Schema): DetailsView['chart'] {
	const kind = kindOf(d);
	// What a player reports changes by the second and charts as noise.
	if (kind === 'media_player' || kind === 'tv' || kind === 'speaker') return undefined;
	const prefer: Record<string, string> = {
		light: 'brightness_pct',
		temperature_sensor: 'temperature',
		weather_station: 'temperature',
		switch: 'power_w'
	};
	const candidates = [prefer[kind], ...(s.primary ?? [])].filter((n): n is string => !!n);
	for (const name of candidates) {
		const spec = s.attributes[name];
		if (!spec || spec.category !== undefined) continue;
		if (spec.kind === 'integer' || spec.kind === 'float')
			return { attr: name, label: labelOf(name, spec), unit: spec.unit, bool: false };
		if (spec.kind === 'bool' && name !== 'on')
			return { attr: name, label: labelOf(name, spec), bool: true };
	}
	return undefined;
}

function optionsFromList(list: unknown, labelKey = 'name', valueKey?: string): Option[] {
	if (!Array.isArray(list)) return [];
	return list
		.map((item): Option | undefined => {
			if (typeof item === 'string' || typeof item === 'number')
				return { value: String(item), label: String(item) };
			if (item && typeof item === 'object') {
				const o = item as Record<string, unknown>;
				const value = o[valueKey ?? 'id'] ?? o.value ?? o[labelKey];
				const label = o[labelKey] ?? value;
				if (value === undefined) return undefined;
				return { value: String(value), label: String(label) };
			}
			return undefined;
		})
		.filter((o): o is Option => o !== undefined);
}

function lineFor(a: Record<string, unknown>, s: Schema, name: string): string | undefined {
	const v = a[name];
	if (v === undefined || v === null) return undefined;
	if (Array.isArray(v) || typeof v === 'object') return undefined;
	return reading(a, s, name);
}

function ordered(s: Schema): string[] {
	const primary = (s.primary ?? []).filter((n) => n in s.attributes);
	const rest = Object.keys(s.attributes)
		.filter((n) => !primary.includes(n))
		.sort();
	return [...primary, ...rest];
}

function labelOf(name: string, spec: AttributeSchema): string {
	if (spec.display_name) return spec.display_name;
	const w = words(name.replace(/_(pct|secs|w|kwh)$/, ''));
	return w[0]!.toUpperCase() + w.slice(1);
}

function words(s: string): string {
	return s.replace(/[_.-]+/g, ' ').trim();
}

function isXy(v: unknown): v is { x: number; y: number } {
	return !!v && typeof v === 'object' && typeof (v as { x?: unknown }).x === 'number';
}

/**
 * A reading said once. A bridge can publish one thing under two names — the
 * Sonos plugin sends a track's length as `duration` and `media_duration` —
 * and the same label with the same value twice is noise.
 */
function once(lines: Line[]): Line[] {
	const seen = new Set<string>();
	return lines.filter((l) => {
		const k = `${l.label}\u0000${l.value}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}
