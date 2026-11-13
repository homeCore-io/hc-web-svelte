/**
 * What counts as one of the house's lights, and how many are on: one rule
 * for Home, the sidebar, room headers, a Lights tab's count and Everywhere,
 * in every look.
 *
 * A light is a light or a dimmer, a switch whose name says it is a light
 * ("Deck Flood Light", "Holiday Lights"), or a switch the room's drawing
 * takes as a light by its name (a "Zone 03" in the Garage, `roomLights` in
 * pictures.ts). A switch that powers something else (an AC outlet, a fan,
 * an exhaust fan, a power meter, a heater) and homeCore's own virtual
 * switches are not, unless the household placed them as lights: put them on
 * a room's Lights tab, or on a light in its drawing. A camera's spotlight
 * never is (cameraLights.ts).
 *
 * Pure.
 */
import { kindOf } from './card.js';
import type { CoreDevice } from './devices.js';
import { isHelper } from './helpers.js';

const SWITCHES = new Set(['switch', 'outlet', 'plug', 'virtual_switch']);

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;

/** A name that says it is a light. */
export const lightNamed = (name: string): boolean =>
	/light|lamp|chandelier|sconce|pendant|bulb|overhead/.test(name.toLowerCase());

/** A name that says it powers something other than a light: "Outlet - Living Room AC". */
export const powersNamed = (name: string): boolean =>
	/\b(fan|exhaust|heat|heater|plug|outlet|valve|pump|charger|ac|air|socket|power|meter|humidifier|dehumidifier|door|gate)\b/i.test(
		name
	);

/**
 * A switch that may be a light, a heater or the like, by its name or its
 * spot's. homeCore's own virtual switches are only switches, whatever they're called.
 */
export const mayBeLight = (d: CoreDevice): boolean => SWITCHES.has(kindOf(d)) && !isHelper(d);

/**
 * Whether a device is a light by itself: a light or a dimmer (or anything
 * marked as a light), or a switch whose name says it is one. A virtual
 * switch named "Porch Light" is a switch.
 */
export function isLamp(d: CoreDevice): boolean {
	const k = kindOf(d);
	return k === 'light' || k === 'dimmer' || (mayBeLight(d) && lightNamed(nameOf(d)));
}

/** A light's level, 0 to 100: its brightness when on, else 0. `want` is a command on its way. */
export function lightLevel(d: CoreDevice, want?: Record<string, unknown>): number {
	const a = { ...d.attributes, ...want };
	if (a.on !== true) return 0;
	return typeof a.brightness_pct === 'number' ? Math.round(a.brightness_pct) : 100;
}

/** Commands on their way, by device: what each was asked to become. */
export type LightWants = Record<string, { want?: Record<string, unknown> } | undefined>;

/** Whether a light is on, with a command on its way: an offline light is not. */
export const isLit = (d: CoreDevice, wants: LightWants = {}): boolean =>
	d.available && lightLevel(d, wants[d.device_id]?.want) > 0;

/** A room's lights, or the lights in no room (`room` missing). */
export interface LightGroup {
	room?: unknown;
	lights: CoreDevice[];
}

/** The house's lights on: how many, of how many, in how many rooms, and how many in no room. */
export interface LightsCount {
	on: number;
	all: number;
	/** Rooms with a light on. No room is not a room. */
	rooms: number;
	/** Lights on that are in no room. */
	loose: number;
}

export function lightsCount(groups: LightGroup[], wants: LightWants = {}): LightsCount {
	const all = groups.flatMap((g) => g.lights);
	const on = all.filter((d) => isLit(d, wants)).length;
	const lit = groups.filter((g) => g.lights.some((d) => isLit(d, wants)));
	const rooms = lit.filter((g) => g.room !== undefined).length;
	const loose = groups
		.filter((g) => g.room === undefined)
		.flatMap((g) => g.lights)
		.filter((d) => isLit(d, wants)).length;
	return { on, all: all.length, rooms, loose };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Where the lights on are, after "N lights on": "in 10 rooms", "in 10 rooms
 * and 1 with no room", "with no room". Empty when none is on.
 */
export function whereLit(c: Pick<LightsCount, 'rooms' | 'loose'>): string {
	if (c.rooms === 0) return c.loose > 0 ? 'with no room' : '';
	const rooms = `in ${plural(c.rooms, 'room', 'rooms')}`;
	return c.loose > 0 ? `${rooms} and ${c.loose} with no room` : rooms;
}
