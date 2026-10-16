/**
 * What a page shows, and where a change made on it goes (04 §3, N6).
 *
 * - Normally, and in Customise: the household's changes, then this person's.
 *   A change made in Customise is the person's alone.
 * - In Edit: the household's changes with this session's edits, and none of
 *   the person's — the page as everyone will see it.
 */
import { layered, type Change } from './layers.js';
import { household } from './household.svelte.js';
import { personal } from './personal.svelte.js';
import { customise } from './customise.svelte.js';
import { editing } from './edit.svelte.js';

export type Mode = 'edit' | 'customise' | null;

export const view = {
	mode(page: string): Mode {
		return editing.on(page) ? 'edit' : customise.on(page) ? 'customise' : null;
	},

	changes(page: string): Change[] {
		return editing.on(page)
			? editing.changes(page)
			: layered(household.changes(page), personal.changes(page));
	},

	change(page: string, change: Change): void {
		if (editing.on(page)) editing.changePage(page, change);
		else void personal.changePage(page, change);
	}
};
