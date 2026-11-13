/**
 * A room's picture in the console's look: the drawing behind its header and
 * on its tile on Home, lit live by its lights (the RoomPictures and
 * HomeConsole boards).
 *
 * A room named like one of the four boards (Family Room, Living Room,
 * Office, Garage) has that board's drawing. Any other gets the drawing of
 * its type, from its name: Bedroom 3 and Master Bedroom a bedroom, Bathroom
 * 2 a bathroom, Outdoor and Porch the outside. A room no name tells about
 * gets a plain one, with a single glow.
 *
 * Each drawing has named glow spots: Pendant 1, Floor lamp, the TV. A spot
 * is matched to the room's devices by name and kind ("Office Desk Lamp" to
 * Desk lamp); a light no spot's name fits takes a spot still dark, so every
 * light in a room shows. Some spots copy another when nothing of their own
 * fits (a hallway's one Overhead lights all three of its ceiling glows).
 * The household can fix a spot's device by hand (`RoomLayout.links`).
 *
 * Pure: the drawings draw what this decides.
 */
import { cardFor, isOpen, kindOf } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import { isCameraLight } from '../cameraLights.js';
import { isHelper } from '../helpers.js';
import { isOn, isPlayer, playerKind } from './media.js';
import { levelOf, shortName } from './room.js';

export type PictureId =
	| 'family'
	| 'living'
	| 'office'
	| 'garage'
	| 'kitchen'
	| 'bedroom'
	| 'bathroom'
	| 'hallway'
	| 'laundry'
	| 'dining'
	| 'attic'
	| 'equipment'
	| 'outside'
	| 'plain';

/**
 * What a spot shows: a light's glow, holiday lights, a screen that's on, a
 * fan turning, a door open, a lock locked, a heater running.
 */
export type SpotKind = 'light' | 'holiday' | 'screen' | 'fan' | 'door' | 'lock' | 'heat';

export interface Spot {
	id: string;
	name: string;
	kind: SpotKind;
	/** The devices it's for, by their name without the room's. */
	words?: RegExp;
	/** Shows this spot's devices when it has none of its own. */
	mirror?: string;
}

export interface Picture {
	id: PictureId;
	name: string;
	spots: Spot[];
	/** Outside, where deck and porch lights belong. */
	outdoor?: boolean;
}

const OVERHEAD = /overhead|ceiling|main|can lights|recessed|downlight/;
const HOLIDAY = /holiday|christmas|string|party|festive|twinkle/;
/** Names that say a light is outside, which an indoor drawing leaves out. */
const OUTDOOR = /deck|porch|outside|outdoor|exterior|flood|yard|patio|driveway|garden|eave/;

const light = (id: string, name: string, words?: RegExp, mirror?: string): Spot => ({
	id,
	name,
	kind: 'light',
	words,
	mirror
});

