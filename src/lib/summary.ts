/**
 * The generated home's summaries (D1, C5): what's on, what's open, what's
 * playing — for the house as chips, and for each room as one line — and which
 * devices a room's "All off" turns off.
 *
 * Built from the card descriptions, so a summary never disagrees with the
 * cards it summarises.
 */
import { cardFor, INFRASTRUCTURE, isOpen, SENSORS, type CardView } from './card.js';
import { roomSlug, type CoreDevice, type Devices } from './devices.js';
import type { Room } from './house.js';
import { cameraLightCards } from './cameraLights.js';

export interface Chip {
	key: string;
	text: string;
	icon: 'light' | 'door-open' | 'tv' | 'water' | 'unlock' | 'alert';
	alert: boolean;
	ids: string[];
}

/** Kinds whose "on" a person would call a light, when the house's lights aren't given. */
const LIGHTS = new Set(['light']);

/**
 * The cards that are lights: those in `lights`, the house's lights as every
 * place counts them (lights.ts, `houseNow.lightIds`); without it, lights
 * that aren't a camera's spotlight.
 */
/** The cards playing: those in `playingIds` (playing.ts); without them, those that say so. */
const playingCards = (cards: CardView[], playingIds?: ReadonlySet<string>): CardView[] =>
	cards.filter((c) =>
		playingIds ? playingIds.has(c.id) : c.available && c.stateLine.startsWith('Playing')
	);

function lightCards(cards: CardView[], lights?: ReadonlySet<string>): CardView[] {
	if (lights) return cards.filter((c) => lights.has(c.id));
	const spot = cameraLightCards(cards);
	return cards.filter((c) => LIGHTS.has(c.kind) && !spot.has(c.id));
}
/** Kinds "All off" turns off. Never a lock, a mode or a timer. */
const ALL_OFF = new Set(['light', 'switch', 'outlet', 'fan', 'media_player', 'tv', 'speaker']);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The chips at the top of Home, in a fixed order; only those with something
 * to say. `cards` are the house's; `lights`, the ids of its lights
 * (`houseNow.lightIds`); `playingIds`, its players playing (playing.ts).
 */
export function houseChips(
	cards: CardView[],
	lights?: ReadonlySet<string>,
	playingIds?: ReadonlySet<string>
): Chip[] {
	const lit = lightCards(cards, lights).filter((c) => c.available && c.tone === 'on');
	const open = cards.filter((c) => c.available && isOpen(c));
	const unlocked = cards.filter((c) => c.available && c.icon === 'unlock');
	const playing = playingCards(cards, playingIds);
	const wet = cards.filter((c) => c.alarm === 'wet');
	const chips: Chip[] = [];
	if (wet.length > 0)
		chips.push({
			key: 'wet',
			text: plural(wet.length, 'leak', 'leaks'),
			icon: 'water',
			alert: true,
			ids: ids(wet)
		});
	if (open.length > 0)
		chips.push({
			key: 'open',
			text: `${open.length} open`,
			icon: 'door-open',
			alert: false,
			ids: ids(open)
		});
	if (unlocked.length > 0)
		chips.push({
			key: 'unlocked',
			text: `${unlocked.length} unlocked`,
			icon: 'unlock',
			alert: false,
			ids: ids(unlocked)
		});
	if (lit.length > 0)
		chips.push({
			key: 'lights',
			text: plural(lit.length, 'light on', 'lights on'),
			icon: 'light',
			alert: false,
			ids: ids(lit)
		});
	if (playing.length === 1)
		chips.push({
			key: 'playing',
			text: `${playing[0]!.name} playing`,
			icon: 'tv',
			alert: false,
			ids: ids(playing)
		});
	else if (playing.length > 1)
		chips.push({
			key: 'playing',
			text: `${playing.length} playing`,
			icon: 'tv',
			alert: false,
			ids: ids(playing)
		});
	return chips;
}

/**
 * A room's one line: lights on, the temperature, anything open, anything
 * playing. `temperature` is the room's, as its box says it (`roomBox.ts`),
 * so the line and the box never show two numbers for one room. `lights`
 * are the house's lights (`houseNow.lightIds`); a switch that isn't one is a switch.
 */
