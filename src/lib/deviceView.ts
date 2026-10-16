/**
 * One device, for an admin (A1): what it reports, which readings have a
 * history worth drawing, and where it is used.
 */
import { cap, reading, words } from './card.js';
import type { CoreDevice, Schema } from './devices.js';
import { rulesNaming, type RuleRef } from './uses.js';

export interface Reading {
	attr: string;
	label: string;
	value: string;
	diagnostic: boolean;
}

const EMPTY: Schema = { attributes: {} };

/** Everything it reports, primary readings first, diagnostics last. */
export function readingsOf(d: CoreDevice): Reading[] {
	const schema = d.schema ?? EMPTY;
	const primary = schema.primary ?? [];
	const rank = (a: string) => {
		const p = primary.indexOf(a);
		if (p >= 0) return p;
		return schema.attributes[a]?.category === 'diagnostic' ? 1000 : 500;
	};
	return Object.keys(d.attributes)
		.filter((a) => !a.endsWith('_unit'))
		.map((attr) => {
			const spec = schema.attributes[attr];
			const raw = d.attributes[attr];
			const value =
				reading(d.attributes, schema, attr) ??
				(raw === null || raw === undefined ? '—' : JSON.stringify(raw));
			return {
				attr,
				label: spec?.display_name ?? cap(words(attr)),
				value,
				diagnostic: spec?.category === 'diagnostic'
			};
		})
		.sort((a, b) => rank(a.attr) - rank(b.attr) || a.label.localeCompare(b.label));
}

export interface Charted {
	attr: string;
	label: string;
	unit?: string;
	bool: boolean;
}

/** Up to `max` readings worth a history chart: numbers and on/offs, not diagnostics. */
export function chartable(d: CoreDevice, max = 3): Charted[] {
	const schema = d.schema ?? EMPTY;
	const primary = schema.primary ?? [];
	const rank = (a: string) => (primary.includes(a) ? primary.indexOf(a) : 100);
	return Object.entries(d.attributes)
		.filter(([attr, v]) => {
			const spec = schema.attributes[attr];
			if (spec?.category === 'diagnostic' || spec?.category === 'config') return false;
			if (/battery|rssi|linkquality|signal/.test(attr)) return false;
			return typeof v === 'number' || typeof v === 'boolean';
		})
		.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
		.slice(0, max)
		.map(([attr, v]) => {
			const spec = schema.attributes[attr];
			return {
				attr,
				label: spec?.display_name ?? cap(words(attr)),
				unit: spec?.unit,
				bool: typeof v === 'boolean'
			};
		});
}

export interface Uses {
	rules: RuleRef[];
	scenes: { id: string; name: string }[];
	alertRules: { id: string; name: string }[];
}

/** Rules, homeCore scenes and alert rules that name the device. */
export function usesOf(
	d: CoreDevice,
	rules: RuleRef[],
	scenes: { id: string; name: string; states?: Record<string, unknown> }[],
	alertRules: { id: string; name: string; device_ids: string[] }[]
): Uses {
	return {
		rules: rulesNaming(rules, d.device_id, d.canonical_name),
		scenes: scenes
			.filter((s) => s.states && d.device_id in s.states)
			.map((s) => ({ id: s.id, name: s.name })),
		alertRules: alertRules
			.filter((r) => r.device_ids.includes(d.device_id))
			.map((r) => ({ id: r.id, name: r.name }))
	};
}
