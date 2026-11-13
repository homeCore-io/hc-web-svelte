/**
 * A room in the Lit look (docs/design/12-lit-look.md): what it holds, sorted
 * by what Lit draws for each, and the light the room is in.
 *
 * The page's own arrangement still applies (what is hidden, what a card is
 * called); Lit only decides where each kind of thing goes on the page.
 */
import { unitOf, type CoreDevice, type Devices } from '../devices.js';
import { toShown } from '../units.js';
import { cameraLightCards, cameraLightIds } from '../cameraLights.js';
import { INFRASTRUCTURE, isOpen, kindOf, type CardView } from '../card.js';
import type { Card } from '../page.js';

/** A light or a switch, as Lit draws it. */
export interface Lamp {
	card: Card & { kind: 'device' };
	view: CardView;
	name: string;
	on: boolean;
	/** Its brightness, 0–100, when it dims; else null. */
	level: number | null;
	/** The colour it gives off, `r,g,b`. */
	rgb: string;
	/** The attribute that switches it (`on`, usually). */
	attr: string;
}

/** Lights or switches that belong together: "Holiday Lights 1" to "4". */
export interface LampGroup {
	name: string;
	members: Lamp[];
}

export interface Problem {
	key: string;
	title: string;
	detail: string;
	/** A one-tap fix, when there is one. */
	fix?: { label: string; device: string; want: Record<string, unknown> };
}

export type SceneShape = 'light' | 'house' | 'keypad';
/** What else a house scene changes, besides lights. */
export type SceneBadge = 'lock' | 'heat' | 'media' | 'other';

export interface SceneDisc {
	card: Card;
	name: string;
	shape: SceneShape;
	/** Its colours, for a light scene. */
	colours: string[];
	/** What it does, in a few words. */
	does: string;
	/** For a house scene: the other kinds of thing it changes, in the order they matter. */
	badges: SceneBadge[];
	/** For a house scene that turns every light it sets off: the room goes dark. */
	dark: boolean;
	/** Its lighting system says it is the scene on now. */
	active?: boolean;
}

/** A reading worth a line of its last day: temperature or humidity. */
export interface Reading {
	card: Card & { kind: 'device' };
	view: CardView;
	name: string;
	/** The attribute drawn over time. */
	attr: 'temperature' | 'humidity';
	/** The device's own safe range, when it keeps one (a freezer probe), in its own unit. */
	range?: { low: number; high: number };
}

/** A sensor that only needs a glance: a dot and a word. */
export interface Watch {
	card: Card & { kind: 'device' };
	name: string;
	state: string;
	tone: 'ok' | 'on' | 'bad' | 'quiet';
}

/** A homeCore scene's states, by its id, for reading what it does. */
export type SceneStates = Record<string, Record<string, unknown> | undefined>;

export interface LitRoom {
	/** Lights that dim, one card each, and groups of lights or switches. */
	lights: (Lamp | LampGroup)[];
	/** The switch panel: lights first, then what powers or pipes something. */
	switches: { lights: Lamp[]; power: Lamp[] };
	/** Locks, garage doors and gates, and door and window sensors. */
	doors: Card[];
	scenes: SceneDisc[];
	/** Everything else, drawn as it is today: thermostats, players, readings, plugins' cards. */
	rest: Card[];
	/** Temperature and humidity sensors, each with its last day. */
	readings: Reading[];
	/** Other sensors, one line each. */
	watch: Watch[];
	/** Remotes, keypads, hubs: folded away under "More in this room". */
	more: Card[];
	problems: Problem[];
	/** Each light that is on, for the glow: where it sits (0–100), its colour, how bright. */
	glow: { at: number; rgb: string; level: number }[];
}

export const isGroup = (x: Lamp | LampGroup): x is LampGroup => 'members' in x;