export const PICTURES: Record<PictureId, Picture> = {
	family: {
		id: 'family',
		name: 'Family Room',
		spots: [
			light('over', 'Overhead', OVERHEAD),
			light('floor', 'Floor lamp', /floor/),
			light('small', 'Small lamp', /small|side|table|accent/),
			light('desk', 'Desk lamp', /desk/),
			{ id: 'hol', name: 'Holiday lights', kind: 'holiday', words: HOLIDAY },
			{ id: 'fan', name: 'Ceiling fan', kind: 'fan' }
		]
	},
	living: {
		id: 'living',
		name: 'Living Room',
		spots: [
			light('c1', 'Ceiling 1', OVERHEAD),
			light('c2', 'Ceiling 2', OVERHEAD, 'c1'),
			light('floor', 'Floor lamp', /floor/),
			light('floor2', 'Second floor lamp', /floor/),
			light('sofa', 'Sofa lamp', /sofa|couch|side|table/),
			light('tower', 'Tower lamp', /tower|column/),
			light('arch', 'Arch lamp', /arch|arc\b|reading/),
			light('strip', 'TV lightstrip', /strip|bias|tv light|play/),
			{ id: 'hol', name: 'Holiday lights', kind: 'holiday', words: HOLIDAY },
			{ id: 'tv', name: 'TV', kind: 'screen' },
			{ id: 'door', name: 'Door', kind: 'door' },
			{ id: 'lock', name: 'Lock', kind: 'lock' }
		]
	},
	office: {
		id: 'office',
		name: 'Office',
		spots: [
			light('over', 'Overhead', /overhead|main|can lights|recessed/),
			light('c1', 'Ceiling 1', /ceiling/),
			light('c2', 'Ceiling 2', /ceiling/, 'c1'),
			light('odl', 'Desk lamp', /desk/),
			light('dl', 'Lamp', /lamp|task|reading/),
			{ id: 'tv', name: 'TV', kind: 'screen' }
		]
	},
	garage: {
		id: 'garage',
		name: 'Garage',
		spots: [
			light('ceil', 'Ceiling', /overhead|ceiling|main|shop light/),
			light('bench', 'Workbench', /bench|work|tool/),
			light('zone', 'Zones', /zone/),
			{ id: 'heat', name: 'Heater', kind: 'heat', words: /heat/ },
			{ id: 'oh1', name: 'Door 1', kind: 'door', words: /\boh ?1\b|door 1\b|left/ },
			{ id: 'oh2', name: 'Door 2', kind: 'door', words: /\boh ?2\b|door 2\b|right/ }
		]
	},
	kitchen: {
		id: 'kitchen',
		name: 'Kitchen',
		spots: [
			light('p1', 'Pendant 1', /pendant|island|overhead|ceiling|main|recessed/),
			light('p2', 'Pendant 2', /pendant|island/, 'p1'),
			light('ucl', 'Under-cabinet left', /under|cabinet|counter/),
			light('ucr', 'Under-cabinet right', /under|cabinet|counter/, 'ucl')
		]
	},
	bedroom: {
		id: 'bedroom',
		name: 'Bedroom',
		spots: [
			light('fan', 'Ceiling fan light', /fan|overhead|ceiling|main/),
			light('lampL', 'Lamp left', /left|lamp|bedside|nightstand|reading/),
			light('lampR', 'Lamp right', /right|lamp|bedside|nightstand|reading/, 'lampL')
		]
	},
	bathroom: {
		id: 'bathroom',
		name: 'Bathroom',
		spots: [light('vanity', 'Vanity', /vanity|mirror|sink/), light('ceil', 'Ceiling', OVERHEAD)]
	},
	hallway: {
		id: 'hallway',
		name: 'Hallway',
		spots: [
			light('c1', 'Ceiling 1', OVERHEAD),
			light('c2', 'Ceiling 2', OVERHEAD, 'c1'),
			light('c3', 'Ceiling 3', OVERHEAD, 'c1')
		]
	},
	laundry: {
		id: 'laundry',
		name: 'Laundry Room',
		spots: [light('ceil', 'Ceiling', OVERHEAD)]
	},
	dining: {
		id: 'dining',
		name: 'Dining Room',
		spots: [
			light('chand', 'Chandelier', /chandelier|overhead|ceiling|pendant|main/),
			light('buffet', 'Buffet lamp', /buffet|lamp|sideboard/)
		]
	},
	attic: {
		id: 'attic',
		name: 'Attic',
		spots: [light('bulb', 'Bulb', /bulb|overhead|ceiling|main/)]
	},
	equipment: {
		id: 'equipment',
		name: 'Equipment Room',
		spots: [light('ceil', 'Ceiling', OVERHEAD)]
	},
	outside: {
		id: 'outside',
		name: 'Outside',
		outdoor: true,
		spots: [
			light('porch', 'Porch light', /porch|front|door|entry/),
			light('flood', 'Flood', /flood|spot|garage|driveway|security/),
			light('path', 'Path lights', /path|walk|landscape|garden|yard|string|step/)
		]
	},
	plain: {
		id: 'plain',
		name: 'Plain',
		spots: [light('ceil', 'Ceiling', OVERHEAD)]
	}
};

// ---- which drawing ----

/** The four boards' rooms, then each type, by the words in a room's name. */
const BY_NAME: [RegExp, PictureId][] = [
	[/family room|\bden\b/, 'family'],
	[/living room|lounge|sitting room/, 'living'],
	[/office|study/, 'office'],
	[/garage/, 'garage'],
	[/kitchen|pantry/, 'kitchen'],
	[/bed ?room|nursery|guest room|\bbr\b/, 'bedroom'],
	[/bath|powder|restroom|toilet|\bwc\b|shower/, 'bathroom'],
	[/hall|\bstair|entry|foyer|landing|corridor|mudroom/, 'hallway'],
	[/laundry|utility/, 'laundry'],
	[/dining/, 'dining'],
	[/attic|loft/, 'attic'],
	[/equipment|mechanical|furnace|boiler|server|network|electrical/, 'equipment'],
	[/outside|outdoor|porch|yard|patio|deck|garden|driveway|exterior|front|back/, 'outside']
];