export function roomSummary(
	cards: CardView[],
	temperature?: string,
	lights?: ReadonlySet<string>,
	playingIds?: ReadonlySet<string>
): string {
	const parts: string[] = [];
	const wet = cards.filter((c) => c.alarm === 'wet').length;
	if (wet > 0) parts.push(wet === 1 ? 'Leak' : `${wet} leaks`);
	const lamps = lightCards(cards, lights);
	const on = lamps.filter((c) => c.available && c.tone === 'on').length;
	if (on > 0) parts.push(plural(on, 'light on', 'lights on'));
	// Everything else "All off" would turn off, so the button never sits beside
	// a summary that says nothing is on.
	const switches = cards.filter(
		(c) =>
			c.available &&
			(c.kind === 'switch' || c.kind === 'outlet') &&
			c.tone === 'on' &&
			!lamps.includes(c)
	).length;
	if (switches > 0) parts.push(plural(switches, 'switch on', 'switches on'));
	const fans = cards.filter((c) => c.available && c.kind === 'fan' && c.tone === 'on').length;
	if (fans > 0) parts.push(plural(fans, 'fan on', 'fans on'));
	if (temperature) parts.push(temperature);
	const open = cards.filter((c) => c.available && isOpen(c));
	if (open.length === 1) parts.push(`${open[0]!.name} open`);
	else if (open.length > 1) parts.push(`${open.length} open`);
	const playing = playingCards(cards, playingIds);
	if (playing.length === 1) parts.push(`${playing[0]!.name} playing`);
	else if (playing.length > 1) parts.push(`${playing.length} playing`);
	return parts.length > 0 ? parts.join(' · ') : 'All quiet';
}

/** What "All off" would turn off in a room right now — empty hides the button. */
export function allOffTargets(cards: CardView[]): CardView[] {
	return cards.filter(
		(c) =>
			c.available &&
			ALL_OFF.has(c.kind) &&
			c.control !== null &&
			((c.control.kind === 'switch' && c.control.on) ||
				(c.control.kind === 'play' && c.tone !== 'off'))
	);
}

/** Normalise a room name or slug the way homeCore does. */
export function slugOf(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/** The room a device belongs to, by its slug or any of the room's aliases. */
export function roomOf(d: CoreDevice, rooms: Room[]): Room | undefined {
	const slug = roomSlug(d);
	if (slug === undefined) return undefined;
	const s = slugOf(slug);
	return rooms.find((r) => r.slug === s || r.aliases.includes(s));
}

/** Devices grouped by room id; devices in no room under `''`. */
export function byRoom(devices: Devices, rooms: Room[]): Map<string, CoreDevice[]> {
	const out = new Map<string, CoreDevice[]>();
	for (const d of Object.values(devices)) {
		const key = roomOf(d, rooms)?.id ?? '';
		const list = out.get(key);
		if (list) list.push(d);
		else out.set(key, [d]);
	}
	return out;
}

export interface Section {
	key: 'controls' | 'scenes' | 'sensors' | 'other';
	title: string;
	cards: CardView[];
}

/** A generated room page: things to use, scenes, readings, then infrastructure. */
export function roomSections(cards: CardView[]): Section[] {
	const by = (a: CardView, b: CardView) => a.name.localeCompare(b.name);
	const scenes = cards.filter((c) => c.kind === 'scene').sort(by);
	const sensors = cards.filter((c) => SENSORS.has(c.kind)).sort(by);
	const other = cards.filter((c) => INFRASTRUCTURE.has(c.kind)).sort(by);
	const placed = new Set([...scenes, ...sensors, ...other]);
	const controls = cards.filter((c) => !placed.has(c)).sort(by);
	const sections: Section[] = [
		{ key: 'controls', title: 'Controls', cards: controls },
		{ key: 'scenes', title: 'Scenes', cards: scenes },
		{ key: 'sensors', title: 'Sensors', cards: sensors },
		{ key: 'other', title: 'Other', cards: other }
	];
	return sections.filter((s) => s.cards.length > 0);
}

export function cardsOf(devices: CoreDevice[], now = Date.now()): CardView[] {
	return devices.map((d) => cardFor(d, now));
}

function ids(cards: CardView[]): string[] {
	return cards.map((c) => c.id);
}
