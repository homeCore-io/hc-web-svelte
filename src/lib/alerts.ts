/**
 * Alerts (N7, C9, M6): what the house's own state says needs attention —
 * something wet, smoke, a device offline, a lock jammed, a battery low, or
 * an admin's time rule ("garage open after 22:00"). homeCore raises and
 * clears them (H4); screens only show them, so two screens never disagree.
 *
 * Kept current from the event stream: the snapshot on connect, then
 * `alert_raised` and `alert_cleared`.
 *
 * Someone can say they've seen one (it stays, marked, until it clears) or
 * ignore some — a kind, a device's, a rule's — for good or for a while;
 * homeCore 0.1.81 and later. An ignored alert isn't raised at all.
 */
import type { Frame } from './house.js';
import type { CoreDevice } from './devices.js';
import { fromShown, shown, shownUnit } from './units.js';

export type AlertKind = 'wet' | 'smoke' | 'offline' | 'jammed' | 'low_battery' | 'rule' | 'plugin';

/** A plugin alert's button (homeCore 0.1.85): one of the device's actions, or the plugin's. */
export interface AlertAction {
	label: string;
	id: string;
	target?: 'device' | 'plugin';
	params?: Record<string, unknown>;
	confirm?: boolean;
}

export interface Alert {
	/** Stable while the condition lasts: `wet:{device}`, `rule:{rule}:{device}`. */
	id: string;
	kind: AlertKind;
	device_id: string;
	rule_id?: string;
	/** In words, for a person: "Garage Door open after 22:00". */
	message: string;
	/** The same without the device's name, for its card: "Open after 22:00". */
	reason: string;
	/** Time rules raise warning or critical; plugins info, warning or error. */
	severity: 'info' | 'warning' | 'error' | 'critical';
	raised_at: string;
	/** Someone has seen it; it stays until it clears. */
	acknowledged?: { by: string; at: string };
	/** A plugin's alert: which plugin, which of its kinds, what it's about. */
	plugin_id?: string;
	topic?: string;
	key?: string;
	action?: AlertAction;
}

/** Alerts not to show: a kind, a device's, a rule's — or a kind on one device. */
export interface AlertIgnore {
	id: string;
	kind?: AlertKind;
	device_id?: string;
	rule_id?: string;
	plugin_id?: string;
	topic?: string;
	/** The plugin alert about this (a version): "skip this one". */
	key?: string;
	/** Until then; for good when missing. */
	until?: string;
	note?: string;
	by?: string;
	created_at?: string;
}

/** What each kind is, in words. */
export const KIND_WORDS: Record<AlertKind, string> = {
	wet: 'something wet',
	smoke: 'smoke',
	offline: 'offline',
	jammed: 'a jammed lock',
	low_battery: 'low battery',
	rule: 'a rule’s alert',
	plugin: 'a plugin’s alert'
};

export type IgnoreScope = 'this' | 'kind' | 'device' | 'key';

/**
 * An ignore for an alert: just this (its kind on its device — its rule on
 * its device, for a rule's), every one of its kind (every alert of its
 * rule), or everything about its device.
 */
export function ignoreFor(a: Alert, scope: IgnoreScope, until?: string): Omit<AlertIgnore, 'id'> {
	if (a.kind === 'plugin' && a.plugin_id) {
		const kindOf = {
			kind: 'plugin' as const,
			plugin_id: a.plugin_id,
			...(a.topic ? { topic: a.topic } : {})
		};
		const base =
			scope === 'device'
				? { device_id: a.device_id }
				: scope === 'kind'
					? kindOf
					: scope === 'key' && a.key
						? { ...kindOf, device_id: a.device_id, key: a.key }
						: { ...kindOf, device_id: a.device_id };
		return until ? { ...base, until } : base;
	}
	const by = a.kind === 'rule' && a.rule_id ? { rule_id: a.rule_id } : ({ kind: a.kind } as const);
	const base =
		scope === 'device'
			? { device_id: a.device_id }
			: scope === 'kind'
				? by
				: { ...by, device_id: a.device_id };
	return until ? { ...base, until } : base;
}

