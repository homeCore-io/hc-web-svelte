/**
 * The household's shared edits and presentation settings (D6, M1): its
 * changes to the generated home and rooms, room icons, the default phone bar,
 * the house's theme and confirmation overrides. Everyone reads it; people who
 * may author the house's content (`content:write`) change it.
 */
import { migrate, type Change, type HouseDoc, type Photo } from './layers.js';
import { isLibrary } from './pictures.svelte.js';
import { pageChanges } from './look.svelte.js';
import { Synced } from './synced.svelte.js';

class Household extends Synced<HouseDoc> {
	constructor() {
		super('/ui/house', 'house', migrate);
	}

	changes(page: string): Change[] {
		return pageChanges(this.doc.pages, page);
	}

	iconOf(room: string): string | undefined {
		return this.doc.icons?.[room];
	}

	/** A room's photo (design 15), if it has one from the library. */
	photoOf(room: string): (Photo & { src: string }) | undefined {
		const p = this.doc.photos?.[room];
		return p && isLibrary(p.src) ? { ...p, src: p.src } : undefined;
	}
}

export const household = new Household();
