/**
 * A room's box (G-b, mockups A and B) and the big numbers across the top of
 * Home: what each shows, from the house and the settings that apply
 * (`options.ts`). Built from the card descriptions, as the room's one line is
 * (`summary.ts`), so a box never disagrees with the room's page.
 *
 * Whatever is switched off, a box always shows what's wrong in the room — a
 * leak, smoke, an open door, something offline (G6).
 */
import { isOpen, kindOf, type CardView, type IconName } from './card.js';
import { displayName, unitOf, type CoreDevice, type Devices } from './devices.js';
import { numbersOf, sourceOf, type NumberId, type Options, type Source } from './options.js';
import { allOffTargets } from './summary.js';
import { isCameraLight } from './cameraLights.js';
import { shownUnit, toShown, type Units } from './units.js';

/** Readings in homeCore's own units, to compare against a fixed °C. */
const CELSIUS: Units = { temperature: 'C', measures: 'metric' };

// ---- readings ----

/** A device's reading of `attr` in the person's units, if it has one now. */
export function readingOf(d: CoreDevice, attr: string): number | undefined {
	const v = d.attributes[attr];
	if (!d.available || typeof v !== 'number' || !Number.isFinite(v)) return undefined;
	return toShown(v, unitOf(d, attr));
}

/** Whether a device reads `attr` at all — what the sensor picker offers. */
export const reads = (d: CoreDevice, attr: string): boolean =>
	typeof d.attributes[attr] === 'number';

const mean = (xs: number[]) =>
	xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;

// ---- what reads a room's air ----

/** Kinds whose temperature is the air's: a thermometer, a weather station. */
const THERMOMETERS = new Set(['temperature_sensor', 'weather_station']);
/** Kinds whose temperature is the device's own, never the room's: a leak sensor's. */
const NOT_AIR = new Set(['water_sensor', 'leak_sensor']);
/** Plugins whose thermostats read a heated floor, not the air above it. */
const FLOOR_HEAT = new Set(['plugin.nuheat']);
/** Names that say a sensor sits in something cold. */
const COLD_STORE = /freez|fridge|refrigerat|cooler/i;

/**
 * Whether a sensor keeps a cold box: its name says so, or its own safe range
 * tops out below 10 °C (a freezer probe's -20 to -5).
 */
function inColdStore(d: CoreDevice): boolean {
	if (COLD_STORE.test(displayName(d)) || COLD_STORE.test(d.name)) return true;
	const high = d.attributes.temp_limit_high;
	if (typeof high !== 'number') return false;
	return toShown(high, unitOf(d, 'temperature') ?? '°C', CELSIUS) < 10;
}

/**
 * The devices whose temperature is the room's air, best first: its
 * thermometers and weather stations if it has any, else its thermostats'
 * own readings, else anything else that reads the air (a motion sensor's).
 * Never a leak sensor's, a freezer probe's or a heated floor's, so a room
 * with only those shows no temperature rather than theirs.
 */
export function airReaders(near: CoreDevice[]): CoreDevice[] {
	const air = near.filter((d) => {
		if (typeof d.attributes.temperature !== 'number') return false;
		const kind = kindOf(d);
		if (NOT_AIR.has(kind) || NOT_AIR.has(d.device_type ?? '')) return false;
		if (kind === 'thermostat' && FLOOR_HEAT.has(d.plugin_id ?? '')) return false;
		return !inColdStore(d);
	});
	const thermometers = air.filter((d) => THERMOMETERS.has(kindOf(d)));
	if (thermometers.length > 0) return thermometers;
	const thermostats = air.filter((d) => kindOf(d) === 'thermostat');
	return thermostats.length > 0 ? thermostats : air;
}

/**
 * A reading from a source: the devices chosen (one, or their average), or —
 * `auto` — the average of `near`, the devices it would naturally be. For a
 * temperature, `auto` takes only what reads the air (`airReaders`).
 */
export function sourced(
	source: Source,
	attr: string,
	all: Devices,
	near: CoreDevice[]
): number | undefined {
	if (source === 'none') return undefined;
	const from =
		source === 'auto'
			? attr === 'temperature'
				? airReaders(near)
				: near
			: source.flatMap((id) => all[id] ?? []);
	return mean(from.flatMap((d) => readingOf(d, attr) ?? []));
}

/** The house's own weather station, else a weather plugin's place: what reads outside. */
export function outdoorStation(all: Devices): CoreDevice | undefined {
	const outdoors = (kind: string) =>
		Object.values(all).find((d) => kindOf(d) === kind && readingOf(d, 'temperature') !== undefined);
	return outdoors('weather_station') ?? outdoors('weather');
}

