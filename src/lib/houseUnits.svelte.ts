/**
 * The household's temperature unit, kept by homeCore: what a person reads
 * in until they choose their own (`units.ts`). Unset, each browser's
 * language decides. Anyone signed in reads it; an admin changes it.
 */
import {
	loadTemperatureUnit,
	setTemperatureUnit,
	type HouseTemperature,
	type Answer
} from './systemAdmin.js';
import type { TemperatureUnit } from './units.js';

const fromCore = (h: HouseTemperature): TemperatureUnit | undefined =>
	h.chosen ? (h.temperature_unit === '°F' ? 'F' : 'C') : undefined;

class HouseUnits {
	temperature = $state<TemperatureUnit | undefined>(undefined);

	async load(): Promise<void> {
		const a = await loadTemperatureUnit();
		// An older homeCore has no such call: the browser's, as before.
		if (a.ok) this.temperature = fromCore(a.data);
	}

	/** °F or °C for everyone, or `undefined` back to each browser's. */
	async set(unit: TemperatureUnit | undefined): Promise<Answer<HouseTemperature>> {
		const a = await setTemperatureUnit(unit === undefined ? null : unit === 'F' ? '°F' : '°C');
		if (a.ok) this.temperature = fromCore(a.data);
		return a;
	}
}

export const houseUnits = new HouseUnits();
