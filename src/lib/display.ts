/**
 * Displays (D7, N9): a kitchen panel or hall tablet, its own identity in
 * homeCore (H3), showing the pages an admin chose and nothing else.
 *
 * Its settings are a document on the UI server, keyed by the display's id.
 * Pages are named as the phone bar names places: `home`, `room:{id}`,
 * `scenes`, `alerts` — and `page:{id}` for one of the house's own pages
 * (G31); never a person's, as a display isn't a person.
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
	/** Its own look (13 §10); absent, the house's. */
	look?: string;
	/** What it shows when nobody's touched it for a while (design 15). */
	rest?: Rest;
}

/**
 * A display at rest (design 15): after `after` minutes untouched, a picture
 * frame from an album of the household’s (`album`, none for all of them), a
 * clock, or dark. A touch wakes it to its page.
 */
export interface Rest {
	show?: 'frame' | 'clock' | 'dark';
	/** Minutes untouched before it rests; 0 or absent, never. */
	after?: number;
	album?: string;
	/** Seconds each picture shows. */
	every?: number;
	/** The time over the frame. */
	time?: boolean;
}

/** Its rest with what's unsaid filled in. */
export function restOf(doc: DisplayDoc | undefined): Required<Rest> {
	const r = doc?.rest ?? {};
	return {
		show: r.show ?? 'frame',
		after: r.after ?? 0,
		album: r.album ?? '',
		every: r.every ?? 30,
		time: r.time ?? true
	};
}

export interface Tab {
	key: string;
	label: string;
	href: string;
}

/** What a display may show, in order: what the admin chose that still exists, else Home. */
export function tabsFor(
	doc: DisplayDoc | undefined,
	rooms: { id: string; name: string }[],
	/** The house's own pages. */
	pages: { id: string; name: string }[] = []
): Tab[] {
	const out: Tab[] = [];
	for (const key of doc?.pages ?? []) {
		if (out.some((t) => t.key === key)) continue;
		if (key === 'home') out.push({ key, label: 'Home', href: '/' });
		else if (key === 'scenes') out.push({ key, label: 'Scenes', href: '/scenes' });
		else if (key === 'alerts') out.push({ key, label: 'Alerts', href: '/alerts' });
		else if (key.startsWith('room:')) {
			const room = rooms.find((r) => r.id === key.slice(5));
			if (room) out.push({ key, label: room.name, href: `/rooms/${room.id}` });
		} else if (key.startsWith('page:')) {
			const page = pages.find((p) => p.id === key.slice(5));
			if (page) out.push({ key, label: page.name, href: `/pages/${page.id}` });
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