/** The temperature outside, in the person's units: from `source`, or (`auto`) the station's. */
export function outsideTemperature(all: Devices, source: Source = 'auto'): number | undefined {
	if (source !== 'auto') return sourced(source, 'temperature', all, []);
	const station = outdoorStation(all);
	return station ? readingOf(station, 'temperature') : undefined;
}

/** "72°", "48%". */
export const degrees = (n: number | undefined) =>
	n === undefined ? undefined : `${Math.round(n)}°`;
export const percent = (n: number | undefined) =>
	n === undefined ? undefined : `${Math.round(n)}%`;

// ---- a room's box ----

export interface Line {
	text: string;
	/** Something wrong: drawn in the alert colour. */
	alert: boolean;
	/** What it's about, so the room field can tell its lines apart. */
	what?: Said;
}

type Said =
	| 'leak'
	| 'smoke'
	| 'jammed'
	| 'open'
	| 'offline'
	| 'lights'
	| 'temperature'
	| 'humidity'
	| 'fans'
	| 'unlocked'
	| 'playing'
	| 'timers'
	| 'battery';

/** A tinted mark beside a field box's name (mockup A): what's wrong, what to mind, who's about. */
export interface Mark {
	icon: IconName | 'alert';
	label: string;
	tone: 'alert' | 'warn' | 'calm';
}

export interface Badge {
	icon: 'motion' | 'speaker' | 'battery';
	label: string;
}

export interface Box {
	/** The big number, already in words: "72°", "48%", "2/5". */
	big?: string;
	/** What's wrong first, then the details asked for. */
	lines: Line[];
	badges: Badge[];
	/** How much of the room's light is on, 0–1, when lights are shown. */
	glow: number;
	/** A leak, smoke or a jammed lock: the whole box says so. */
	alarm: boolean;
	/** What "All off" would turn off — empty when the box doesn't offer it. */
	allOff: CardView[];
	/** The same, apart, for the room field: which reading is big, and the rest. */
	bigIs?: 'temperature' | 'humidity' | 'lights';
	temperature?: string;
	humidity?: string;
	/** Lights on, of how many, when lights are shown. */
	lights?: { on: number; of: number };
	/** The field's marks, what's wrong first. */
	marks: Mark[];
}

const LIGHT = (c: CardView) => c.kind === 'light';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What's wrong in the room, in words — always shown (G6). Low batteries go with Batteries. */
function wrong(cards: CardView[]): { lines: Line[]; alarm: boolean } {
	const lines: Line[] = [];
	const wet = cards.filter((c) => c.alarm === 'wet');
	if (wet.length > 0)
		lines.push({
			text: wet.length === 1 ? 'Leak' : `${wet.length} leaks`,
			alert: true,
			what: 'leak'
		});
	const smoke = cards.filter((c) => c.alarm === 'smoke');
	if (smoke.length > 0) lines.push({ text: 'Smoke', alert: true, what: 'smoke' });
	const jammed = cards.filter((c) => c.alarm === 'jammed');
	for (const c of jammed) lines.push({ text: `${c.name} jammed`, alert: true, what: 'jammed' });
	const open = cards.filter((c) => c.available && isOpen(c));
	if (open.length === 1) lines.push({ text: `${open[0]!.name} open`, alert: true, what: 'open' });
	else if (open.length > 1) lines.push({ text: `${open.length} open`, alert: true, what: 'open' });
	const off = cards.filter((c) => c.alarm === 'offline');
	if (off.length === 1)
		lines.push({ text: `${off[0]!.name} offline`, alert: true, what: 'offline' });
	else if (off.length > 1)
		lines.push({ text: `${off.length} offline`, alert: true, what: 'offline' });
	return { lines, alarm: wet.length + smoke.length + jammed.length > 0 };
}

/**
 * A room's box. `devices` are the room's, `cards` their descriptions, `all`
 * the house's (a chosen sensor may be elsewhere), `o` the settings that apply.
 */
