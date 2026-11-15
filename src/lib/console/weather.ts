/**
 * The weather band on Home (the "B" boards): now, the next 24 hours and the
 * next days, from the house's weather service (a device of kind `weather`,
 * the weather plugin's place) and, for the temperature now, from where the
 * household chose (`HouseDoc.home.weather.now`): automatic, the service, or
 * a device that reads outside.
 *
 * Each part is there only when it has something to show; with nothing at
 * all there is no band. Temperatures arrive in °C, as homeCore keeps them,
 * and are shown in the person's unit; wind in mph beside °F, km/h beside °C.
 *
 * Pure: the band draws what this decides.
 */
import { kindOf, skyIcon, type IconName } from '../card.js';
import { displayName, type CoreDevice, type Devices } from '../devices.js';
import type { HouseDoc } from '../layers.js';
import type { Room } from '../house.js';
import { compass, conditionText, forecastOf, type Day } from '../pieces.js';
import { freshOutside, outdoorStation, readingOf } from '../roomBox.js';
import { roomOf } from '../summary.js';
import { toShown, units, type TemperatureUnit } from '../units.js';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
// `|| 0`: never "-0°".
const deg = (n: number) => `${Math.round(n) || 0}°`;
/** A temperature from a forecast, in °C, as the person reads it. */
const shownC = (v: unknown) => {
	const n = num(v);
	return n === undefined ? undefined : toShown(n, '°C');
};
const hourWord = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric' });

// ---- where the temperature now comes from ----

/** Automatic, the weather service, or one device: `device:{id}`. */
export type NowSource = 'auto' | 'service' | `device:${string}`;

/** The household's choice, as kept; anything else is automatic. */
export function nowSourceOf(doc: Pick<HouseDoc, 'home'>): NowSource {
	const v = doc.home?.weather?.now;
	return v === 'service' || (typeof v === 'string' && /^device:.+/.test(v))
		? (v as NowSource)
		: 'auto';
}

/** The household's document with `source` chosen; automatic is kept as nothing. */
export function withNowSource(doc: HouseDoc, source: NowSource): HouseDoc {
	const { weather: _was, ...home } = doc.home ?? {};
	const next = source === 'auto' ? home : { ...home, weather: { now: source } };
	const { home: _old, ...rest } = doc;
	return Object.keys(next).length > 0 ? { ...rest, home: next } : rest;
}

/** Whether a weather service's place has anything at all to say now. */
const says = (d: CoreDevice) =>
	readingOf(d, 'temperature') !== undefined ||
	(Array.isArray(d.attributes.forecast) && d.attributes.forecast.length > 0) ||
	(Array.isArray(d.attributes.forecast_hourly) && d.attributes.forecast_hourly.length > 0);

/**
 * The house's weather service: a weather plugin's place (kind `weather`),
 * the first with something to say, else the first. A house with several
 * places reads the first.
 */
export function serviceOf(all: Devices): CoreDevice | undefined {
	const list = Object.values(all).filter((d) => kindOf(d) === 'weather');
	return list.find(says) ?? list[0];
}

/** Names and rooms that say a thermometer is outside. */
const OUTDOORS = /outside|outdoor|exterior|porch|patio|deck|yard|garden|balcony|roof/i;

/**
 * What can give Home its temperature now, besides the service: weather
 * stations, and thermometers whose name or room says they're outside.
 * Stations first, then by name.
 */
export function nowCandidates(all: Devices, rooms: Room[] = []): CoreDevice[] {
	return Object.values(all)
		.filter((d) => {
			const kind = kindOf(d);
			if (kind === 'weather' || typeof d.attributes.temperature !== 'number') return false;
			if (kind === 'weather_station') return true;
			return OUTDOORS.test(displayName(d)) || OUTDOORS.test(roomOf(d, rooms)?.name ?? '');
		})
		.sort(
			(a, b) =>
				Number(kindOf(b) === 'weather_station') - Number(kindOf(a) === 'weather_station') ||
				displayName(a).localeCompare(displayName(b))
		);
}

/**
 * The device whose temperature Home shows now, as the household chose:
 * automatic is the house's station that reported in the last hour, else
 * the weather service (`outdoorStation`, as Home always read it). The
 * service, or a device, is that one while it reports, and automatic again
 * when it doesn't, so Home never loses the temperature it can show.
 */
export function nowFrom(source: NowSource, all: Devices, now?: number): CoreDevice | undefined {
	const reads = (d: CoreDevice | undefined) =>
		d && readingOf(d, 'temperature') !== undefined && freshOutside(d, now) ? d : undefined;
	if (source !== 'auto') {
		const chosen = source === 'service' ? serviceOf(all) : all[source.slice('device:'.length)];
		const d = reads(chosen);
		if (d) return d;
	}
	return outdoorStation(all, now);
}

// ---- wind ----

