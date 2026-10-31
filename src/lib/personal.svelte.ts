/**
 * This person's own layers and preferences (M2–M4, N2, V2), kept on the UI
 * server so they follow the person from phone to laptop — and nobody else
 * sees them. Saving and keeping in step are `Synced`'s.
 */
import { addChange, migrate, type Change, type PersonDoc } from './layers.js';
import { Synced } from './synced.svelte.js';
import { followUnits, unitsOf, type UnitsChoice } from './units.js';

class Personal extends Synced<PersonDoc> {
	constructor() {
		super('/ui/prefs', 'person', migrate);
	}

	changes(page: string): Change[] {
		return this.doc.pages?.[page] ?? [];
	}

	changePage(page: string, change: Change): Promise<void> {
		return this.change((d) => ({
			...d,
			pages: { ...d.pages, [page]: addChange(d.pages?.[page], change) }
		}));
	}

	/** "Reset to shared": this page back to how everyone else sees it. */
	resetPage(page: string): Promise<void> {
		return this.change((d) => {
			const pages = { ...d.pages };
			delete pages[page];
			return { ...d, pages };
		});
	}

	/** °F or °C, or US measures or metric; `undefined` back to the browser's. */
	setUnits(choice: UnitsChoice): Promise<void> {
		return this.change((d) => {
			const next = { ...d.units, ...choice };
			for (const k of Object.keys(next) as (keyof UnitsChoice)[])
				if (next[k] === undefined) delete next[k];
			const { units: _drop, ...rest } = d;
			return Object.keys(next).length > 0 ? { ...rest, units: next } : rest;
		});
	}

	isFavourite(ref: string): boolean {
		return this.doc.favourites?.includes(ref) ?? false;
	}
}

export const personal = new Personal();

// Every reading shown reads the person's units from here — and, read inside
// a component, changes with their choice.
followUnits(() => unitsOf(personal.doc.units));
