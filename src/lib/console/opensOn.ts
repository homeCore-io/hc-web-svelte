/**
 * Which room this screen opens on, instead of Home: a wall panel in the
 * kitchen can open on the Kitchen. A choice for the screen, not the person,
 * so it's kept in this browser alone.
 *
 * Home moves to the room only when the app was opened at Home, and only the
 * first time: "Whole home" still shows Home after that.
 */
const KEY = 'hc-console-opens-on';

/** The room this screen opens on, if one was chosen. */
export function opensOn(): string | undefined {
	try {
		return localStorage.getItem(KEY) ?? undefined;
	} catch {
		return undefined;
	}
}

/** Choose the room this screen opens on; `undefined` for Home. */
export function setOpensOn(room: string | undefined): void {
	try {
		if (room) localStorage.setItem(KEY, room);
		else localStorage.removeItem(KEY);
	} catch {
		// Not kept; Home it is.
	}
}

let asked = false;

/**
 * The room to open on now: once, when the app was opened at Home. Asked by
 * Home as it first shows.
 */
export function openingRoom(): string | undefined {
	if (asked) return undefined;
	asked = true;
	try {
		const entry = performance.getEntriesByType('navigation')[0];
		if (!entry || new URL(entry.name).pathname !== '/') return undefined;
	} catch {
		return undefined;
	}
	return opensOn();
}
