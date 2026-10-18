/**
 * Displays (D7, N9): a kitchen panel or hall tablet, its own identity in
 * homeCore (H3), showing the pages an admin chose and nothing else.
 *
 * Its settings are a document on the UI server, keyed by the display's id.
 * Pages are named as the phone bar names places: `home`, `room:{id}`,
 * `scenes`, `alerts`.
 */

export interface Kiosk {
	/** Keep the screen on. Default yes. */
	awake?: boolean;
	/** Dark while the house's Night Mode is on, light otherwise. */
	night?: boolean;
	/** Reload every day at this time, `HH:MM` — picks up a new version. */
	reload?: string | null;
}

export interface DisplayDoc {
	version: number;
	/** The pages it shows, in order; the first is its home. */
	pages?: string[];
	kiosk?: Kiosk;
}

export interface Tab {
	key: string;
	label: string;
	href: string;
}

/** What a display may show, in order: what the admin chose that still exists, else Home. */
export function tabsFor(doc: DisplayDoc | undefined, rooms: { id: string; name: string }[]): Tab[] {
	const out: Tab[] = [];
	for (const key of doc?.pages ?? []) {
		if (out.some((t) => t.key === key)) continue;
		if (key === 'home') out.push({ key, label: 'Home', href: '/' });
		else if (key === 'scenes') out.push({ key, label: 'Scenes', href: '/scenes' });
		else if (key === 'alerts') out.push({ key, label: 'Alerts', href: '/alerts' });
		else if (key.startsWith('room:')) {
			const room = rooms.find((r) => r.id === key.slice(5));
			if (room) out.push({ key, label: room.name, href: `/rooms/${room.id}` });
		}
	}
	return out.length > 0 ? out : [{ key: 'home', label: 'Home', href: '/' }];
}

/**
 * Whether a display may be at `pathname`. Its own pages only — and a room
 * reached from its Home, when Home is one of them, since Home's rooms open.
 * Device details ride on the address's query, so any page allowed allows
 * them.
 */
export function allowedOn(tabs: Tab[], pathname: string): boolean {
	if (tabs.some((t) => t.href === pathname)) return true;
	// What needs attention is always one tap away, from the bell.
	if (pathname === '/alerts') return true;
	return pathname.startsWith('/rooms/') && tabs.some((t) => t.key === 'home');
}

/** The tab `by` places from the one at `pathname`, for a swipe; none past either end. */
export function nextTab(tabs: Tab[], pathname: string, by: -1 | 1): Tab | undefined {
	const at = tabs.findIndex((t) => t.href === pathname);
	if (at < 0) return undefined;
	return tabs[at + by];
}

/** Whether it is time for the daily reload: `HH:MM` now, local. */
export function reloadDue(reload: string | null | undefined, now: Date): boolean {
	if (!reload) return false;
	const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	return hhmm === reload;
}