/** A wind in m/s in the person's: mph beside °F, km/h beside °C. "9 mph". */
export function windText(ms: number, unit: TemperatureUnit = units().temperature): string {
	return unit === 'F' ? `${Math.round(ms / 0.44704)} mph` : `${Math.round(ms * 3.6)} km/h`;
}

// ---- the line under now: a weather warning, else a freeze tonight ----

export interface Note {
	text: string;
	/** Amber for an advisory or a watch and a freeze, red for a warning. */
	tone: 'amber' | 'red';
}

interface Hour {
	at: number;
	temperature?: number;
	rain?: number;
}

/** The service's hours from the current one on, temperatures as the person reads them. */
function hoursFrom(v: unknown, now: number): Hour[] {
	if (!Array.isArray(v)) return [];
	return v
		.flatMap((x): Hour[] => {
			if (typeof x !== 'object' || x === null) return [];
			const f = x as Record<string, unknown>;
			const at = typeof f.time === 'string' ? Date.parse(f.time) : NaN;
			// The hour under way is the first; one an hour or more gone is past.
			if (!Number.isFinite(at) || at <= now - 3600_000) return [];
			return [{ at, temperature: shownC(f.temperature), rain: num(f.precipitation_probability) }];
		})
		.sort((a, b) => a.at - b.at)
		.slice(0, 25);
}

/**
 * The line under now: the service's most serious weather warning, in its
 * words, else "Freezing tonight: 31° by 6 AM" when it expects a freeze, the
 * hour being tonight's coldest in its next 24 hours.
 */
export function noteOf(a: Record<string, unknown>, now: number): Note | undefined {
	const headline = typeof a.alert_headline === 'string' ? a.alert_headline.trim() : '';
	if (headline) return { text: headline, tone: (num(a.alert_level) ?? 1) >= 3 ? 'red' : 'amber' };
	const low = num(a.tonight_low);
	if (a.freeze_tonight !== true || low === undefined) return undefined;
	const coldest = hoursFrom(a.forecast_hourly, now).find(
		(h) => h.temperature !== undefined && Math.abs(h.temperature - toShown(low, '°C')) < 0.06
	);
	const by = coldest ? ` by ${hourWord(coldest.at)}` : '';
	return { text: `Freezing tonight: ${deg(toShown(low, '°C'))}${by}`, tone: 'amber' };
}

// ---- now ----

export interface Now {
	/** "41°". */
	temp: string;
	icon?: IconName;
	/** "Clear", the service's words. */
	condition?: string;
	/** "Feels like 36°". */
	feels?: string;
	high?: string;
	low?: string;
	/** "9 mph". */
	wind?: string;
	/** "62%". */
	humidity?: string;
	note?: Note;
	/** The device it's from, when it isn't the service: "Weather Station". */
	from?: string;
	/** Its temperature now, as the person reads it: the days' dot. */
	value: number;
}

/**
 * Now: the temperature (and humidity) from `from`, the sky, feels like,
 * today's high and low and the wind from the service. Feels like is the
 * service's own only when the temperature is too, so the two agree.
 */
function nowOf(
	from: CoreDevice | undefined,
	service: CoreDevice | undefined,
	now: number,
	night: boolean
): Now | undefined {
	const value = from ? readingOf(from, 'temperature') : undefined;
	if (!from || value === undefined) return undefined;
	const a = service?.attributes ?? {};
	const spec = service?.schema?.attributes.condition;
	const isService = from === service;
	const day = typeof a.is_day === 'boolean' ? a.is_day : !night;
	const feels = isService ? readingOf(from, 'feels_like') : undefined;
	const humidity =
		readingOf(from, 'humidity') ?? (service ? readingOf(service, 'humidity') : undefined);
	const high = shownC(a.today_high);
	const low = shownC(a.today_low);
	const wind = num(a.wind_speed);
	const dir = num(a.wind_direction);
	return {
		temp: deg(value),
		value,
		icon: typeof a.condition === 'string' ? skyIcon(spec, a.condition, day) : undefined,
		condition: typeof a.condition === 'string' ? conditionText(spec, a.condition) : undefined,
		feels: feels === undefined ? undefined : `Feels like ${deg(feels)}`,
		high: high === undefined ? undefined : deg(high),
		low: low === undefined ? undefined : deg(low),
		wind:
			wind === undefined
				? undefined
				: `${windText(wind)}${dir === undefined || wind < 0.5 ? '' : ` ${compass(dir)}`}`,
		humidity: humidity === undefined ? undefined : `${Math.round(humidity)}%`,
		note: service ? noteOf(a, now) : undefined,
		from: isService ? undefined : displayName(from)
	};
}

// ---- the next 24 hours ----

/** The chart's drawing box: its width and height, and the line rain bars stand on. */
export const CHART = { w: 400, h: 86, floor: 76, top: 18, bottom: 54 } as const;

