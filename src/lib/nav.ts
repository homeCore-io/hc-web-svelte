/**
 * Where the app can go (02 — N2, N3).
 *
 * The phone bar's default is Home · Pages · Scenes · More, and each person
 * may choose their own (N2, `barFor`). The desktop sidebar has room for
 * Alerts and the rooms themselves.
 */
import type { Component } from 'svelte';
import House from '@lucide/svelte/icons/house';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Bell from '@lucide/svelte/icons/bell';
import Menu from '@lucide/svelte/icons/menu';
import Search from '@lucide/svelte/icons/search';
import DoorOpen from '@lucide/svelte/icons/door-open';

export interface Destination {
	id: string;
	label: string;
	href: string;
	icon: Component;
}

export const HOME: Destination = { id: 'home', label: 'Home', href: '/', icon: House };
export const PAGES: Destination = { id: 'pages', label: 'Pages', href: '/pages', icon: LayoutGrid };
export const SCENES: Destination = {
	id: 'scenes',
	label: 'Scenes',
	href: '/scenes',
	icon: Sparkles
};
export const ALERTS: Destination = { id: 'alerts', label: 'Alerts', href: '/alerts', icon: Bell };
export const MORE: Destination = { id: 'more', label: 'More', href: '/more', icon: Menu };

export const SEARCH: Destination = { id: 'search', label: 'Search', href: '#search', icon: Search };

const BY_ID: Record<string, Destination> = {
	home: HOME,
	pages: PAGES,
	scenes: SCENES,
	alerts: ALERTS,
	search: SEARCH
};

/**
 * A person's phone bar (N2) from their choices — destinations by id, or
 * `room:{id}` for a room — with More always last.
 */
export function barFor(choices: string[], rooms: { id: string; name: string }[]): Destination[] {
	const out: Destination[] = [];
	for (const c of choices) {
		if (c.startsWith('room:')) {
			const room = rooms.find((r) => r.id === c.slice(5));
			if (room) out.push({ id: c, label: room.name, href: `/rooms/${room.id}`, icon: DoorOpen });
		} else if (BY_ID[c]) out.push(BY_ID[c]);
	}
	return [...out, MORE];
}

/** The phone bar, by default (N2). */
export const PHONE_BAR = [HOME, PAGES, SCENES, MORE];
/** The sidebar's destinations, above the rooms (N3). */
export const SIDEBAR = [HOME, PAGES, SCENES, ALERTS];

/** Whether `pathname` is at or under `href`. */
export function isAt(pathname: string, href: string): boolean {
	return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** The page's title for the header. */
export function titleFor(pathname: string): string {
	const known: Record<string, string> = {
		'/': 'Home',
		'/pages': 'Pages',
		'/scenes': 'Scenes',
		'/alerts': 'Alerts',
		'/more': 'More',
		'/settings': 'Settings',
		'/settings/rooms': 'Rooms',
		'/settings/devices': 'Devices',
		'/settings/asking': 'Asking first',
		'/settings/look': 'Look',
		'/me': 'Me'
	};
	return known[pathname] ?? 'homeCore';
}

/**
 * The layered page at `pathname` — `home`, `room:{id}` — or null where
 * there is nothing to arrange.
 */
export function pageKey(pathname: string): string | null {
	if (pathname === '/') return 'home';
	const room = /^\/rooms\/([^/]+)$/.exec(pathname);
	return room ? `room:${decodeURIComponent(room[1]!)}` : null;
}

/** The same address with Edit mode on or off (N5). */
export function withEdit(url: { href: string }, on: boolean): string {
	const next = new URL(url.href);
	if (on) next.searchParams.set('edit', '1');
	else next.searchParams.delete('edit');
	return `${next.pathname}${next.search}${next.hash}`;
}