/** The drawing a room gets from its name. */
export function pictureOf(room: string): PictureId {
	const n = room.toLowerCase();
	return BY_NAME.find(([re]) => re.test(n))?.[1] ?? 'plain';
}

// ---- which devices light which spot ----

const SWITCHES = new Set(['switch', 'outlet', 'plug', 'virtual_switch']);
const DOORS = new Set([
	'contact_sensor',
	'door',
	'window',
	'cover',
	'garage',
	'garage_door',
	'gate'
]);

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
/** A device's name as the room says it, lower case: "Family Room Floor Lamp" is "floor lamp". */
const wordsOf = (d: CoreDevice, room: string) => shortName(nameOf(d), room).toLowerCase();

/** A switch that says it's a light. One a person marked as a light is a light already. */
const lightNamed = (name: string) =>
	/light|lamp|chandelier|sconce|pendant|bulb|overhead/.test(name);
/**
 * A switch that may be a light, a heater or the like, by its name or its
 * spot's. homeCore's own virtual switches are only switches, whatever they're called.
 */
const mayBe = (d: CoreDevice) => SWITCHES.has(kindOf(d)) && !isHelper(d);

/**
 * Whether a device is one of a room's lights: a light, or a switch whose name
 * says it is one ("Deck Flood Light", "Holiday Lights"). A virtual switch
 * named "Porch Light" is a switch.
 */
export function isLamp(d: CoreDevice): boolean {
	const k = kindOf(d);
	return k === 'light' || k === 'dimmer' || (mayBe(d) && lightNamed(nameOf(d).toLowerCase()));
}

/** Whether a device can be shown by a spot of this kind at all. */
export function fits(kind: SpotKind, d: CoreDevice): boolean {
	const k = kindOf(d);
	switch (kind) {
		case 'light':
		case 'holiday':
			return k === 'light' || k === 'dimmer' || mayBe(d);
		case 'screen':
			return isPlayer(d) && playerKind(d) === 'screen';
		case 'fan':
			return k === 'fan';
		case 'door':
			return DOORS.has(k);
		case 'lock':
			return k === 'lock';
		case 'heat':
			return k === 'thermostat' || k === 'heater' || mayBe(d);
	}
}

/** The number at the end of a name, if any: "Ceiling 2" is 2. */
const numberOf = (s: string) => /(\d+)\s*$/.exec(s)?.[1];

/**
 * Which of the room's devices each spot of the drawing shows. A spot no
 * device fits is left out, and draws dark (or, for a mirror, as its twin).
 *
 * `links` are the household's own choices, by spot: that device alone, or
 * none (`''`). A device linked to a spot shows only there.
 */
export function spotsOf(
	picture: PictureId,
	devices: CoreDevice[],
	room: string,
	links: Record<string, string> = {}
): Map<string, CoreDevice[]> {
	const p = PICTURES[picture];
	const out = new Map<string, CoreDevice[]>();
	const add = (spot: string, d: CoreDevice) => out.set(spot, [...(out.get(spot) ?? []), d]);
	const list = [...devices].sort((a, b) =>
		nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true })
	);
	const left: CoreDevice[] = [];
	for (const d of list) {
		const words = wordsOf(d, room);
		const k = kindOf(d);
		// A switch goes to a light spot by its name only (a "Zone 03" in the Garage).
		const named = (s: Spot) =>
			s.words ? s.words.test(words) : s.kind !== 'light' && s.kind !== 'holiday';
		const holiday = HOLIDAY.test(words);
		const can = p.spots.filter(
			(s) =>
				fits(s.kind, d) &&
				named(s) &&
				// Holiday lights go to their own spot, or one named for them (path lights).
				!(s.kind === 'light' && holiday && !s.words?.test(words))
		);
		if (can.length === 0) {
			if (k === 'light' || k === 'dimmer' || (mayBe(d) && lightNamed(words)))
				if (!holiday && (p.outdoor || !OUTDOOR.test(words))) left.push(d);
			continue;
		}
		const n = numberOf(words);
		const pick =
			(n !== undefined ? can.find((s) => numberOf(s.name) === n) : undefined) ??
			can.find((s) => !out.has(s.id)) ??
			can[0]!;
		add(pick.id, d);
	}
	// A light no spot is named for takes a dark spot, else joins the first.
	const lights = p.spots.filter((s) => s.kind === 'light');
	for (const d of left) {
		const free = lights.find((s) => !out.has(s.id));
		const to = free ?? lights[0];
		if (to) add(to.id, d);
	}
	// The household's choices, over what the names matched.
	const fixed = new Set(p.spots.filter((s) => s.id in links).map((s) => s.id));
	const linked = new Set([...fixed].map((id) => links[id]));
	for (const [id, list] of out) {
		const rest = list.filter((d) => !linked.has(d.device_id));
		if (fixed.has(id) || rest.length === 0) out.delete(id);
		else if (rest.length < list.length) out.set(id, rest);
	}
	for (const id of fixed) {
		const d = devices.find((x) => x.device_id === links[id]);
		if (d) out.set(id, [d]);
	}
	for (const s of p.spots)
		if (s.mirror && !fixed.has(s.id) && !out.has(s.id) && out.has(s.mirror))
			out.set(s.id, out.get(s.mirror)!);
	return out;
}

