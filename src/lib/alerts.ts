/**
 * Alerts (N7, C9, M6): what the house's own state says needs attention —
 * something wet, smoke, a device offline, a lock jammed, a battery low, or
 * an admin's time rule ("garage open after 22:00"). homeCore raises and
 * clears them (H4); screens only show them, so two screens never disagree.
 *
 * Kept current from the event stream: the snapshot on connect, then
 * `alert_raised` and `alert_cleared`.
 */
import type { Frame } from './house.js';
import type { CoreDevice } from './devices.js';

export type AlertKind = 'wet' | 'smoke' | 'offline' | 'jammed' | 'low_battery' | 'rule';

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
	severity: 'critical' | 'warning';
	raised_at: string;
}

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

/** The same state, on any device: `open` is `true`. */
export const sameState = (
	a: Pick<StateChoice, 'attribute' | 'value'>,
	b: Pick<StateChoice, 'attribute' | 'value'>
) => a.attribute === b.attribute && JSON.stringify(a.value) === JSON.stringify(b.value);

/**
 * The devices that can share a rule's state: one rule watches several
 * devices only by the same reading and value — every door "open", not one
 * door open and one lock unlocked.
 */
export function devicesFor(
	all: CoreDevice[],
	state: Pick<StateChoice, 'attribute' | 'value'>
): CoreDevice[] {
	return all.filter((d) => stateChoices(d).some((c) => sameState(c, state)));
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
