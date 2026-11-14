/**
 * What counts for security, the same everywhere the app counts it: Everywhere
 * › Security and the sidebar's count, a room's header pills, Home's what needs
 * attention, its tiles and boxes, and Lit's.
 *
 * By its type a lock counts, and a door, window or cover that opens; an admin
 * may put anything else in (watched: a motion sensor, a gate contact, a shed
 * light) or take anything out, for everyone (homeCore's `security`).
 *
 * Pure.
 */
import { cardFor, isOpen, kindOf, type CardView } from './card.js';
import type { CoreDevice } from './devices.js';

export const OPENER_KINDS = new Set(['cover', 'garage', 'garage_door', 'gate', 'shade', 'blind']);
export const OPENING_KINDS = new Set(['contact_sensor', 'door', 'window', ...OPENER_KINDS]);

/**
 * Whether a kind of device keeps the house shut, as a header's pills show
 * it: a lock, or a door, window or cover that opens.
 */
export function guards(kind: string): 'lock' | 'door' | undefined {
	if (kind === 'lock') return 'lock';
	return OPENING_KINDS.has(kind) ? 'door' : undefined;
}

/**
 * How a device counts for security, as everywhere in the app counts it: a
 * lock, a door (or window, or cover), something else watched, or not at all.
 * Its own choice (`security`) wins: false leaves it out, true puts it in;
 * missing, it goes by its type, as `guards` says.
 */
export function securityKind(d: CoreDevice): 'lock' | 'door' | 'watch' | undefined {
	if (d.security === false) return undefined;
	return guards(kindOf(d)) ?? (d.security === true ? 'watch' : undefined);
}

/** What says a watched device is active: something moving or there, open, wet, on. */
const ACTIVE = [
	'motion',
	'occupied',
	'occupancy',
	'presence',
	'present',
	'open',
	'contact_open',
	'water_detected',
	'leak',
	'wet',
	'on'
];

/**
 * Whether a watched device needs a look: in its active state, by the words
 * above, else its first yes-or-no reading (its schema's primary first) is yes.
 * A `contact` reading is true when the contact is made, so false is open.
 */
export function watchActive(d: CoreDevice): boolean {
	const a = d.attributes ?? {};
	if (a.contact === false) return true;
	const known = ACTIVE.filter((k) => typeof a[k] === 'boolean');
	if (known.length > 0 || typeof a.contact === 'boolean') return known.some((k) => a[k] === true);
	const s = d.schema?.attributes ?? {};
	const first = [...(d.schema?.primary ?? []), ...Object.keys(s).sort()].find(
		(n) => s[n]?.kind === 'bool' && typeof a[n] === 'boolean'
	);
	return first !== undefined && a[first] === true;
}

/** A watched device's state in a word or two, as its card says it: "Motion", "Off", "Wet". */
export function watchWord(d: CoreDevice, now = Date.now()): string {
	const said = cardFor(d, now).stateLine.split(' · ')[0];
	return said && said !== '—' ? said : watchActive(d) ? 'On' : 'Off';
}

// ---- as cards ----

/** The house's devices by id, for a card to find its own. */
type ById = Readonly<Record<string, CoreDevice | undefined>>;

/** How a card counts for security: its device's choice, else (its device not at hand) its kind. */
export function cardSecurity(c: CardView, byId?: ById): ReturnType<typeof securityKind> {
	const d = byId?.[c.id];
	return d ? securityKind(d) : guards(c.kind);
}

/**
 * Whether a card needs a look as an open door does: a door, window or cover
 * open, or a watched device active. Never one that is offline.
 */
export function cardOpen(c: CardView, byId?: ById): boolean {
	if (!c.available) return false;
	const counts = cardSecurity(c, byId);
	const d = byId?.[c.id];
	if (counts === 'watch') return d !== undefined && watchActive(d);
	return counts !== undefined && isOpen(c);
}

/** Whether a card is a lock left unlocked that counts for security. */
export const cardUnlocked = (c: CardView, byId?: ById): boolean =>
	c.available && c.icon === 'unlock' && cardSecurity(c, byId) !== undefined;

/**
 * What needs a look, in words, as `cardOpen` finds it: one by name, "Pantry
 * Door open" or a watched one's "Driveway Motion: Motion"; more counted, "2
 * open" while they are all doors, else "3 to check".
 */
export function openWords(open: CardView[], byId?: ById): string | undefined {
	const watched = (c: CardView) => cardSecurity(c, byId) === 'watch';
	if (open.length === 0) return undefined;
	if (open.length === 1) {
		const c = open[0]!;
		return watched(c) ? `${c.name}: ${c.stateLine.split(' · ')[0]}` : `${c.name} open`;
	}
	return open.some(watched) ? `${open.length} to check` : `${open.length} open`;
}
