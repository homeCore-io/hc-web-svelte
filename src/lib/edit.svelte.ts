/**
 * Edit mode (N6): changing the household's page, which everyone sees. Only
 * for people who may author the house's content (`content:write`).
 *
 * The edits are kept here as a list until Done, so Undo takes the last one
 * back and Cancel drops them all. Done saves them as one change to the
 * household's document — made again on top of it if someone else saved
 * meanwhile (`Synced`). The mode is in the address (`?edit`, N5).
 */
import { addChange, type Change, type HouseDoc } from './layers.js';
import { household } from './household.svelte.js';
import type { Edit } from './synced.svelte.js';

class Editing {
	/** The page being edited — `home`, `room:{id}` — or none. */
	page = $state<string | null>(null);
	#edits = $state<Edit<HouseDoc>[]>([]);
	/** What the page names that it still has, so changes to gone things can be shown (M2). */
	present = $state<Set<string>>(new Set());

	/** The household's document with this session's edits on top. */
	draft = $derived(this.#edits.reduce((d, e) => e(d), household.doc));

	on(page: string): boolean {
		return this.page === page;
	}

	get count(): number {
		return this.#edits.length;
	}

	start(page: string): void {
		this.page = page;
		this.#edits = [];
	}

	changes(page: string): Change[] {
		return this.draft.pages?.[page] ?? [];
	}

	changePage(page: string, change: Change): void {
		this.#edits = [
			...this.#edits,
			(d) => ({ ...d, pages: { ...d.pages, [page]: addChange(d.pages?.[page], change) } })
		];
	}

	/** A change to the household's document beyond its pages: every-room settings, the sidebar (G15). */
	changeDoc(edit: Edit<HouseDoc>): void {
		this.#edits = [...this.#edits, edit];
	}

	/** Drop the changes that name things the page no longer has. */
	forget(page: string, stale: Change[]): void {
		this.#edits = [
			...this.#edits,
			(d) => ({
				...d,
				pages: { ...d.pages, [page]: (d.pages?.[page] ?? []).filter((c) => !stale.includes(c)) }
			})
		];
	}

	/** Every household change to this page, gone — back to the generated page. */
	reset(page: string): void {
		this.#edits = [
			...this.#edits,
			(d) => {
				const pages = { ...d.pages };
				delete pages[page];
				return { ...d, pages };
			}
		];
	}

	undo(): void {
		this.#edits = this.#edits.slice(0, -1);
	}

	/** Leave without saving. */
	cancel(): void {
		this.page = null;
		this.#edits = [];
	}

	/** Save the session's edits as one change, and leave. */
	done(): Promise<void> {
		const edits = this.#edits;
		this.page = null;
		this.#edits = [];
		if (edits.length === 0) return Promise.resolve();
		return household.change((d) => edits.reduce((x, e) => e(x), d));
	}
}

export const editing = new Editing();

/** The question before edits to the shared page are dropped by leaving. */
export const LEAVE = {
	title: 'Leave without saving?',
	body: 'Your changes to the shared page haven’t been saved.',
	go: 'Leave',
	stay: 'Keep editing',
	danger: true
};
