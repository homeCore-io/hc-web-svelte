/**
 * Light or dark (V2): the device decides unless the person has.
 *
 * The person's choice lives in their preferences on the UI server, so it
 * follows them between devices. This browser keeps a copy, because the page
 * has to be the right colour before anything has loaded (`app.html`).
 */
import { personal } from './personal.svelte.js';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'hc.theme';

function read(): ThemeChoice {
	try {
		const t = localStorage.getItem(KEY);
		return t === 'light' || t === 'dark' ? t : 'system';
	} catch {
		return 'system';
	}
}

class Theme {
	choice = $state<ThemeChoice>(typeof localStorage === 'undefined' ? 'system' : read());

	/** The person chose: show it, remember it here, and save it for them. */
	set(choice: ThemeChoice): void {
		this.show(choice);
		void personal.change((d) => ({ ...d, theme: choice }));
	}

	/**
	 * Their saved choice arrived. One made in this browser before choices were
	 * saved for people is kept, and saved now, rather than lost.
	 */
	adopt(saved: ThemeChoice | undefined): void {
		if (saved === undefined) {
			if (this.choice !== 'system') this.set(this.choice);
			return;
		}
		this.show(saved);
	}

	show(choice: ThemeChoice): void {
		this.choice = choice;
		try {
			if (choice === 'system') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, choice);
		} catch {
			// Private browsing: the copy lasts this visit.
		}
		const root = document.documentElement;
		if (choice === 'system') delete root.dataset.theme;
		else root.dataset.theme = choice;
	}
}

export const theme = new Theme();
