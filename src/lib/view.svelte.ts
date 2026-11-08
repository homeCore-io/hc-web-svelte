/**
 * What a page shows, and where a change made on it goes (04 §3, N6).
 *
 * - Normally, and in Customise: the household's changes, then this person's.
 *   A change made in Customise is the person's alone.
 * - In Edit: the household's changes with this session's edits, and none of
 *   the person's — the page as everyone will see it.
 */
import { added, layered, type Change } from './layers.js';
import { household } from './household.svelte.js';
import { personal } from './personal.svelte.js';
import { customise } from './customise.svelte.js';
import { editing } from './edit.svelte.js';
import { look } from './look.svelte.js';
import { homeChanges } from './looks/home.js';

export type Mode = 'edit' | 'customise' | null;

export const view = {
	mode(page: string): Mode {
		return editing.on(page) ? 'edit' : customise.on(page) ? 'customise' : null;
	},

	changes(page: string): Change[] {
		// Home starts as the look groups it (13 §8.3); arranging goes on from there.
		const base = page === 'home' ? homeChanges(look.def.grouping.home) : [];
		return [
			...base,
			...(editing.on(page)
				? editing.changes(page)
				: layered(household.changes(page), personal.changes(page)))
		];
	},

	/**
	 * What was added to the page and is still on it: the household's, then the
	 * person's own — each list read on its own, so taking one's own card off
	 * never takes the household's away (G18). In Edit, the household's alone.
	 */
	added(page: string): string[] {
		if (editing.on(page)) return added(editing.changes(page));
		return [...new Set([...added(household.changes(page)), ...added(personal.changes(page))])];
	},

	/** Whether this screen's layer added it, so may take it off (G18). */
	addedHere(page: string, ref: string): boolean {
		return added(editing.on(page) ? editing.changes(page) : personal.changes(page)).includes(ref);
	},

	change(page: string, change: Change): void {
		this.changeAll(page, [change]);
	},

	/** Several changes as one save: every card's place, when a page is first arranged (14 §4). */
	changeAll(page: string, changes: Change[]): void {
		if (changes.length === 0) return;
		if (editing.on(page)) editing.changePage(page, ...changes);
		else void personal.changePage(page, ...changes);
	}
};