export function roomBox(devices: CoreDevice[], cards: CardView[], all: Devices, o: Options): Box {
	const { lines, alarm } = wrong(cards);
	// A camera's spotlight is its camera's, not one of the room's lights.
	const lights = cards.filter(
		(c) => c.available && LIGHT(c) && !isCameraLight({ device_id: c.id }, all)
	);
	const on = lights.filter((c) => c.tone === 'on');
	const temperature = degrees(sourced(sourceOf(o.temperature), 'temperature', all, devices));
	const humidity = percent(sourced(sourceOf(o.humidity), 'humidity', all, devices));
	const big =
		o.big === 'temperature'
			? temperature
			: o.big === 'humidity'
				? humidity
				: o.big === 'lights' && lights.length > 0
					? `${on.length}/${lights.length}`
					: undefined;

	const said = (text: string | undefined, what: Said) =>
		text !== undefined && lines.push({ text, alert: false, what });
	if (o.lights && o.big !== 'lights' && lights.length > 0)
		said(
			on.length === 0
				? 'Lights off'
				: `${on.length} of ${lights.length} light${lights.length === 1 ? '' : 's'} on`,
			'lights'
		);
	if (o.big !== 'temperature') said(temperature, 'temperature');
	if (o.big !== 'humidity') said(humidity, 'humidity');
	if (o.fans) {
		const fans = cards.filter((c) => c.available && c.kind === 'fan' && c.tone === 'on').length;
		if (fans > 0) said(plural(fans, 'fan on', 'fans on'), 'fans');
	}
	if (o.doors) {
		const unlocked = cards.filter((c) => c.available && c.icon === 'unlock');
		if (unlocked.length === 1) said(`${unlocked[0]!.name} unlocked`, 'unlocked');
		else if (unlocked.length > 1) said(`${unlocked.length} unlocked`, 'unlocked');
	}
	const playing = cards.filter((c) => c.available && c.stateLine.startsWith('Playing'));
	if (o.music && playing.length > 0)
		said(
			playing.length === 1 ? `${playing[0]!.name} playing` : `${playing.length} playing`,
			'playing'
		);
	if (o.timers) {
		const timers = cards.filter((c) => c.control?.kind === 'timer' && c.control.running).length;
		if (timers > 0) said(plural(timers, 'timer running', 'timers running'), 'timers');
	}
	const badges: Badge[] = [];
	if (o.people) {
		const here = cards.some(
			(c) =>
				c.available &&
				(c.kind === 'motion_sensor' || c.kind === 'occupancy_sensor') &&
				c.tone === 'on'
		);
		if (here) badges.push({ icon: 'motion', label: 'Someone here' });
	}
	if (o.music && playing.length > 0) badges.push({ icon: 'speaker', label: 'Playing' });
	if (o.battery) {
		const low = cards.filter((c) => c.alarm === 'low battery');
		for (const c of low)
			lines.push({ text: `${c.name} battery low`, alert: true, what: 'battery' });
		const levels = devices.flatMap(
			(d) => num(d.attributes.battery) ?? num(d.attributes.battery_pct) ?? []
		);
		if (low.length === 0 && levels.length > 0)
			said(`Lowest battery ${Math.round(Math.min(...levels))}%`, 'battery');
		if (low.length > 0) badges.push({ icon: 'battery', label: 'Battery low' });
	}

	// The field's marks (mockup A): what's wrong always (G6), the rest as asked.
	const marks: Mark[] = [];
	const some = (f: (c: CardView) => boolean) => cards.filter((c) => c.available && f(c));
	const mark = (n: number, icon: Mark['icon'], label: string, tone: Mark['tone']) =>
		n > 0 && marks.push({ icon, label, tone });
	mark(cards.filter((c) => c.alarm === 'wet').length, 'water', 'Leak', 'alert');
	const open = some((c) => isOpen(c));
	mark(open.length, 'door-open', open.length === 1 ? `${open[0]!.name} open` : 'Open', 'alert');
	if (o.battery)
		mark(cards.filter((c) => c.alarm === 'low battery').length, 'alert', 'Battery low', 'alert');
	if (o.doors) mark(some((c) => c.icon === 'unlock').length, 'unlock', 'Unlocked', 'warn');
	if (badges.some((b) => b.icon === 'motion')) mark(1, 'motion', 'Someone here', 'calm');
	if (o.music) mark(playing.length, 'speaker', 'Playing', 'calm');
	if (o.fans)
		mark(some((c) => c.kind === 'fan' && c.tone === 'on').length, 'fan', 'Fan on', 'calm');
	if (o.timers)
		mark(
			cards.filter((c) => c.control?.kind === 'timer' && c.control.running).length,
			'timer',
			'Timer running',
			'calm'
		);

	return {
		big,
		lines,
		badges,
		glow: o.lights && lights.length > 0 ? on.length / lights.length : 0,
		alarm,
		allOff: o.allOff ? allOffTargets(cards) : [],
		bigIs:
			o.big === 'temperature' || o.big === 'humidity' || o.big === 'lights' ? o.big : undefined,
		temperature,
		humidity,
		lights: o.lights && lights.length > 0 ? { on: on.length, of: lights.length } : undefined,
		marks
	};
}

