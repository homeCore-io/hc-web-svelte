/**
 * A room's box (G-b, mockups A and B) and the big numbers across the top of
 * Home: what each shows, from the house and the settings that apply
 * (`options.ts`). Built from the card descriptions, as the room's one line is
 * (`summary.ts`), so a box never disagrees with the room's page.
 *
 * Whatever is switched off, a box always shows what's wrong in the room — a
 * leak, smoke, an open door, something offline (G6).
 */
import { kindOf, type CardView } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import { numbersOf, sourceOf, type NumberId, type Options, type Source } from './options.js';
import { allOffTargets } from './summary.js';
import { toShown } from './units.js';

// ---- readings ----

/** A device's reading of `attr` in the person's units, if it has one now. */
export function readingOf(d: CoreDevice, attr: string): number | undefined {
	const v = d.attributes[attr];
	if (!d.available || typeof v !== 'number' || !Number.isFinite(v)) return undefined;
	const unit = d.schema?.attributes[attr]?.unit ?? str(d.attributes[`${attr}_unit`]);
	return toShown(v, unit);
}

/** Whether a device reads `attr` at all — what the sensor picker offers. */
export const reads = (d: CoreDevice, attr: string): boolean =>
	typeof d.attributes[attr] === 'number';

const mean = (xs: number[]) =>
	xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;

/**
 * A reading from a source: the devices chosen (one, or their average), or —
 * `auto` — the average of `near`, the devices it would naturally be.
 */
export function sourced(
	source: Source,
	attr: string,
	all: Devices,
	near: CoreDevice[]
): number | undefined {
	if (source === 'none') return undefined;
	const from = source === 'auto' ? near : source.flatMap((id) => all[id] ?? []);
	return mean(from.flatMap((d) => readingOf(d, attr) ?? []));
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
}

const LIGHT = (c: CardView) => c.kind === 'light';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What's wrong in the room, in words — always shown (G6). Low batteries go with Batteries. */
function wrong(cards: CardView[]): { lines: Line[]; alarm: boolean } {
	const lines: Line[] = [];
	const wet = cards.filter((c) => c.alarm === 'wet');
	if (wet.length > 0)
		lines.push({ text: wet.length === 1 ? 'Leak' : `${wet.length} leaks`, alert: true });
	const smoke = cards.filter((c) => c.alarm === 'smoke');
	if (smoke.length > 0) lines.push({ text: 'Smoke', alert: true });
	const jammed = cards.filter((c) => c.alarm === 'jammed');
	for (const c of jammed) lines.push({ text: `${c.name} jammed`, alert: true });
	const open = cards.filter((c) => c.available && c.icon === 'door-open');
	if (open.length === 1) lines.push({ text: `${open[0]!.name} open`, alert: true });
	else if (open.length > 1) lines.push({ text: `${open.length} open`, alert: true });
	const off = cards.filter((c) => c.alarm === 'offline');
	if (off.length === 1) lines.push({ text: `${off[0]!.name} offline`, alert: true });
	else if (off.length > 1) lines.push({ text: `${off.length} offline`, alert: true });
	return { lines, alarm: wet.length + smoke.length + jammed.length > 0 };
}

/**
 * A room's box. `devices` are the room's, `cards` their descriptions, `all`
 * the house's (a chosen sensor may be elsewhere), `o` the settings that apply.
 */
export function roomBox(devices: CoreDevice[], cards: CardView[], all: Devices, o: Options): Box {
	const { lines, alarm } = wrong(cards);
	const lights = cards.filter((c) => c.available && LIGHT(c));
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

	const said = (text: string | undefined) =>
		text !== undefined && lines.push({ text, alert: false });
	if (o.lights && o.big !== 'lights' && lights.length > 0)
		said(
			on.length === 0
				? 'Lights off'
				: `${on.length} of ${lights.length} light${lights.length === 1 ? '' : 's'} on`
		);
	if (o.big !== 'temperature') said(temperature);
	if (o.big !== 'humidity') said(humidity);
	if (o.fans) {
		const fans = cards.filter((c) => c.available && c.kind === 'fan' && c.tone === 'on').length;
		if (fans > 0) said(plural(fans, 'fan on', 'fans on'));
	}
	if (o.doors) {
		const unlocked = cards.filter((c) => c.available && c.icon === 'unlock');
		if (unlocked.length === 1) said(`${unlocked[0]!.name} unlocked`);
		else if (unlocked.length > 1) said(`${unlocked.length} unlocked`);
	}
	const playing = cards.filter((c) => c.available && c.stateLine.startsWith('Playing'));
	if (o.music && playing.length > 0)
		said(playing.length === 1 ? `${playing[0]!.name} playing` : `${playing.length} playing`);
	if (o.timers) {
		const timers = cards.filter((c) => c.control?.kind === 'timer' && c.control.running).length;
		if (timers > 0) said(plural(timers, 'timer running', 'timers running'));
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
		for (const c of low) lines.push({ text: `${c.name} battery low`, alert: true });
		const levels = devices.flatMap(
			(d) => num(d.attributes.battery) ?? num(d.attributes.battery_pct) ?? []
		);
		if (low.length === 0 && levels.length > 0)
			said(`Lowest battery ${Math.round(Math.min(...levels))}%`);
		if (low.length > 0) badges.push({ icon: 'battery', label: 'Battery low' });
	}

	return {
		big,
		lines,
		badges,
		glow: o.lights && lights.length > 0 ? on.length / lights.length : 0,
		alarm,
		allOff: o.allOff ? allOffTargets(cards) : []
	};
}

/** A box's size in the room field: by how much is in the room. */
export const fieldSize = (devices: number): 1 | 2 | 3 => (devices <= 4 ? 1 : devices <= 9 ? 2 : 3);

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
	const station = Object.values(h.all).find(
		(d) => kindOf(d) === 'weather_station' && readingOf(d, 'temperature') !== undefined
	);
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
				unit: v === undefined ? undefined : '°',
				sub: chosen(inside) ?? `average of ${plural(temps.length, 'room', 'rooms')}`
			};
		},
		outside: () => {
			const v = of(outside, 'temperature', station ? readingOf(station, 'temperature') : undefined);
			const hum =
				outside === 'auto' && station ? percent(readingOf(station, 'humidity')) : undefined;
			return {
				value: v === undefined ? '—' : String(Math.round(v)),
				unit: v === undefined ? undefined : '°',
				sub: chosen(outside) ?? (station ? (hum ?? displayName(station)) : 'no weather station')
			};
		},
		lights: () => {
			const on = (c: CardView) => c.available && LIGHT(c) && c.tone === 'on';
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
			const p = (c: CardView) => c.available && c.icon === 'door-open';
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
function str(v: unknown): string | undefined {
	return typeof v === 'string' ? v : undefined;
}
