/**
 * Light or dark (V2): the device decides unless the person has.
 *
 * Kept in this browser for now; it moves to the person's preferences on the
 * UI server in R4, so it follows them between devices.
 */
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

	set(choice: ThemeChoice): void {
		this.choice = choice;
		try {
			if (choice === 'system') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, choice);
		} catch {
			// Private browsing: the choice lasts this visit.
		}
		const root = document.documentElement;
		if (choice === 'system') delete root.dataset.theme;
		else root.dataset.theme = choice;
	}
}

export const theme = new Theme();