// ---- the room field (G-b, mockup A) ----

/** What a field box says, apart from its name and marks. */
export interface FieldText {
	/** A big box's line: lights, then humidity — "4 of 7 lights on · 50%". */
	line: string;
	/** A small box's: its big number, then lights — "71° · Lights off". */
	short: string;
	/** A phone's, where boxes are narrower: "4/7 on", "off". */
	brief: string;
	/** Lights on: the line in the lit colour. */
	lit: boolean;
	/** Under a big box's line: what's wrong first (G6), else what the line and marks don't say. */
	note?: Line;
	/** What's wrong, which a small box says in place of its line (G6). */
	wrong?: Line;
}

/** Said by a field box's line or marks already, so never its note. */
const SAID = new Set<Said | undefined>([
	'lights',
	'temperature',
	'humidity',
	'fans',
	'unlocked',
	'playing',
	'timers',
	'open'
]);

export function fieldText(b: Box): FieldText {
	const l = b.lights;
	const lightsLine =
		l && b.bigIs !== 'lights'
			? l.on === 0
				? 'Lights off'
				: `${l.on} of ${l.of} light${l.of === 1 ? '' : 's'} on`
			: undefined;
	const lightsShort = l ? (l.on === 0 ? 'Lights off' : `${l.on}/${l.of} on`) : undefined;
	const join = (xs: (string | undefined)[]) => xs.filter((x) => x !== undefined).join(' · ');
	return {
		line: join([lightsLine, b.bigIs === 'humidity' ? undefined : b.humidity]),
		short: join([b.bigIs === 'lights' ? undefined : b.big, lightsShort]) || 'All quiet',
		brief: l ? (l.on === 0 ? 'off' : `${l.on}/${l.of} on`) : '',
		lit: (l?.on ?? 0) > 0,
		note: b.lines.find((x) => !SAID.has(x.what)),
		wrong: b.lines.find((x) => x.alert && x.what !== 'open')
	};
}

/** How much is going on in a room: lights on, marks, what's wrong. */
export function busyness(b: Box): number {
	return (
		(b.lights?.on ?? 0) * 3 +
		b.marks.length * 2 +
		b.lines.filter((x) => x.alert).length * 3 +
		(fieldText(b).note ? 1 : 0)
	);
}

/** Where a box goes in the field: its columns and rows wide, and on a phone. */
export interface Plot {
	ref: string;
	/** A big box: its number, a line, a note, All off. */
	big: boolean;
	cols: number;
	rows: number;
	phoneCols: number;
	phoneRows: number;
}

/**
 * The room field (mockup A): a 12-column grid, the busiest rooms first and
 * biggest — the three busiest three rows tall (5, 4 and 3 columns, so they
 * fill a row), the next two two rows tall, every other room two by two. On a
 * phone's four columns: two by two, two by one, one by one. A room with
 * nothing going on is never big. Rooms past the busiest keep their order.
 */
