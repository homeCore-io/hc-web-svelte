/**
 * A room in the Lit look (docs/design/12-lit-look.md): what it holds, sorted
 * by what Lit draws for each, and the light the room is in.
 *
 * The page's own arrangement still applies (what is hidden, what a card is
 * called); Lit only decides where each kind of thing goes on the page.
 */
import type { CoreDevice } from '../devices.js';
import { INFRASTRUCTURE, isOpen, type CardView } from '../card.js';
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

export interface SceneDisc {
	card: Card;
	name: string;
	shape: SceneShape;
	/** Its colours, for a light scene. */
	colours: string[];
	/** What it does, in a few words. */
	does: string;
}

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
	names: Record<string, string> = {}
): LitRoom {
	const lamps: Lamp[] = [];
	const doors: Card[] = [];
	const scenes: SceneDisc[] = [];
	const rest: Card[] = [];
	const more: Card[] = [];
	const problems: Problem[] = [];

	for (const card of cards) {
		if (card.kind === 'scene') {
			scenes.push({
				card,
				name: named(card, names) ?? card.name,
				shape: 'house',
				colours: [],
				does: 'homeCore scene'
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
			const palette = Array.isArray(d.attributes?.palette)
				? (d.attributes.palette as unknown[]).filter((c): c is string => typeof c === 'string')
				: [];
			// A lighting system's scene sets lights even when it doesn't say its colours.
			const lights = palette.length > 0 || LIGHT_SCENE.test(String(d.attributes?.kind ?? ''));
			scenes.push({
				card,
				name,
				shape: lights ? 'light' : 'keypad',
				colours: palette.length > 0 ? palette : lights ? ['#ffd29a', '#ffb45a'] : [],
				does: lights ? 'Sets the lights' : 'A keypad scene'
			});
			continue;
		}
		if (INFRASTRUCTURE.has(view.kind)) {
			more.push(card);
			continue;
		}
		if (DOORS.has(view.kind) || view.kind === 'contact_sensor') {
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
		const sw = view.control?.kind === 'switch' ? view.control : null;
		if (LAMPS.has(view.kind) && sw) {
			const dim = view.extras.find((e) => e.kind === 'slider' && e.attr === 'brightness_pct');
			lamps.push({
				card,
				view,
				name,
				on: sw.on,
				level: dim && dim.kind === 'slider' ? Math.round(dim.value) : null,
				rgb: view.kind === 'switch' || view.kind === 'outlet' ? WARM : colourOf(d),
				attr: sw.attr
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
		more,
		problems,
		glow
	};
}
