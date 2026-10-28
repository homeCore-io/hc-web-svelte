/**
 * One device, for an admin (A1): what it reports, which readings have a
 * history worth drawing, and where it is used.
 */
import { cap, isoMoment, momentText, reading, uncamel, words } from './card.js';
import type { CoreDevice, Schema } from './devices.js';
import { rulesNaming, type RuleRef } from './uses.js';

export interface Reading {
	attr: string;
	label: string;
	value: string;
	/** For a list or a block of values: all of it, laid out, behind a toggle. */
	detail?: string;
	/** A colour it reports, as CSS, drawn beside the value. */
	swatch?: string;
	diagnostic: boolean;
}

const EMPTY: Schema = { attributes: {} };

/** Everything it reports, primary readings first, diagnostics last. */
export function readingsOf(
	d: CoreDevice,
	nameOf: (id: string) => string | undefined = () => undefined
): Reading[] {
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
			const said = sayValue(raw, nameOf);
			const value =
				said?.value ??
				reading(d.attributes, schema, attr) ??
				(raw === null || raw === undefined ? '—' : JSON.stringify(raw));
			return {
				attr,
				label: spec?.display_name ?? cap(words(attr)),
				value,
				...(said?.detail ? { detail: said.detail } : {}),
				...(said?.swatch ? { swatch: said.swatch } : {}),
				diagnostic: spec?.category === 'diagnostic'
			};
		})
		.sort((a, b) => rank(a.attr) - rank(b.attr) || a.label.localeCompare(b.label));
}

/** What an item in a list is called, if it says. */
const titleOf = (x: unknown): string | undefined => {
	if (!x || typeof x !== 'object') return undefined;
	const o = x as Record<string, unknown>;
	const t = o.title ?? o.name ?? o.label ?? o.id;
	return typeof t === 'string' ? t : undefined;
};

/**
 * A value that isn't a plain reading, said for a person: a list of names
 * as names, a list of things by their titles, a block by what it holds — the
 * whole of it laid out behind a toggle — and a device's id as its name.
 * Undefined leaves it to the ordinary reading.
 */
export function sayValue(
	raw: unknown,
	nameOf: (id: string) => string | undefined = () => undefined
): { value: string; detail?: string; swatch?: string } | undefined {
	if (typeof raw === 'string') {
		const name = nameOf(raw);
		if (name) return { value: name };
		// An address is said as it is, never capitalised or split into words.
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return { value: raw };
		return undefined;
	}
	if (Array.isArray(raw)) {
		if (raw.length === 0) return { value: 'None' };
		if (raw.every((x) => typeof x === 'string' || typeof x === 'number')) {
			const names = raw.map((x) => nameOf(String(x)) ?? String(x));
			return { value: names.join(', ') };
		}
		const titles = raw.map(titleOf).filter((t): t is string => !!t);
		const count = `${raw.length} ${raw.length === 1 ? 'item' : 'items'}`;
		return {
			value: titles.length === raw.length ? titles.join(', ') : count,
			detail: JSON.stringify(raw, null, 2)
		};
	}
	if (raw && typeof raw === 'object') {
		const o = raw as Record<string, unknown>;
		// A colour as a colour, not "b, g, r".
		const ch = ['r', 'g', 'b'].map((k) => o[k]);
		if (ch.every((v) => typeof v === 'number') && Object.keys(o).length <= 4) {
			const [r, g, b] = ch as number[];
			return { value: `Red ${r} · green ${g} · blue ${b}`, swatch: `rgb(${r}, ${g}, ${b})` };
		}
		// A few plain values said in a line: "Duration 30 · mode fade".
		const keys = Object.keys(raw);
		const plain = keys.every((k) => ['string', 'number', 'boolean'].includes(typeof o[k]));
		if (plain && keys.length > 0 && keys.length <= 4)
			return {
				value: keys
					.map((k, i) => {
						const v = o[k];
						const said =
							typeof v === 'string' && isoMoment(v) !== undefined
								? momentText(isoMoment(v)!)
								: typeof v === 'string'
									? (nameOf(v) ?? (uncamel(v) !== v ? uncamel(v).toLowerCase() : words(v)))
									: typeof v === 'boolean'
										? v
											? 'yes'
											: 'no'
										: String(v);
						const label = words(k);
						return `${i === 0 ? cap(label) : label} ${said}`;
					})
					.join(' · ')
			};
		return {
			value: keys.length ? keys.map((k) => words(k)).join(', ') : 'Nothing',
			detail: JSON.stringify(raw, null, 2)
		};
	}
	return undefined;
}

export interface Charted {
	attr: string;
	label: string;
	unit?: string;
	bool: boolean;
}

/**
 * Readings no chart helps with: how far through a track it is and how long
 * the track is (they measure what's playing, not the device), and tone
 * settings someone sets once (bass, treble, loudness, shuffle, repeat).
 */
const UNCHARTED =
	/battery|rssi|linkquality|signal|(^|_)(duration|position|elapsed|remaining)(_|$)|_secs$|^(bass|treble|loudness|balance|crossfade|night_mode|speech_enhancement|shuffle|repeat)$/;

/**
 * Up to `max` readings worth a history chart: numbers and on/offs, not
 * diagnostics or settings — what the plugin calls its main readings first,
 * then those that have changed most recently, so a reading that sits still
 * doesn't take a chart from one that moves.
 */
export function chartable(d: CoreDevice, max = 3): Charted[] {
	const schema = d.schema ?? EMPTY;
	const primary = schema.primary ?? [];
	const changed = (a: string) => {
		const at = d.attributes_changed_at?.[a];
		return at ? Date.parse(at) : 0;
	};
	return Object.entries(d.attributes)
		.filter(([attr, v]) => {
			const spec = schema.attributes[attr];
			if (spec?.category === 'diagnostic' || spec?.category === 'config') return false;
			if (UNCHARTED.test(attr)) return false;
			return typeof v === 'number' || typeof v === 'boolean';
		})
		.sort(([a], [b]) => {
			const pa = primary.indexOf(a);
			const pb = primary.indexOf(b);
			if (pa >= 0 || pb >= 0) return (pa < 0 ? 1e3 : pa) - (pb < 0 ? 1e3 : pb);
			return changed(b) - changed(a) || a.localeCompare(b);
		})
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
