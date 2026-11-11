/**
 * A room's Doors tab in the console (the Garage and LivingRoom boards):
 * overhead doors drawn big, each with the opener that moves it; then the
 * other doors and windows, the locks, and the cameras and sirens (until
 * there is a Security tab).
 *
 * An opener is often a switch or a keypad's scene named for its door ("OH
 * Door 01", "Garage Door 1"), and its door's state comes from a contact
 * sensor ("Garage OH1 Door Sensor"). They are paired by the door's number.
 *
 * Pure: the tab draws what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice } from '../devices.js';
import { opens, shortName } from './room.js';

/** An overhead door: its sensor says where it is, its opener moves it. */
export interface BigDoor {
	key: string;
	name: string;
	sensor?: CoreDevice;
	/** What a press of its button sends to; the first of its openers. */
	opener?: CoreDevice;
	/** Its other openers, named under it. */
	also: CoreDevice[];
}

export interface DoorsTab {
	big: BigDoor[];
	/** Doors and windows with a sensor only. */
	doors: CoreDevice[];
	locks: CoreDevice[];
	/** Openers that go with no door here: pressed, not knowing which way. */
	openers: CoreDevice[];
	/** Cameras, sirens and doorbells. */
	watch: CoreDevice[];
}

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
const OVERHEAD = /\b(oh\s*\d+|oh\b|overhead|garage\s*door)/i;
const SENSORS = new Set(['contact_sensor', 'door', 'window']);
const OWN = new Set(['cover', 'garage', 'garage_door', 'gate', 'shade', 'blind']);

/** The door a name numbers: "OH1", "OH Door 01" and "Garage Door 1" are all 1. */
export function doorNumber(name: string): number | undefined {
	const m = /\b(?:oh|door)\s*0*(\d+)\b/i.exec(name);
	return m ? Number(m[1]) : undefined;
}

/** Whether a sensor's name says it watches an overhead door. */
export const isOverhead = (name: string): boolean => OVERHEAD.test(name);

/** A door's name from its sensor's: "Garage OH1 Door Sensor" in the Garage is "OH1 Door". */
export const doorName = (name: string, room: string): string =>
	shortName(name.replace(/\s+sensor$/i, ''), room);

/** Sort the tab's devices: overhead doors with their openers, then the rest. */
export function doorsTab(devices: CoreDevice[], room = ''): DoorsTab {
	const tab: DoorsTab = { big: [], doors: [], locks: [], openers: [], watch: [] };
	const sensors = devices.filter((d) => SENSORS.has(kindOf(d)));
	const openers = devices.filter((d) => opens(d) && !OWN.has(kindOf(d)));
	const byNumber = new Map<number, BigDoor>();
	for (const s of sensors) {
		const n = doorNumber(nameOf(s));
		if (n === undefined || !isOverhead(nameOf(s)) || byNumber.has(n)) continue;
		const door: BigDoor = {
			key: s.device_id,
			name: doorName(nameOf(s), room),
			sensor: s,
			also: []
		};
		byNumber.set(n, door);
		tab.big.push(door);
	}
	for (const o of openers) {
		const n = doorNumber(nameOf(o));
		const door = n === undefined ? undefined : byNumber.get(n);
		if (!door) tab.openers.push(o);
		else if (!door.opener) door.opener = o;
		else door.also.push(o);
	}
	// A cover or garage door that reports where it is moves itself.
	for (const d of devices.filter((d) => OWN.has(kindOf(d))))
		tab.big.push({
			key: d.device_id,
			name: shortName(nameOf(d), room),
			sensor: d,
			opener: d,
			also: []
		});
	const paired = new Set(tab.big.map((b) => b.sensor?.device_id));
	tab.doors = sensors.filter((s) => !paired.has(s.device_id));
	tab.locks = devices.filter((d) => kindOf(d) === 'lock');
	const placed = new Set([
		...paired,
		...openers.map((o) => o.device_id),
		...tab.doors.map((d) => d.device_id),
		...tab.locks.map((d) => d.device_id)
	]);
	tab.watch = devices.filter((d) => !placed.has(d.device_id) && !OWN.has(kindOf(d)));
	return tab;
}

/** What pressing an opener sends, and whether the door may open by it. */
export type Press =
	| { kind: 'action'; id: string; params?: Record<string, unknown> }
	| { kind: 'set'; want: Record<string, unknown> };

/**
 * A press of a door's button: a scene runs, a switch flips, a cover is told
 * which way. `open` is where its sensor says the door is, when one does.
 */
export function pressFor(opener: CoreDevice, open: boolean | undefined): Press | undefined {
	const a = opener.attributes;
	const s = opener.schema;
	const actions = s?.actions?.map((x) => x.id) ?? [];
	if (kindOf(opener) === 'scene')
		return actions.includes('activate') ? { kind: 'action', id: 'activate' } : undefined;
	if (OWN.has(kindOf(opener))) {
		if (s?.attributes.open?.writable) return { kind: 'set', want: { open: !open } };
		const way = open ? 'close' : 'open';
		if (actions.includes(way)) return { kind: 'action', id: way };
		if (s?.attributes.position?.writable)
			return { kind: 'set', want: { position: open ? 0 : 100 } };
		return undefined;
	}
	return { kind: 'set', want: { on: a.on !== true } };
}
