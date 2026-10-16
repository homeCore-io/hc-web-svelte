/**
 * This person's own layers and preferences (M2–M4, N2, V2), kept on the UI
 * server so they follow the person from phone to laptop — and nobody else
 * sees them. Saving and keeping in step are `Synced`'s.
 */
import { addChange, type Change, type PersonDoc } from './layers.js';
import { Synced } from './synced.svelte.js';

class Personal extends Synced<PersonDoc> {
	constructor() {
		super('/ui/prefs', 'person');
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

	isFavourite(ref: string): boolean {
		return this.doc.favourites?.includes(ref) ?? false;
	}
}

export const personal = new Personal();