const WARM = '255,180,90';
/** Things a switch powers rather than lights. */
const POWER = /\b(heat|heater|plug|outlet|valve|pump|charger|fan|ac|air|socket|power)\b/i;
/** A hub's own numbering ("Zone 03", "Device 001"): unnamed, not a set. */
const UNNAMED = /^(zone|device|load|output|channel|circuit|switch|light|relay)$/i;
/** What Lit draws as a light or a switch. */
const LAMPS = new Set(['light', 'dimmer', 'group', 'switch', 'outlet']);
/** Scenes from lighting systems (`hue_scene`): light scenes, colours or not. */
const LIGHT_SCENE = /hue|light|lifx|wiz|nanoleaf|govee/i;
/** Sensors drawn with their last day. */
const READING_KINDS = new Set(['temperature_sensor', 'humidity_sensor', 'sensor']);
/** Sensors that need only a glance. */
const WATCH_KINDS = new Set([
	'water_sensor',
	'motion_sensor',
	'occupancy_sensor',
	'vibration_sensor',
	'smoke_sensor',
	'binary_sensor',
	'rain_sensor',
	'lightning_sensor'
]);
const MEDIA_KINDS = new Set(['media_player', 'tv', 'speaker']);
const DOORS = new Set(['lock', 'garage', 'gate', 'garage_door', 'cover']);

/** CIE xy at full brightness, as sRGB. */
export function xyToRgb(x: number, y: number): string {
	if (y <= 0) return WARM;
	const Y = 1;
	const X = (Y / y) * x;
	const Z = (Y / y) * (1 - x - y);
	let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
	let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
	let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;
	const gamma = (c: number) =>
		c <= 0.0031308 ? 12.92 * c : (1 + 0.055) * Math.pow(c, 1 / 2.4) - 0.055;
	[r, g, b] = [gamma(r), gamma(g), gamma(b)];
	const top = Math.max(r, g, b, 1e-6);
	const to = (c: number) => Math.round(Math.max(0, Math.min(1, c / top)) * 255);
	return `${to(r)},${to(g)},${to(b)}`;
}

/** A colour temperature in kelvin, as sRGB (Tanner Helland's fit). */
export function kelvinToRgb(k: number): string {
	const t = Math.max(1000, Math.min(40000, k)) / 100;
	const clamp = (c: number) => Math.round(Math.max(0, Math.min(255, c)));
	const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
	const g =
		t <= 66
			? 99.4708025861 * Math.log(t) - 161.1195681661
			: 288.1221695283 * Math.pow(t - 60, -0.0755148492);
	const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
	return `${clamp(r)},${clamp(g)},${clamp(b)}`;
}

/** The colour a light gives off, from what it reports; warm white when it doesn't say. */
export function colourOf(d: CoreDevice): string {
	const a = d.attributes ?? {};
	const xy = a.color_xy as { x?: number; y?: number } | undefined;
	if (a.color_mode === 'xy' && xy && typeof xy.x === 'number' && typeof xy.y === 'number')
		return xyToRgb(xy.x, xy.y);
	if (typeof a.color_temp === 'number' && a.color_temp > 0) return kelvinToRgb(a.color_temp);
	return WARM;
}

/** "Holiday Lights 3" → "Holiday Lights"; a name without a number has no stem. */
export const stemOf = (name: string): string | null => {
	const m = /^(.*?\S)\s*\d+$/.exec(name.trim());
	return m ? m[1]!.trim() : null;
};

const named = (c: Card, names: Record<string, string>) => names[c.ref];

/**
 * Sort a room's cards for Lit. `views` describes each device card (by ref);
 * `names` holds the names this page gave cards; `hidden` cards are left out.
 */
