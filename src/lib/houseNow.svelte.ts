/**
 * The house as every look counts it now, kept once for every page: its
 * lights (lights.ts, `houseLights`), so Home's chips, a room's box, the
 * sidebar and a Lit room's header count the same lights the console does.
 *
 * What knows a room's drawing (pictures.ts) loads after Home's own code, so
 * Home stays within its budget; until it has (before the house has loaded,
 * as a rule), `lightIds` is missing and a box counts its lights by kind.
 */
import { devices } from './devices.svelte.js';
import { rooms } from './rooms.svelte.js';
import { household } from './household.svelte.js';

type Counting = typeof import('./houseLights.js');

class HouseNow {
	#counting = $state<Counting | undefined>(undefined);
	#loading: Promise<void> | undefined;

	#load(): Counting | undefined {
		this.#loading ??= import('./houseLights.js').then((m) => {
			this.#counting = m;
		});
		return this.#counting;
	}

	/** Every room's lights, then those in no room; missing while loading. */
	lights = $derived.by(() => {
		const m = this.#load();
		return m?.houseLightsNow(devices.byId, rooms.list, household.doc.console);
	});
	/** The ids of every light in the house; missing while loading. */
	lightIds: ReadonlySet<string> | undefined = $derived(
		this.lights && new Set(this.lights.flatMap((g) => g.lights.map((d) => d.device_id)))
	);
}

export const houseNow = new HouseNow();
