/**
 * A room's Sensors tab in the console (the Garage, Office and FamilyRoom
 * boards): each temperature reading as a big number, with its limits where
 * the sensor keeps them; then what's being watched (motion, occupancy,
 * vibration and the rest) as rows; then every battery in the room.
 *
 * Temperatures are in the person's units. Pure: the tab draws what this decides.
 */
import { kindOf } from '../card.js';
import { unitOf, type CoreDevice } from '../devices.js';
import { toShown, units, type Units } from '../units.js';

export interface Reading {
	device: CoreDevice;
	/** In the person's units. */
	temp?: number;
	humidity?: number;
	/** The sensor's own limits, in the person's units, where it keeps them. */
	low?: number;
	high?: number;
	/** Inside its limits, or past one; nothing without limits. */
	state?: 'ok' | 'cold' | 'warm';
}

export interface SensorsTab {
	readings: Reading[];
	watch: CoreDevice[];
}

/** Sensors watched for what they notice, even where they read a temperature too (a motion sensor). */
const NOTICES = new Set([
	'motion_sensor',
	'occupancy_sensor',
	'vibration_sensor',
	'smoke_sensor',
	'co_sensor',
	'contact_sensor',
	'binary_sensor'
]);

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** A sensor's temperature and humidity, where it reads either. */
export function readingOf(d: CoreDevice, u: Units = units()): Reading | undefined {
	const a = d.attributes;
	const t = num(a.temperature);
	const humidity = num(a.humidity);
	if (t === undefined && humidity === undefined) return undefined;
	// homeCore keeps temperatures in °C; a sensor that says otherwise is read in its own.
	const deg = (attr: string, v: number | undefined) =>
		v === undefined ? undefined : toShown(v, unitOf(d, attr) ?? '°C', u);
	const low = deg('temp_limit_low', num(a.temp_limit_low));
	const high = deg('temp_limit_high', num(a.temp_limit_high));
	const state =
		a.too_cold === true
			? 'cold'
			: a.too_warm === true
				? 'warm'
				: low !== undefined && high !== undefined
					? 'ok'
					: undefined;
	return {
		device: d,
		...(t !== undefined ? { temp: deg('temperature', t) } : {}),
		...(humidity !== undefined ? { humidity } : {}),
		...(low !== undefined ? { low } : {}),
		...(high !== undefined ? { high } : {}),
		...(state ? { state } : {})
	};
}

/** Where a reading sits between its limits, 0 to 1, for the bar under it. */
export function between(r: Reading): number | undefined {
	if (r.temp === undefined || r.low === undefined || r.high === undefined || r.high <= r.low)
		return undefined;
	return Math.min(1, Math.max(0, (r.temp - r.low) / (r.high - r.low)));
}

export function sensorsTab(devices: CoreDevice[], u: Units = units()): SensorsTab {
	const readings: Reading[] = [];
	const watch: CoreDevice[] = [];
	for (const d of devices) {
		const r = NOTICES.has(kindOf(d)) ? undefined : readingOf(d, u);
		if (r) readings.push(r);
		else watch.push(d);
	}
	return { readings, watch };
}