export function litRoom(
	cards: Card[],
	views: Record<string, CardView>,
	names: Record<string, string> = {},
	sceneStates: SceneStates = {},
	devices: Devices = {}
): LitRoom {
	const readings: Reading[] = [];
	const watch: Watch[] = [];
	const lamps: Lamp[] = [];
	const doors: Card[] = [];
	const scenes: SceneDisc[] = [];
	const rest: Card[] = [];
	const more: Card[] = [];
	const problems: Problem[] = [];
	// A camera's spotlight is its camera's, not one of the room's lights.
	const spotlights = new Set([
		...cameraLightIds(devices),
		...cameraLightCards(Object.values(views))
	]);

	for (const card of cards) {
		if (card.kind === 'scene') {
			scenes.push({
				card,
				name: named(card, names) ?? card.name,
				...houseScene(sceneStates[card.id] ?? {}, devices)
			});
			continue;
		}
		if (card.kind !== 'device') {
			rest.push(card);
			continue;
		}
		const view = views[card.ref];
		if (!view) continue;
		const name = named(card, names) ?? view.name;
		const d = card.device;

		if (view.alarm === 'offline')
			problems.push({
				key: `${card.ref}/offline`,
				title: `${name} isn't answering`,
				detail: view.stateLine
			});
		else if (view.alarm === 'wet' || view.alarm === 'smoke' || view.alarm === 'jammed')
			problems.push({
				key: `${card.ref}/${view.alarm}`,
				title: `${name}: ${view.stateLine}`,
				detail: ''
			});

		if (card.scene) {
			scenes.push(deviceScene(card, name));
			continue;
		}
		if (INFRASTRUCTURE.has(view.kind)) {
			more.push(card);
			continue;
		}
		if (isDoorKind(view.kind)) {
			doors.push(card);
			if (view.control?.kind === 'lock' && !view.control.locked && view.available)
				problems.push({
					key: `${card.ref}/unlocked`,
					title: `${name} is unlocked`,
					detail: view.stateLine,
					fix: { label: 'Lock', device: d.device_id, want: { locked: true } }
				});
			else if (isOpen(view) && view.available)
				problems.push({
					key: `${card.ref}/open`,
					title: `${name} is open`,
					detail: view.stateLine
				});
			continue;
		}
		const lamp = spotlights.has(d.device_id) ? null : lampOf(card, view, name);
		if (lamp) {
			lamps.push(lamp);
			continue;
		}
		const reading = readingOf(card, view, name);
		if (reading) {
			readings.push(reading);
			continue;
		}
		if (WATCH_KINDS.has(view.kind)) {
			watch.push({
				card,
				name,
				state: view.stateLine,
				tone:
					!view.available || view.alarm
						? 'bad'
						: view.tone === 'on'
							? 'on'
							: view.tone === 'alert'
								? 'bad'
								: 'ok'
			});
			continue;
		}
		rest.push(card);
	}

	// Lights or switches that share a name but a number go together, once there are two.
	const byStem = new Map<string, Lamp[]>();
	for (const l of lamps) {
		const s = stemOf(l.name);
		if (s) byStem.set(s, [...(byStem.get(s) ?? []), l]);
	}
	const grouped = new Set<Lamp>();
	const groups: LampGroup[] = [];
	for (const [name, members] of byStem)
		if (members.length >= 2 && !POWER.test(name) && !UNNAMED.test(name)) {
			groups.push({ name, members });
			for (const m of members) grouped.add(m);
		}

	const loose = lamps.filter((l) => !grouped.has(l));
	const dimmers = loose.filter((l) => l.level !== null);
	const toggles = loose.filter((l) => l.level === null);
	const power = toggles.filter((l) => l.view.kind === 'outlet' || POWER.test(l.name));
	const switchLights = toggles.filter((l) => !power.includes(l));

	// The glow: each light that is on, spread across the room in the page's order.
	const lit = [...dimmers, ...groups.flatMap((g) => g.members), ...switchLights];
	const glow = lit
		.map((l, i) => ({
			at: lit.length === 1 ? 50 : 8 + (84 * i) / (lit.length - 1),
			rgb: l.rgb,
			level: l.on ? (l.level ?? 70) : 0
		}))
		.filter((g) => g.level > 0);

	scenes.sort((a, b) =>
		a.shape === b.shape ? 0 : a.shape === 'light' ? -1 : b.shape === 'light' ? 1 : 0
	);
	return {
		lights: [...dimmers, ...groups],
		switches: { lights: switchLights, power },
		doors,
		scenes,
		rest,
		readings,
		watch,
		more,
		problems,
		glow
	};
}

/**
 * A reading's number in the person's units. A temperature is in the device's
 * own unit (an Ecowitt station's °F, its temperature_unit), so it is converted
 * from that, never assumed to be °C. Its history and safe range are in it too.
 */
export function shownReading(r: Pick<Reading, 'card' | 'attr'>, v: number): number {
	if (r.attr !== 'temperature') return v;
	return toShown(v, unitOf(r.card.device, 'temperature') ?? '°C');
}

/** A temperature or humidity sensor, with its day (and its own safe range); null for anything else. */
export function readingOf(
	card: Card & { kind: 'device' },
	view: CardView,
	name: string
): Reading | null {
	const a = card.device.attributes ?? {};
	if (!READING_KINDS.has(view.kind)) return null;
	if (typeof a.temperature !== 'number' && typeof a.humidity !== 'number') return null;
	const low = a.temp_limit_low;
	const high = a.temp_limit_high;
	return {
		card,
		view,
		name,
		attr: typeof a.temperature === 'number' ? 'temperature' : 'humidity',
		range:
			typeof low === 'number' && typeof high === 'number' && low < high ? { low, high } : undefined
	};
}

