/**
 * Where the app can go (02 — N2, N3).
 *
 * The phone bar's default is Home · Pages · Scenes · More; it becomes
 * configurable in R4/R5. The desktop sidebar has room for Alerts and the
 * rooms themselves.
 */
import type { Component } from 'svelte';
import House from '@lucide/svelte/icons/house';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Bell from '@lucide/svelte/icons/bell';
import Menu from '@lucide/svelte/icons/menu';

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
		'/me': 'Me'
	};
	return known[pathname] ?? 'homeCore';
}