// ---- how much each spot glows ----

/** Each spot's value, 0 to 1: a light's level, else 1 for on, open, locked or running. */
export type Glow = Record<string, number | undefined>;

/** A command on its way to a device: what it was asked to become. */
export type Wants = (id: string) => Record<string, unknown> | undefined;

/** What one device shows on a spot of this kind, 0 to 1. */
export function spotValue(
	kind: SpotKind,
	d: CoreDevice,
	now: number,
	want?: Record<string, unknown>
): number {
	if (!d.available) return 0;
	const a = { ...d.attributes, ...want };
	switch (kind) {
		case 'light':
		case 'holiday':
			return levelOf(d, want) / 100;
		case 'screen':
			return isOn({ ...d, attributes: a }) && a.on !== false ? 1 : 0;
		case 'fan':
			return a.on === true || (typeof a.speed === 'number' && a.speed > 0) ? 1 : 0;
		case 'door':
			return isOpen(cardFor({ ...d, attributes: a }, now)) ? 1 : 0;
		case 'lock': {
			const c = cardFor({ ...d, attributes: a }, now);
			const locked =
				c.control?.kind === 'lock' ? c.control.locked : c.stateLine.startsWith('Locked');
			return locked ? 1 : 0;
		}
		case 'heat':
			return a.hvac_action === 'heating' || (SWITCHES.has(kindOf(d)) && a.on === true) ? 1 : 0;
	}
}

/**
 * How the drawing is lit now: each spot that shows something, by its id.
 * A spot showing several devices takes the brightest.
 */
export function glowOf(
	picture: PictureId,
	spots: Map<string, CoreDevice[]>,
	now: number,
	wants: Wants = () => undefined
): Glow {
	const out: Glow = {};
	for (const s of PICTURES[picture].spots) {
		const list = spots.get(s.id);
		if (!list) continue;
		out[s.id] = Math.max(...list.map((d) => spotValue(s.kind, d, now, wants(d.device_id))));
	}
	return out;
}

/** Whether any light in the drawing is on: a tile with none is drawn dimmer. */
export const anyLit = (picture: PictureId, g: Glow): boolean =>
	PICTURES[picture].spots.some(
		(s) => (s.kind === 'light' || s.kind === 'holiday') && (g[s.id] ?? 0) > 0
	);

// ---- for the drawings ----

/** A glow's opacity: none when off, and a dim light still shows. */
export const op = (v: number | undefined): number => (v && v > 0 ? 0.3 + 0.7 * Math.min(1, v) : 0);

/** A lamp's shade or bulb: warm when lit. */
export const shade = (v: number | undefined): string => (v && v > 0 ? '#fff1d6' : '#4a4f5c');

/**
 * A room's drawing, how it's lit now, and its lights: those `isLamp` takes
 * and anything else the drawing lights by its name (a "Zone 03" in the Garage).
 * `links` are the household's fixed spots (`spotsOf`). `house` is every
 * device, so a camera's spotlight is left out wherever its camera is.
 */
export function roomPicture(
	room: string,
	all: CoreDevice[],
	now: number,
	wants?: Wants,
	links?: Record<string, string>,
	house: Devices | readonly CoreDevice[] = all
): { picture: PictureId; spots: Map<string, CoreDevice[]>; g: Glow; lamps: CoreDevice[] } {
	// A camera's spotlight is its camera's, never one of the room's lamps.
	const devices = all.filter((d) => !isCameraLight(d, house));
	const picture = pictureOf(room);
	const spots = spotsOf(picture, devices, room, links);
	const lit = PICTURES[picture].spots
		.filter((s) => s.kind === 'light' || s.kind === 'holiday')
		.flatMap((s) => spots.get(s.id) ?? []);
	const lamps = devices.filter((d) => isLamp(d) || lit.includes(d));
	return { picture, spots, g: glowOf(picture, spots, now, wants), lamps };
}