export interface Hours {
	/** The temperature line, an SVG path in `CHART`'s box. */
	path: string;
	/** Where now is on it. */
	dot: { x: number; y: number };
	/** The chance of rain, an hour a bar. */
	bars: { x: number; y: number; w: number; h: number }[];
	/** Now's, the lowest's and the highest's temperature, and the most rain's chance, on the chart. */
	marks: {
		x: number;
		y: number;
		text: string;
		anchor: 'start' | 'middle' | 'end';
		rain?: boolean;
	}[];
	/** Under the chart: "Now", then every three hours; `minor` ones drop on a narrow band. */
	ticks: { at: number; text: string; minor: boolean }[];
	/** The chart in words, for a screen reader. */
	label: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth line through points, a Catmull-Rom spline as cubic curves. */
export function smoothPath(p: { x: number; y: number }[]): string {
	if (p.length === 0) return '';
	let d = `M${r1(p[0]!.x)} ${r1(p[0]!.y)}`;
	for (let i = 0; i < p.length - 1; i++) {
		const [a, b, c, e] = [p[i - 1] ?? p[i]!, p[i]!, p[i + 1]!, p[i + 2] ?? p[i + 1]!];
		const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 };
		const c2 = { x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 };
		d += ` C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(c.x)} ${r1(c.y)}`;
	}
	return d;
}

/** Rain this likely or more is named: on the chart, beside a day. */
export const RAIN_SHOWN = 20;

/**
 * The next 24 hours from the service's `forecast_hourly`: the temperature as
 * a line, the chance of rain as bars under it, the lows and highs named.
 * Undefined with fewer than two hours that have a temperature.
 */
export function hoursOf(v: unknown, now: number): Hours | undefined {
	const hours = hoursFrom(v, now).filter((h) => h.temperature !== undefined);
	if (hours.length < 2) return undefined;
	const temps = hours.map((h) => h.temperature!);
	const lo = Math.min(...temps);
	const hi = Math.max(...temps);
	const span = hi - lo || 1;
	const step = CHART.w / (hours.length - 1);
	const pts = hours.map((h, i) => ({
		x: i * step,
		y: CHART.bottom - ((h.temperature! - lo) / span) * (CHART.bottom - CHART.top)
	}));
	const bw = Math.min(12, step * 0.7);
	const bars = hours.flatMap((h, i) => {
		if (h.rain === undefined || h.rain < 5) return [];
		const bh = (Math.min(100, h.rain) / 100) * 30;
		const x = Math.max(0, Math.min(CHART.w - bw, pts[i]!.x - bw / 2));
		return [{ x: r1(x), y: r1(CHART.floor - bh), w: r1(bw), h: r1(bh) }];
	});

	const iLo = temps.indexOf(lo);
	const iHi = temps.indexOf(hi);
	const at = (x: number) => (x < 24 ? 'start' : x > CHART.w - 24 ? 'end' : 'middle');
	const marks: Hours['marks'] = [{ x: 6, y: pts[0]!.y - 8, text: deg(temps[0]!), anchor: 'start' }];
	const far = (i: number) => Math.abs(pts[i]!.x - pts[0]!.x) > 30;
	if (iLo !== 0 && far(iLo))
		marks.push({
			x: r1(pts[iLo]!.x),
			y: r1(pts[iLo]!.y + 16),
			text: deg(lo),
			anchor: at(pts[iLo]!.x)
		});
	if (iHi !== 0 && far(iHi) && hi !== lo)
		marks.push({
			x: r1(pts[iHi]!.x),
			y: r1(pts[iHi]!.y - 8),
			text: deg(hi),
			anchor: at(pts[iHi]!.x)
		});
	const rains = hours.map((h) => h.rain ?? 0);
	const wet = Math.max(...rains);
	const iWet = rains.indexOf(wet);
	if (wet >= RAIN_SHOWN)
		marks.push({
			x: r1(pts[iWet]!.x),
			y: r1(CHART.floor - (Math.min(100, wet) / 100) * 30 - 4),
			text: `${Math.round(wet)}%`,
			anchor: at(pts[iWet]!.x),
			rain: true
		});

	const ticks: Hours['ticks'] = [{ at: 0, text: 'Now', minor: false }];
	hours.forEach((h, i) => {
		const hour = new Date(h.at).getHours();
		const x = (i / (hours.length - 1)) * 100;
		// None so close to "Now" or the end that it runs into it on a narrow band.
		if (i === 0 || hour % 3 !== 0 || x < 14 || x > 96) return;
		ticks.push({ at: r1(x), text: hourWord(h.at), minor: hour % 6 !== 0 });
	});

	// The low and the high in the order they come.
	const turns = [
		{ i: iLo, text: `low ${deg(lo)} at ${hourWord(hours[iLo]!.at)}` },
		{ i: iHi, text: `high ${deg(hi)} at ${hourWord(hours[iHi]!.at)}` }
	].filter((t) => t.i !== 0 && (t.i === iLo || hi !== lo));
	const words = [`${deg(temps[0]!)} now`, ...turns.sort((a, b) => a.i - b.i).map((t) => t.text)];
	const rain =
		wet >= RAIN_SHOWN
			? `; rain chance up to ${Math.round(wet)}% around ${hourWord(hours[iWet]!.at)}`
			: '';
	return {
		path: smoothPath(pts),
		dot: { x: 0, y: r1(pts[0]!.y) },
		bars,
		marks,
		ticks,
		label: `Next 24 hours: ${words.join(', ')}${rain}.`
	};
}

