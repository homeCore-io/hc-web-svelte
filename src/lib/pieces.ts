/**
 * What the app's own cards show (G-c, G21): what's worth knowing, what's
 * playing, a weather device's readings and forecast. Plain data from the
 * house's devices, so each can be tested without drawing anything.
 */
import { reading, type CardView } from './card.js';
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

/** What's unusual now, by name, in the order chosen to show: leaks, open, unlocked, playing. */
export function worthKnowing(cards: CardView[], all: Devices, rooms: Room[], o: Options): Item[] {
	const pick = (on: unknown, f: (c: CardView) => boolean, alert = false) =>
		on === false ? [] : cards.filter(f).map((c) => item(c, all, rooms, alert));
	return [
		...pick(o.leaks, (c) => c.alarm === 'wet', true),
		...pick(o.open, (c) => c.available && c.icon === 'door-open'),
		...pick(o.unlocked, (c) => c.available && c.icon === 'unlock'),
		...pick(o.playing, isPlaying)
	];
}

/** Every speaker or TV playing now, with its room. */
export const playingNow = (cards: CardView[], all: Devices, rooms: Room[]): Item[] =>
	cards.filter(isPlaying).map((c) => item(c, all, rooms));

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
const words = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

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

/** What a weather card shows of a device: its temperature, its other main readings, a forecast if it has one. */
export function weatherOf(d: CoreDevice, now: number): Weather {
	const s = d.schema ?? { attributes: {} };
	const others = [
		...(s.primary ?? []),
		...Object.keys(s.attributes).filter((a) => !(s.primary ?? []).includes(a))
	].filter(
		(a) =>
			a !== 'temperature' &&
			a !== 'forecast' &&
			num(d.attributes[a]) !== undefined &&
			s.attributes[a]?.category === undefined
	);
	return {
		name: displayName(d),
		temperature: readingOf(d, 'temperature'),
		readings: others.slice(0, 3).flatMap((a) => {
			const text = reading(d.attributes, s, a);
			return text ? [{ label: s.attributes[a]?.display_name ?? words(a), text }] : [];
		}),
		forecast: forecastOf(d.attributes.forecast, now),
		available: d.available
	};
}