/** A door, a lock, a gate, or the sensor on one: drawn as what it is. */
export const isDoorKind = (kind: string): boolean => DOORS.has(kind) || kind === 'contact_sensor';
/** A sensor that needs only a glance: a line under Watching. */
export const isWatchKind = (kind: string): boolean => WATCH_KINDS.has(kind);

/** A light or a switch as Lit draws it; null for anything else. */
export function lampOf(card: Card & { kind: 'device' }, view: CardView, name: string): Lamp | null {
	const sw = view.control?.kind === 'switch' ? view.control : null;
	if (!LAMPS.has(view.kind) || !sw) return null;
	const dim = view.extras.find((e) => e.kind === 'slider' && e.attr === 'brightness_pct');
	return {
		card,
		view,
		name,
		on: sw.on,
		level: dim && dim.kind === 'slider' ? Math.round(dim.value) : null,
		rgb: view.kind === 'switch' || view.kind === 'outlet' ? WARM : colourOf(card.device),
		attr: sw.attr
	};
}

/** Whether Lit draws this kind of device itself, on any page. */
export const litDraws = (kind: string, scene: boolean): boolean => scene || LAMPS.has(kind);

/** A plugin's scene: its colours, when its lighting system says them, else a keypad's. */
export function deviceScene(card: Card & { kind: 'device' }, name: string): SceneDisc {
	const a = card.device.attributes ?? {};
	const palette = Array.isArray(a.palette)
		? (a.palette as unknown[]).filter((c): c is string => typeof c === 'string')
		: [];
	// A lighting system's scene sets lights even when it doesn't say its colours.
	const lights = palette.length > 0 || LIGHT_SCENE.test(String(a.kind ?? ''));
	return {
		card,
		name,
		shape: lights ? 'light' : 'keypad',
		colours: palette.length > 0 ? palette : lights ? ['#ffd29a', '#ffb45a'] : [],
		does: lights ? 'Sets the lights' : 'A keypad scene',
		badges: [],
		dark: false,
		// Hue says "static" or "dynamic_palette" for the one that's on; others may say active.
		active: a.active === true || a.status === 'static' || a.status === 'dynamic_palette'
	};
}

/**
 * A homeCore scene, read from what it sets: the light it leaves (its lights'
 * warmth, or dark when it turns them all off) and a badge for each other kind
 * of thing it changes, said in a few words.
 */
export function houseScene(
	states: Record<string, unknown>,
	devices: Devices
): { shape: SceneShape; colours: string[]; does: string; badges: SceneBadge[]; dark: boolean } {
	let on = 0;
	let off = 0;
	const colours: string[] = [];
	const badges = new Set<SceneBadge>();
	const words: string[] = [];
	for (const [id, raw] of Object.entries(states)) {
		const d = devices[id];
		const want = (raw ?? {}) as Record<string, unknown>;
		const kind = d ? kindOf(d) : '';
		if (LAMPS.has(kind) && 'on' in want) {
			if (want.on === false) off++;
			else {
				on++;
				const c = colourOf({ ...(d as CoreDevice), attributes: { ...d!.attributes, ...want } });
				const hex =
					'#' +
					c
						.split(',')
						.map((n) => Number(n).toString(16).padStart(2, '0'))
						.join('');
				if (!colours.includes(hex)) colours.push(hex);
			}
		} else if (kind === 'lock' && 'locked' in want) badges.add('lock');
		else if (kind === 'thermostat') badges.add('heat');
		else if (MEDIA_KINDS.has(kind)) badges.add('media');
		else if (d) badges.add('other');
	}
	if (on > 0) words.push(on === 1 ? 'A light on' : `${on} lights on`);
	else if (off > 0) words.push('Lights off');
	if (badges.has('lock')) words.push('locks');
	if (badges.has('heat')) words.push('sets the heat');
	if (badges.has('media')) words.push('a player');
	const dark = on === 0 && off > 0;
	const order: SceneBadge[] = ['lock', 'heat', 'media', 'other'];
	return {
		shape: 'house',
		colours: on > 0 ? colours : [],
		does: words.join(' · ') || 'homeCore scene',
		badges: order.filter((b) => badges.has(b)).slice(0, 3),
		dark
	};
}
