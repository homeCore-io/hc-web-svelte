/**
 * The units a person reads in. Inside homeCore a reading has one unit, the
 * one its schema declares — °C, hPa, m/s, mm, mm/h (`device_vocabulary.rs`)
 * — and the app shows it in the person's: °F or °C, and US or metric for
 * the rest. What they type goes back in the schema's unit.
 *
 * Kept free of stores so it is tested on plain numbers. The person's choice
 * reaches it through `followUnits` (`personal.svelte.ts`); everything that
 * shows a reading asks `units()`, so it changes the moment they choose.
 */

export type TemperatureUnit = 'F' | 'C';
export type Measures = 'us' | 'metric';

export interface Units {
	temperature: TemperatureUnit;
	measures: Measures;
}

/** What a person has chosen, as their preferences keep it; unset is the browser's. */
export interface UnitsChoice {
	temperature?: TemperatureUnit;
	measures?: Measures;
}

/** Places where a thermometer reads °F and a road sign miles: the US and its territories, and a few more. */
const FAHRENHEIT = new Set([
	'US',
	'PR',
	'GU',
	'VI',
	'AS',
	'MP',
	'UM',
	'LR',
	'MM',
	'BS',
	'BZ',
	'KY',
	'PW',
	'FM',
	'MH'
]);

/** The browser's language says where it is: en-US → °F and US; else °C and metric. */
export function localeUnits(locale?: string): Units {
	let region: string | undefined;
	try {
		const lang = locale ?? (typeof navigator === 'undefined' ? 'en-US' : navigator.language);
		region = new Intl.Locale(lang).maximize().region;
	} catch {
		region = undefined;
	}
	return region !== undefined && FAHRENHEIT.has(region)
		? { temperature: 'F', measures: 'us' }
		: { temperature: 'C', measures: 'metric' };
}

/** The units a person reads in: what they chose, the browser's for the rest. */
export function unitsOf(chosen: UnitsChoice | undefined, locale?: string): Units {
	const usual = localeUnits(locale);
	return {
		temperature: chosen?.temperature ?? usual.temperature,
		measures: chosen?.measures ?? usual.measures
	};
}

let source: () => Units = () => localeUnits();

/** Where the person's choice comes from — read on every call, so it can be reactive. */
export function followUnits(from: () => Units): void {
	source = from;
}

/** The units the person reads in, now. */
export const units = (): Units => source();

// ---- the conversions ----

/**
 * Each family of units: how to reach its base (the first) and back, the unit
 * each choice shows, and how many places a shown number keeps.
 */
interface Family {
	/** Spellings a schema might use, each to its canonical name. */
	names: Record<string, string>;
	/** Canonical name → [to base, from base]. */
	scale: Record<string, [(v: number) => number, (v: number) => number]>;
	shown: (u: Units) => string;
	/** Places kept, by canonical shown name. */
	places: Record<string, number>;
}

const same = (v: number) => v;
const times = (k: number): [(v: number) => number, (v: number) => number] => [
	(v) => v * k,
	(v) => v / k
];

const FAMILIES: Family[] = [
	{
		names: {
			'°C': '°C',
			C: '°C',
			'℃': '°C',
			degC: '°C',
			'°F': '°F',
			F: '°F',
			'℉': '°F',
			degF: '°F'
		},
		scale: {
			'°C': [same, same],
			'°F': [(v) => ((v - 32) * 5) / 9, (v) => (v * 9) / 5 + 32]
		},
		shown: (u) => (u.temperature === 'F' ? '°F' : '°C'),
		places: { '°F': 1, '°C': 1 }
	},
	{
		names: { hPa: 'hPa', mbar: 'hPa', mb: 'hPa', inHg: 'inHg' },
		scale: { hPa: [same, same], inHg: times(33.8638866667) },
		shown: (u) => (u.measures === 'us' ? 'inHg' : 'hPa'),
		places: { inHg: 2, hPa: 1 }
	},
	{
		names: { 'm/s': 'm/s', mph: 'mph', 'km/h': 'km/h', kph: 'km/h', kmh: 'km/h' },
		scale: { 'm/s': [same, same], mph: times(0.44704), 'km/h': times(1 / 3.6) },
		shown: (u) => (u.measures === 'us' ? 'mph' : 'm/s'),
		places: { mph: 1, 'm/s': 1 }
	},
	{
		names: { mm: 'mm', in: 'in' },
		scale: { mm: [same, same], in: times(25.4) },
		shown: (u) => (u.measures === 'us' ? 'in' : 'mm'),
		places: { in: 2, mm: 1 }
	},
	{
		names: { 'mm/h': 'mm/h', 'mm/hr': 'mm/h', 'in/h': 'in/h', 'in/hr': 'in/h' },
		scale: { 'mm/h': [same, same], 'in/h': times(25.4) },
		shown: (u) => (u.measures === 'us' ? 'in/h' : 'mm/h'),
		places: { 'in/h': 2, 'mm/h': 1 }
	},
	{
		names: { km: 'km', mi: 'mi' },
		scale: { km: [same, same], mi: times(1.609344) },
		shown: (u) => (u.measures === 'us' ? 'mi' : 'km'),
		places: { mi: 1, km: 1 }
	}
];