export function fieldPlan(rooms: { ref: string; box?: Box }[]): Plot[] {
	const scored = rooms.map((r, i) => ({ ref: r.ref, i, s: r.box ? busyness(r.box) : 0 }));
	const ranked = scored.filter((r) => r.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
	const first = ranked.slice(0, 3);
	const second = ranked.slice(3, 5).sort((a, b) => a.i - b.i);
	const WIDE: Record<number, number[]> = { 1: [6], 2: [6, 6], 3: [5, 4, 3] };
	const NEXT: Record<number, number[]> = { 1: [4], 2: [3, 3] };
	const big = new Set([...first, ...second].map((r) => r.ref));
	return [
		...first.map((r, i) => ({
			ref: r.ref,
			big: true,
			cols: WIDE[first.length]![i]!,
			rows: 3,
			phoneCols: 2,
			phoneRows: 2
		})),
		...second.map((r, i) => ({
			ref: r.ref,
			big: true,
			cols: NEXT[second.length]![i]!,
			rows: 2,
			phoneCols: 2,
			phoneRows: 1
		})),
		...scored
			.filter((r) => !big.has(r.ref))
			.map((r) => ({ ref: r.ref, big: false, cols: 2, rows: 2, phoneCols: 1, phoneRows: 1 }))
	];
}

// ---- the big numbers ----

export interface BigNumber {
	id: NumberId;
	label: string;
	value: string;
	unit?: string;
	sub: string;
	/** Lights: drawn in the lit colour while any are on. */
	lit?: boolean;
}

const LABELS: Record<NumberId, string> = {
	inside: 'Inside',
	outside: 'Outside',
	lights: 'Lights on',
	playing: 'Playing',
	open: 'Open',
	people: 'Someone here',
	humidity: 'Humidity'
};

/** Names, two at most: "Bathroom, Living Room", "Bathroom, Living Room +2". */
const names = (xs: string[]) =>
	xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} +${xs.length - 2}`;

export interface HouseIn {
	all: Devices;
	/** Each room's name and devices, rooms only (not "Not in a room"). */
	rooms: { name: string; devices: CoreDevice[]; cards: CardView[] }[];
	cards: CardView[];
}

/** The big numbers, in the order chosen. A number with nothing to say reads "—". */
export function bigNumbers(h: HouseIn, o: Options): BigNumber[] {
	const temps = h.rooms.flatMap((r) => sourced('auto', 'temperature', h.all, r.devices) ?? []);
	const humids = h.rooms.flatMap((r) => sourced('auto', 'humidity', h.all, r.devices) ?? []);
	// Outside: the house's own station, measured; else a weather plugin's place.
	const station = outdoorStation(h.all);
	const inside = sourceOf(o.inside);
	const outside = sourceOf(o.outside);
	const humid = sourceOf(o.humid);
	const of = (s: Source, attr: string, auto: number | undefined) =>
		s === 'auto' ? auto : sourced(s, attr, h.all, []);
	const chosen = (s: Source) =>
		Array.isArray(s)
			? s.length === 1
				? h.all[s[0]!]
					? displayName(h.all[s[0]!]!)
					: 'A sensor that’s gone'
				: `average of ${s.length} sensors`
			: undefined;
	const roomsWith = (f: (r: HouseIn['rooms'][number]) => boolean) =>
		h.rooms.filter(f).map((r) => r.name);

	const make: Record<NumberId, () => Omit<BigNumber, 'id' | 'label'>> = {
		inside: () => {
			const v = of(inside, 'temperature', mean(temps));
			return {
				value: v === undefined ? '—' : String(Math.round(v)),
				unit: v === undefined ? undefined : shownUnit('°C'),
				sub: chosen(inside) ?? `average of ${plural(temps.length, 'room', 'rooms')}`
			};
		},
		outside: () => {
			const v = outsideTemperature(h.all, outside);
			const hum =
				outside === 'auto' && station ? percent(readingOf(station, 'humidity')) : undefined;
			return {
				value: v === undefined ? '—' : String(Math.round(v)),
				unit: v === undefined ? undefined : shownUnit('°C'),
				sub: chosen(outside) ?? (station ? (hum ?? displayName(station)) : 'no weather station')
			};
		},
		lights: () => {
			const on = (c: CardView) =>
				c.available && LIGHT(c) && c.tone === 'on' && !isCameraLight({ device_id: c.id }, h.all);
			const n = h.cards.filter(on).length;
			const rooms = roomsWith((r) => r.cards.some(on)).length;
			return {
				value: String(n),
				sub: n === 0 ? 'all off' : `in ${plural(rooms, 'room', 'rooms')}`,
				lit: n > 0
			};
		},
		playing: () => {
			const p = (c: CardView) => c.available && c.stateLine.startsWith('Playing');
			const where = roomsWith((r) => r.cards.some(p));
			return {
				value: String(h.cards.filter(p).length),
				sub: where.length > 0 ? names(where) : 'nothing playing'
			};
		},
		open: () => {
			const p = (c: CardView) => c.available && isOpen(c);
			const where = roomsWith((r) => r.cards.some(p));
			return {
				value: String(h.cards.filter(p).length),
				sub: where.length > 0 ? names(where) : 'all shut'
			};
		},
		people: () => {
			const where = roomsWith((r) =>
				r.cards.some(
					(c) =>
						c.available &&
						(c.kind === 'motion_sensor' || c.kind === 'occupancy_sensor') &&
						c.tone === 'on'
				)
			);
			return { value: String(where.length), sub: where.length > 0 ? names(where) : 'nobody about' };
		},
		humidity: () => {
			const v = of(humid, 'humidity', mean(humids));
			return {
				value: v === undefined ? '—' : String(Math.round(v)),
				unit: v === undefined ? undefined : '%',
				sub: chosen(humid) ?? `average of ${plural(humids.length, 'room', 'rooms')}`
			};
		}
	};
	return numbersOf(o.numbers).map((id) => ({ id, label: LABELS[id], ...make[id]() }));
}

function num(v: unknown): number | undefined {
	return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
