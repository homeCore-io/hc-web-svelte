/**
 * What the app's own cards show (G-c, G21): what's worth knowing, what's
 * playing, a weather device's readings and forecast. Plain data from the
 * house's devices, so each can be tested without drawing anything.
 */
import { reading, type CardView, type IconName } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import type { Room } from './house.js';
import { kindOf } from './card.js';
import { sourceOf, type Options } from './options.js';
import { readingOf } from './roomBox.js';
import { roomOf } from './summary.js';
import { toShown } from './units.js';

export interface Item {
	id: string;
	name: string;
	/** What it's doing, in the card's own words: "Open", "Playing · Song". */
	what: string;
	room: string;
	alert: boolean;
}

const roomName = (d: CoreDevice | undefined, rooms: Room[]) => (d && roomOf(d, rooms)?.name) ?? '';

const item = (c: CardView, all: Devices, rooms: Room[], alert = false): Item => ({
	id: c.id,
	name: c.name,
	what: c.stateLine,
	room: roomName(all[c.id], rooms),
	alert
});

export const isPlaying = (c: CardView) => c.available && c.stateLine.startsWith('Playing');

/** 10 minutes, 3 hours, 10 days — said in full, for a sentence. */
export function longFor(ms: number): string {
	const min = Math.max(1, Math.floor(ms / 60_000));
	const say = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
	if (min < 60) return say(min, 'minute');
	const h = Math.floor(min / 60);
	if (h < 48) return say(h, 'hour');
	return say(Math.floor(h / 24), 'day');
}

/** "Open for 10 days": how long a door has been open, from when its reading last changed. */
function openFor(d: CoreDevice | undefined, now: number): string {
	const at = ['open', 'contact_open', 'contact']
		.map((a) => d?.attributes_changed_at?.[a])
		.find((t) => t !== undefined);
	const ms = at === undefined ? NaN : now - Date.parse(at);
	return Number.isFinite(ms) && ms >= 60_000 ? `Open for ${longFor(ms)}` : 'Open';
}

/**
 * What's unusual now, by name, in the order chosen to show: leaks, open,
 * unlocked. What's playing is the Playing card's, not this one's.
 */
export function worthKnowing(
	cards: CardView[],
	all: Devices,
	rooms: Room[],
	o: Options,
	now: number = Date.now()
): Item[] {
	const pick = (
		on: unknown,
		f: (c: CardView) => boolean,
		what: (c: CardView) => string,
		alert = false
	) =>
		on === false
			? []
			: cards.filter(f).map((c) => ({ ...item(c, all, rooms, alert), what: what(c) }));
	return [
		...pick(
			o.leaks,
			(c) => c.alarm === 'wet',
			() => 'Leak',
			true
		),
		...pick(
			o.open,
			(c) => c.available && c.icon === 'door-open',
			(c) => openFor(all[c.id], now)
		),
		...pick(
			o.unlocked,
			(c) => c.available && c.icon === 'unlock',
			() => 'Unlocked'
		)
	];
}

export interface Playing {
	id: string;
	/** What's playing ("ALT Radio", "YouTube"), else the player's own name. */
	title: string;
	/** Its room, and the player's name too when the title isn't it. */
	where: string;
	/** Pause, where the player has a play control. */
	pause?: string;
	icon: IconName;
	art?: string;
	artLogo?: boolean;
}

/** Every speaker or TV playing now: what it's playing, where (mockup A). */
export const playingNow = (cards: CardView[], all: Devices, rooms: Room[]): Playing[] =>
	cards.filter(isPlaying).map((c) => {
		const room = roomName(all[c.id], rooms);
		const title = c.nowPlaying ?? c.name;
		const named = title === c.name || room === c.name;
		return {
			id: c.id,
			icon: c.icon,
			title,
			where: named
				? room && room !== title
					? room
					: 'Playing'
				: [room, c.name].filter(Boolean).join(' · '),
			...(c.control?.kind === 'play' ? { pause: c.control.action } : {}),
			...(c.art ? { art: c.art, artLogo: c.artLogo } : {})
		};
	});

// ---- weather (G21) ----

