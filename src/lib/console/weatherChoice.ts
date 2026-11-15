/**
 * How much of the weather band this screen shows: three days or seven on
 * Home, and on the phone whether the next 24 hours and the week are open.
 * A choice for the screen, not the person, so it's kept in this browser
 * alone, as the room a screen opens on is (opensOn.ts).
 */
const KEY = 'hc-home-weather';

export type WeatherOpen = 'week' | 'phone';

/** Whether this screen keeps `what` open. */
export function weatherOpen(what: WeatherOpen): boolean {
	try {
		return (localStorage.getItem(KEY) ?? '').split(',').includes(what);
	} catch {
		return false;
	}
}

/** Keep `what` open on this screen, or not. */
export function setWeatherOpen(what: WeatherOpen, open: boolean): void {
	try {
		const kept = (localStorage.getItem(KEY) ?? '').split(',').filter((w) => w && w !== what);
		const next = open ? [...kept, what] : kept;
		if (next.length > 0) localStorage.setItem(KEY, next.join(','));
		else localStorage.removeItem(KEY);
	} catch {
		// Not kept; it opens as it always does.
	}
}
