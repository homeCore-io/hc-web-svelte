/**
 * Batteries (13 §13.1, F2): every battery's level, lowest first, with low
 * judged as homeCore judges it (its alerts), never by a line of the list's
 * own. A room's Batteries section and "All batteries" off Alerts show it.
 */
import { batteryLow, batteryOf } from './card.js';
import { displayName, type CoreDevice } from './devices.js';

export interface Battery {
	id: string;
	name: string;
	pct: number;
	low: boolean;
}

export function batteriesOf(devices: readonly CoreDevice[]): Battery[] {
	return devices
		.flatMap((d): Battery[] => {
			const pct = batteryOf(d);
			return pct === undefined
				? []
				: [{ id: d.device_id, name: displayName(d), pct: Math.round(pct), low: batteryLow(d) }];
		})
		.sort((a, b) => Number(b.low) - Number(a.low) || a.pct - b.pct || a.name.localeCompare(b.name));
}