/** An ignore in a sentence: "Low battery on Front Lock, until 25 Oct". */
export function describeIgnore(
	i: AlertIgnore,
	nameOf: (deviceId: string) => string,
	ruleOf: (ruleId: string) => string | undefined,
	untilText?: (iso: string) => string,
	topicLabel?: (pluginId: string, topic: string) => string | undefined
): string {
	const device = i.device_id ? nameOf(i.device_id) : undefined;
	const rule = i.rule_id ? (ruleOf(i.rule_id) ?? 'a deleted rule') : undefined;
	let s: string;
	if (rule) s = device ? `“${rule}” on ${device}` : `Everything “${rule}” raises`;
	else if (i.plugin_id) {
		const what = i.topic
			? (topicLabel?.(i.plugin_id, i.topic) ?? i.topic.replace(/_/g, ' '))
			: `${i.plugin_id.replace(/^plugin\./, '')} alerts`;
		const W = what.charAt(0).toUpperCase() + what.slice(1);
		s = `${W}${i.key ? ` about ${i.key}` : ''}${device ? ` on ${device}` : ''}`;
	} else if (i.kind) {
		const k = KIND_WORDS[i.kind];
		const K = k.charAt(0).toUpperCase() + k.slice(1);
		s = device ? `${K} on ${device}` : `Every ${k === 'smoke' ? 'smoke alert' : k}`;
	} else s = device ? `Everything about ${device}` : 'Nothing';
	if (i.until) s += `, until ${untilText ? untilText(i.until) : i.until}`;
	return s;
}

/** Whether an ignore has run out. */
export const ranOut = (i: AlertIgnore, now: number) =>
	i.until !== undefined && Date.parse(i.until) <= now;

/** A time rule (C9), made by an admin in Settings and checked by homeCore. */
export interface AlertRule {
	id: string;
	name: string;
	enabled: boolean;
	device_ids: string[];
	/** The state that counts: `open` is `true`, say. */
	attribute: string;
	value: unknown;
	/** The state in the device's own words ("Open"), for the alert's message. */
	state_label?: string | null;
	/** Only between these times of day, `HH:MM`; `after` later than `until` spans midnight. */
	after?: string | null;
	until?: string | null;
	/** Only once it has lasted this long. */
	for_minutes?: number | null;
	severity: 'critical' | 'warning';
	/** How the value counts: equal (when missing), not, or a number above or below it. */
	op?: 'eq' | 'ne' | 'above' | 'below';
	/** A notification channel told when it's raised (homeCore 0.1.81+). */
	notify?: string | null;
}

type AlertFrame =
	| { type: 'snapshot'; alerts?: Alert[] }
	| { type: 'alert_raised'; alert: Alert }
	| { type: 'alert_cleared'; alert_id: string };

/** The list after a frame, or `undefined` if the frame isn't about alerts. */
export function alertsAfter(list: Alert[], frame: Frame): Alert[] | undefined {
	const f = frame as AlertFrame;
	switch (f.type) {
		case 'snapshot':
			return f.alerts === undefined ? undefined : sortAlerts(f.alerts);
		case 'alert_raised':
			return sortAlerts([...list.filter((a) => a.id !== f.alert.id), f.alert]);
		case 'alert_cleared':
			return list.filter((a) => a.id !== f.alert_id);
		default:
			return undefined;
	}
}

/** Most serious first, then newest. */
export function sortAlerts(list: Alert[]): Alert[] {
	const rank = (a: Alert) => (a.severity === 'critical' ? 0 : 1);
	return [...list].sort(
		(a, b) => rank(a) - rank(b) || Date.parse(b.raised_at) - Date.parse(a.raised_at)
	);
}

/** One alert per device for its card: the most serious. */
export function byDevice(list: Alert[]): Map<string, Alert> {
	const out = new Map<string, Alert>();
	for (const a of sortAlerts(list)) if (!out.has(a.device_id)) out.set(a.device_id, a);
	return out;
}

// ---- writing a rule (Settings) ----

export interface StateChoice {
	attribute: string;
	value: unknown;
	label: string;
	/** A reading over or under a number the rule gives, rather than a value. */
	op?: 'above' | 'below';
	unit?: string;
}

/**
 * The states a rule can name for a device, in the device's own words:
 * each yes/no reading both ways ("Open", "Closed"), and each option of a
 * list. Diagnostic and settings readings are left out.
 */
