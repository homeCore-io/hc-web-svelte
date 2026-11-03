/**
 * What the app sets in a Rive drawing's view model, for each family it can
 * draw. A drawing reads the names it declares and ignores the rest, so a file
 * may use as few of them as it likes.
 */
import type { Thermostat } from '../thermostat.js';

export type RiveValues = Record<string, number | boolean | string>;

/** The version of these names. A drawing that expects a newer one is left out. */
export const RIVE_VALUES = 1;

/** The families a Rive drawing can draw so far. */
export const RIVE_FAMILIES: readonly string[] = ['climate'];

/**
 * A thermostat's: whether it heats, cools or is on, the reading and the
 * target in the person's units, the ends of its scale, and whether its loops
 * may play (the look's motion is lively).
 */
export function climateValues(
	t: Thermostat,
	target: number | undefined,
	lively: boolean
): RiveValues {
	const aim = target ?? t.target ?? t.now ?? t.min;
	// On the thermostat's step, as its card shows them: whole °F, half °C.
	const on = (v: number) => Math.round(v / t.step) * t.step;
	const now = t.now === undefined ? aim : t.now;
	return {
		heating: t.doing === 'heating',
		cooling: t.doing === 'cooling',
		on: t.doing !== 'off',
		temperature: on(now),
		target: on(aim),
		low: t.min,
		high: t.max,
		moving: lively,
		unit: t.unit
	};
}