function familyOf(unit: string | undefined): { family: Family; name: string } | undefined {
	if (!unit) return undefined;
	const u = unit.trim();
	for (const family of FAMILIES) {
		const name = family.names[u];
		if (name) return { family, name };
	}
	return undefined;
}

/** Whether a reading in `unit` is a temperature. */
export const isTemperature = (unit: string | undefined): boolean =>
	familyOf(unit)?.family === FAMILIES[0];

/** The unit a reading in `unit` is shown in: `°C` → `°F`. Others as they are. */
export function shownUnit(unit: string | undefined, u: Units = units()): string | undefined {
	const f = familyOf(unit);
	return f ? f.family.shown(u) : unit;
}

/** How many places a number in a known unit keeps when shown: inHg 2, °F 1. */
export function placesOf(unit: string | undefined): number | undefined {
	const f = familyOf(unit);
	return f ? f.family.places[f.name] : undefined;
}

const round = (v: number, places: number) => {
	const k = 10 ** places;
	// `|| 0`: never a -0, which reads as "-0" in some places.
	return Math.round(v * k) / k || 0;
};

/** A value in `unit` in the shown unit, unrounded — for a chart's line or a slider. */
export function toShown(value: number, unit: string | undefined, u: Units = units()): number {
	const f = familyOf(unit);
	if (!f) return value;
	const to = f.family.shown(u);
	if (to === f.name) return value;
	return f.family.scale[to]![1](f.family.scale[f.name]![0](value));
}

/**
 * A number the person gave in the shown unit, back in `unit`, the schema's —
 * kept to two places past what the shown one keeps, so 70 °F is stored as
 * 21.111 °C and shows as 70 again.
 */
export function fromShown(value: number, unit: string | undefined, u: Units = units()): number {
	const f = familyOf(unit);
	if (!f) return value;
	const from = f.family.shown(u);
	if (from === f.name) return value;
	const back = f.family.scale[f.name]![1](f.family.scale[from]![0](value));
	return round(back, (f.family.places[f.name] ?? 1) + 2);
}

export interface Shown {
	/** Rounded as the shown unit reads: °F to a tenth, inHg to a hundredth. */
	value: number;
	unit: string | undefined;
	/** Whether it was converted — when not, the caller's own formatting stands. */
	converted: boolean;
}

/** A reading as the person reads it. */
export function shown(value: number, unit: string | undefined, u: Units = units()): Shown {
	const f = familyOf(unit);
	if (!f) return { value, unit, converted: false };
	const to = f.family.shown(u);
	// Its own unit still reads to its places: 21.111 °C, kept from 70 °F, as 21.1.
	if (to === f.name)
		return { value: round(value, f.family.places[to] ?? 1), unit: to, converted: false };
	return {
		value: round(toShown(value, unit, u), f.family.places[to] ?? 1),
		unit: to,
		converted: true
	};
}

/** The number of a shown reading, in words: "70.5", "29.92"; else as `fmt` says. */
export function numberText(s: Shown, fmt: (n: number) => string = String): string {
	return s.converted ? String(s.value) : fmt(s.value);
}

/** A reading with its unit: "70.5 °F", "29.92 inHg", "45%". */
export function readingText(
	value: number,
	unit: string | undefined,
	fmt?: (n: number) => string,
	u: Units = units()
): string {
	const s = shown(value, unit, u);
	const n = numberText(s, fmt);
	if (!s.unit) return n;
	return s.unit === '%' ? `${n}%` : `${n} ${s.unit}`;
}

/**
 * A slider's or a field's range and step in the shown unit: the ends
 * converted and rounded, the step a round number about its converted size
 * (a 0.5 °C step is 1 °F; 1 °C is still 1 °F, not 1.8).
 */
export function shownRange(
	r: { min?: number; max?: number; step?: number },
	unit: string | undefined,
	u: Units = units()
): { min?: number; max?: number; step?: number } {
	const s = shown(0, unit, u);
	if (!s.converted) return r;
	const places = familyOf(s.unit)?.family.places[s.unit!] ?? 1;
	const end = (v: number | undefined) =>
		v === undefined ? undefined : round(toShown(v, unit, u), places);
	let step = r.step;
	if (step !== undefined) {
		// The change of one step, whatever the zero: °C to °F is 1.8 a degree.
		const size = Math.abs(toShown(step, unit, u) - toShown(0, unit, u));
		step = [10, 5, 1, 0.5, 0.1, 0.05, 0.01].find((n) => n <= size * 1.12) ?? 0.01;
	}
	return { min: end(r.min), max: end(r.max), step };
}