export function stateChoices(d: CoreDevice): StateChoice[] {
	const out: StateChoice[] = [];
	const attrs = d.schema?.attributes ?? {};
	const names = Object.keys(attrs).length > 0 ? Object.keys(attrs) : Object.keys(d.attributes);
	for (const attr of names) {
		const spec = attrs[attr];
		if (spec?.category) continue;
		const title = spec?.display_name ?? words(attr);
		const kind = spec?.kind ?? (typeof d.attributes[attr] === 'boolean' ? 'bool' : undefined);
		if (kind === 'bool') {
			out.push(
				{ attribute: attr, value: true, label: spec?.states?.when_true.label ?? `${title}: yes` },
				{ attribute: attr, value: false, label: spec?.states?.when_false.label ?? `${title}: no` }
			);
		} else if (kind === 'enum') {
			for (const o of spec?.options ?? []) {
				const value = typeof o === 'string' ? o : o.value;
				const label = typeof o === 'string' ? words(o) : (o.label ?? words(o.value));
				out.push({ attribute: attr, value, label: `${title}: ${label}` });
			}
		}
	}
	return out;
}

/**
 * A number a rule can watch go over or under a line: each numeric reading,
 * both ways ("Temperature above…"). homeCore 0.1.81 and later.
 */
export function levelChoices(d: CoreDevice): StateChoice[] {
	const out: StateChoice[] = [];
	for (const [attr, spec] of Object.entries(d.schema?.attributes ?? {})) {
		if (spec.category) continue;
		if (!['integer', 'float', 'number'].includes(spec.kind ?? '')) continue;
		const title = spec.display_name ?? words(attr);
		for (const op of ['above', 'below'] as const)
			out.push({ attribute: attr, value: null, label: `${title} ${op}`, op, unit: spec.unit });
	}
	return out;
}

type Same = Pick<StateChoice, 'attribute' | 'value'> & { op?: string };
/** The same state, on any device: `open` is `true`; a level by its reading and way. */
export const sameState = (a: Same, b: Same) => {
	const level = (x: Same) => x.op === 'above' || x.op === 'below';
	if (level(a) || level(b)) return a.attribute === b.attribute && a.op === b.op;
	return a.attribute === b.attribute && JSON.stringify(a.value) === JSON.stringify(b.value);
};

/**
 * A level rule's state in words: "Temperature above 86 °F" — `n` as the
 * person typed it, in their units (`toLevel` keeps it in the schema's).
 */
export const levelLabel = (c: Pick<StateChoice, 'label' | 'unit'>, n: number) => {
	const unit = shownUnit(c.unit);
	return `${c.label} ${n}${unit ? ` ${unit}` : ''}`;
};

/** A level rule's line as the person reads it: 30 °C → 86 °F. */
export const fromLevel = (c: Pick<StateChoice, 'unit'>, value: number) =>
	shown(value, c.unit).value;
/** The line they typed, as the rule keeps it: 86 °F → 30 °C. */
export const toLevel = (c: Pick<StateChoice, 'unit'>, typed: number) => fromShown(typed, c.unit);

/**
 * The devices that can share a rule's state: one rule watches several
 * devices only by the same reading and value — every door "open", not one
 * door open and one lock unlocked.
 */
export function devicesFor(all: CoreDevice[], state: Same): CoreDevice[] {
	return all.filter((d) =>
		[...stateChoices(d), ...levelChoices(d)].some((c) => sameState(c, state))
	);
}

/** A rule's name when its maker gives none: "Garage Door, Back Door: Open after 22:00". */
export function ruleName(names: string[], said: string): string {
	const who = names.length <= 2 ? names.join(', ') : `${names[0]} and ${names.length - 1} more`;
	return `${who}: ${said}`;
}

/** What a rule says, in a sentence: "Open after 22:00 for 10 min". */
export function describeRule(
	rule: Pick<AlertRule, 'after' | 'until' | 'for_minutes'>,
	state: string
): string {
	let s = state;
	if (rule.after && rule.until) s += ` between ${rule.after} and ${rule.until}`;
	else if (rule.after) s += ` after ${rule.after}`;
	else if (rule.until) s += ` before ${rule.until}`;
	if (rule.for_minutes) s += ` for ${rule.for_minutes} min`;
	return s;
}

const words = (s: string) => {
	const w = s.replace(/[_-]+/g, ' ').trim();
	return w.charAt(0).toUpperCase() + w.slice(1);
};
