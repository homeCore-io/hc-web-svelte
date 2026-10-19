/**
 * What "Add a card" offers, sorted for finding: a shelf per kind of thing
 * (the chips along the top) and, within it, a heading per room.
 */
import type { CoreDevice } from './devices.js';
import { displayName } from './devices.js';
import { cardFor, INFRASTRUCTURE, kindOf, SENSORS, type IconName } from './card.js';
import { kindLabel, pluginLabel } from './inventory.js';
import type { Room } from './house.js';
import { roomOf } from './summary.js';

export type Shelf = 'light' | 'sensor' | 'scene' | 'media' | 'lock' | 'mode' | 'hub' | 'other';

/** The chips, in order; a shelf with nothing on it is left out. */
export const SHELVES: { id: Shelf; label: string }[] = [
	{ id: 'light', label: 'Lights & switches' },
	{ id: 'sensor', label: 'Sensors' },
	{ id: 'scene', label: 'Scenes' },
	{ id: 'media', label: 'Media' },
	{ id: 'lock', label: 'Locks & doors' },
	{ id: 'mode', label: 'Modes & timers' },
	{ id: 'hub', label: 'Hubs & remotes' },
	{ id: 'other', label: 'Other' }
];

const LIGHTS = new Set(['light', 'dimmer', 'switch', 'outlet', 'fan', 'group']);
const MEDIA = new Set(['media_player', 'tv', 'speaker']);
const LOCKS = new Set(['lock', 'garage', 'gate']);
const MODES = new Set(['mode', 'timer']);

export function shelfOf(kind: string): Shelf {
	if (kind === 'scene') return 'scene';
	if (LIGHTS.has(kind)) return 'light';
	if (MEDIA.has(kind)) return 'media';
	if (LOCKS.has(kind)) return 'lock';
	if (MODES.has(kind)) return 'mode';
	if (INFRASTRUCTURE.has(kind)) return 'hub';
	if (SENSORS.has(kind)) return 'sensor';
	return 'other';
}

export interface Offer {
	ref: string;
	name: string;
	shelf: Shelf;
	icon: IconName;
	/** What it is, in a word or two: "Light", "Scene · Hue". */
	what: string;
	/** Its room's id, or `''` for none. */
	room: string;
}

export function deviceOffer(d: CoreDevice, rooms: Room[], ref: string): Offer {
	const kind = kindOf(d);
	const shelf = shelfOf(kind);
	const icon = cardFor(d).icon;
	return {
		ref,
		name: displayName(d),
		shelf,
		// A card draws a scene as a button, with no symbol of its own.
		icon: icon === 'device' && shelf === 'scene' ? 'scene' : icon,
		what: shelf === 'scene' ? `Scene · ${pluginLabel(d.plugin_id ?? '')}` : kindLabel(kind),
		room: roomOf(d, rooms)?.id ?? ''
	};
}

/** Whether a search finds it: every word, in its name, room or kind. */
export function finds(query: string, words: string): boolean {
	const hay = words.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((w) => hay.includes(w));
}

/** Offers under their rooms' headings, in the rooms' order; no room last. */
export function underRooms(
	offers: Offer[],
	rooms: Room[]
): { id: string; name: string; offers: Offer[] }[] {
	const out = [...rooms.map((r) => ({ id: r.id, name: r.name })), { id: '', name: 'Not in a room' }]
		.map((r) => ({
			...r,
			offers: offers.filter((o) => o.room === r.id).sort((a, b) => a.name.localeCompare(b.name))
		}))
		.filter((r) => r.offers.length > 0);
	return out;
}
