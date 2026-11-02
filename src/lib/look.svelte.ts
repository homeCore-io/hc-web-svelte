/**
 * The look this screen shows (12): Classic or Lit, the person's own, else the
 * house's. It is on the page as `data-look`, and this browser keeps a copy so
 * the first paint is drawn in it before anything has loaded (`app.html`).
 */
import type { LookId } from './layers.js';

const KEY = 'hc.look';

function read(): LookId {
	try {
		return localStorage.getItem(KEY) === 'lit' ? 'lit' : 'classic';
	} catch {
		return 'classic';
	}
}

class Look {
	current = $state<LookId>(typeof localStorage === 'undefined' ? 'classic' : read());

	get lit(): boolean {
		return this.current === 'lit';
	}

	/** Show a look: remember it here, and mark the page. */
	show(id: LookId): void {
		this.current = id;
		try {
			if (id === 'classic') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, id);
		} catch {
			// Private browsing: the copy lasts this visit.
		}
		const root = document.documentElement;
		if (id === 'classic') delete root.dataset.look;
		else root.dataset.look = id;
	}
}

export const look = new Look();