// ---- the next days ----

export interface DayRow {
	/** "Today", "Sun". */
	label: string;
	icon?: IconName;
	condition?: string;
	low?: string;
	high?: string;
	/** "80%", when rain is likely enough to say. */
	rain?: string;
	/** Its low to its high on the rows' common scale, as insets from each end, percent. */
	bar?: { left: number; right: number };
	/** Now on that scale, percent: today's row only. */
	dot?: number;
}

/** The service's days from today on, up to a week. */
export function daysOf(service: CoreDevice | undefined, now: number): Day[] {
	if (!service) return [];
	const days = forecastOf(
		service.attributes.forecast,
		now,
		10,
		service.schema?.attributes.condition
	);
	const today = days.findIndex((d) => d.label === 'Today');
	return days.slice(Math.max(0, today), Math.max(0, today) + 7);
}

/**
 * The first `count` days as rows: each one's low and high drawn on one scale
 * that spans every row's (and now's), so a warmer day sits further right.
 */
export function dayRowsOf(days: Day[], count: number, now?: number): DayRow[] {
	const shown = days.slice(0, count);
	const all = [
		...shown.flatMap((d) => [d.low, d.high]),
		...(now === undefined ? [] : [now])
	].filter((n): n is number => n !== undefined);
	const lo = Math.min(...all);
	const hi = Math.max(...all);
	const span = hi - lo || 1;
	const pct = (n: number) => r1(Math.max(0, Math.min(100, ((n - lo) / span) * 100)));
	return shown.map((d) => ({
		label: d.label,
		icon: d.icon,
		condition: d.condition,
		low: d.low === undefined ? undefined : deg(d.low),
		high: d.high === undefined ? undefined : deg(d.high),
		rain: d.rain !== undefined && d.rain >= RAIN_SHOWN ? `${Math.round(d.rain)}%` : undefined,
		bar:
			d.low === undefined || d.high === undefined
				? undefined
				: { left: pct(d.low), right: r1(100 - pct(d.high)) },
		dot: d.label === 'Today' && now !== undefined ? pct(now) : undefined
	}));
}

// ---- the band ----

export interface Band {
	now?: Now;
	hours?: Hours;
	/** Every day there is, up to seven: the band shows three or all. */
	days: Day[];
	/** Whether there's a forecast to show beside now: else now alone, compact. */
	full: boolean;
}

/**
 * The band, from the house: undefined when no part of it has anything to
 * show (no service and no station; a service that hasn't fetched, and no
 * station). `night` is the clock's guess, for a service that doesn't say.
 */
export function bandOf(
	all: Devices,
	source: NowSource,
	now: number,
	night = false
): Band | undefined {
	const service = serviceOf(all);
	const n = nowOf(nowFrom(source, all, now), service, now, night);
	const hours = service ? hoursOf(service.attributes.forecast_hourly, now) : undefined;
	const days = daysOf(service, now);
	if (!n && !hours && days.length === 0) return undefined;
	return { now: n, hours, days, full: !!hours || days.length > 0 };
}

/**
 * The choices for where now comes from, as Settings and the band's "From"
 * menu offer them: automatic (saying what it is now), the service when there
 * is one, then each device that reads outside, and the one chosen if it no
 * longer looks like one.
 */
export function nowChoicesOf(
	all: Devices,
	rooms: Room[],
	chosen: NowSource,
	now?: number
): { value: NowSource; label: string }[] {
	const service = serviceOf(all);
	const auto = nowFrom('auto', all, now);
	const devices = nowCandidates(all, rooms);
	const kept = chosen.startsWith('device:') ? all[chosen.slice('device:'.length)] : undefined;
	if (kept && !devices.includes(kept)) devices.push(kept);
	return [
		{
			value: 'auto',
			label: auto
				? `Automatic (${auto === service ? 'the weather service' : displayName(auto)})`
				: 'Automatic'
		},
		...(service ? [{ value: 'service' as const, label: 'The weather service' }] : []),
		...devices.map((d) => ({ value: `device:${d.device_id}` as const, label: displayName(d) }))
	];
}