/** The weather device a card reads: the one chosen, or the house's weather station. */
export function stationOf(all: Devices, chosen: unknown): CoreDevice | undefined {
	const s = sourceOf(chosen);
	if (Array.isArray(s)) return all[s[0]!];
	if (s === 'none') return undefined;
	return Object.values(all).find(
		(d) => kindOf(d) === 'weather_station' && readingOf(d, 'temperature') !== undefined
	);
}

export interface Day {
	/** "Today", "Sat". */
	label: string;
	high?: number;
	low?: number;
	condition?: string;
	/** Chance of rain, 0–100. */
	rain?: number;
}

export interface Weather {
	name: string;
	/** In the person's units, rounded by whoever draws it. */
	temperature?: number;
	/** "94%", "1.1 mph" — the device's other main readings, in words. */
	readings: { label: string; text: string }[];
	forecast: Day[];
	available: boolean;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * A device's `forecast` (G21): `{ time, high?, low?, condition?,
 * precipitation_probability? }` per day, temperatures in °C as homeCore
 * keeps them. Anything else in it is ignored; a day without a time is skipped.
 */
export function forecastOf(v: unknown, now: number, max = 5): Day[] {
	if (!Array.isArray(v)) return [];
	const today = new Date(now).toDateString();
	return v
		.flatMap((x): Day[] => {
			if (typeof x !== 'object' || x === null) return [];
			const f = x as Record<string, unknown>;
			const t = typeof f.time === 'string' ? Date.parse(f.time) : NaN;
			if (!Number.isFinite(t)) return [];
			const at = new Date(t);
			const c = (k: string) => {
				const n = num(f[k]);
				return n === undefined ? undefined : toShown(n, '°C');
			};
			return [
				{
					label:
						at.toDateString() === today
							? 'Today'
							: at.toLocaleDateString(undefined, { weekday: 'short' }),
					high: c('high'),
					low: c('low'),
					condition: typeof f.condition === 'string' ? f.condition : undefined,
					rain: num(f.precipitation_probability)
				}
			];
		})
		.slice(0, max);
}

/**
 * The readings a weather card names, in the order it shows them, each under
 * the names weather plugins give it and the unit it's in when the schema
 * doesn't say: homeCore's (hPa, m/s, mm), except the older Ecowitt's
 * `barometric_rel`, which was inches of mercury. Absolute pressure is left
 * out — relative is the one a forecast is read from.
 */
const WEATHER: { label: string; names: [string, string][] }[] = [
	{ label: 'Humidity', names: [['humidity', '%']] },
	{ label: 'Feels like', names: [['feels_like', '°C']] },
	{ label: 'Wind', names: [['wind_speed', 'm/s']] },
	{ label: 'Gusts', names: [['wind_gust', 'm/s']] },
	{
		label: 'Rain today',
		names: [
			['rain_daily_mm', 'mm'],
			['rain_day_mm', 'mm'],
			['rain_day_piezo', 'mm']
		]
	},
	{
		label: 'UV',
		names: [
			['uvi', ''],
			['uv', '']
		]
	},
	{
		label: 'Pressure',
		names: [
			['pressure', 'hPa'],
			['barometric_rel', 'inHg']
		]
	}
];

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** 213° → "SW". */
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

/** What a weather card shows of a device: its temperature, its main readings by name, a forecast if it has one. */
export function weatherOf(d: CoreDevice, now: number, max = 4): Weather {
	const s = d.schema ?? { attributes: {} };
	const readings = WEATHER.flatMap(({ label, names }) => {
		const found = names.find(([n]) => num(d.attributes[n]) !== undefined);
		if (!found) return [];
		const [name, usual] = found;
		const spec = s.attributes[name];
		const schema = {
			...s,
			attributes: { ...s.attributes, [name]: { ...spec, unit: spec?.unit ?? (usual || undefined) } }
		} as typeof s;
		let text = reading(d.attributes, schema, name);
		if (!text) return [];
		if (label === 'UV') text = String(Math.round(num(d.attributes[name])!));
		const dir = num(d.attributes.wind_direction);
		if (label === 'Wind' && dir !== undefined) text = `${text} ${compass(dir)}`;
		return [{ label, text }];
	});
	return {
		name: displayName(d),
		temperature: readingOf(d, 'temperature'),
		readings: readings.slice(0, max),
		forecast: forecastOf(d.attributes.forecast, now),
		available: d.available
	};
}
