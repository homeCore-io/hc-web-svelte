/**
 * A room's Water tab in the console (the Garage board): its leak sensors,
 * each dry or wet, and the valves that shut its water off. Anything else the
 * household put here (a switch, a timer) is drawn as it would be with the switches.
 *
 * Pure: the tab draws what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice } from '../devices.js';
import { runsValve } from './room.js';

const LEAKS = new Set(['water_sensor', 'leak_sensor']);
const VALVES = new Set(['valve', 'water_valve', 'sprinkler']);

export interface WaterTab {
	leaks: CoreDevice[];
	/** Valves, sprinklers and the switches named for a valve. */
	valves: CoreDevice[];
	/** Anything else. */
	other: CoreDevice[];
}

export function waterTab(devices: CoreDevice[]): WaterTab {
	const valve = (d: CoreDevice) => VALVES.has(kindOf(d)) || runsValve(d);
	return {
		leaks: devices.filter((d) => LEAKS.has(kindOf(d))),
		valves: devices.filter(valve),
		other: devices.filter((d) => !LEAKS.has(kindOf(d)) && !valve(d))
	};
}

/** Whether a leak sensor has found water. */
export const wet = (d: CoreDevice): boolean =>
	d.attributes.water_detected === true || d.attributes.leak === true;

/** The attribute a valve says it's open with: its own `open`, else a switch's `on`. */
export const valveAttr = (d: CoreDevice): 'open' | 'on' =>
	typeof d.attributes.open === 'boolean' || d.schema?.attributes.open ? 'open' : 'on';

/**
 * Whether a valve lets water through. `want` is a command on its way. A
 * switch for a valve is a relay that powers the valve shut, like the
 * YoLink one: off lets water through, on shuts it off.
 */
export function valveOpen(d: CoreDevice, want?: Record<string, unknown>): boolean {
	const a = { ...d.attributes, ...want };
	return valveAttr(d) === 'open' ? a.open === true : a.on === false;
}

/** What opening or shutting a valve sends. */
export const valveWant = (d: CoreDevice, open: boolean): Record<string, unknown> =>
	valveAttr(d) === 'open' ? { open } : { on: !open };
