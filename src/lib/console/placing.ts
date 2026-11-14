/**
 * Where a device shows in the console, as the "⋯" picker (the Garage
 * board) and a device's page in Settings show it: the tab it lands on by
 * itself, the tab it's on now, and what choosing a tab saves.
 *
 * Pure: Placer.svelte and the Settings page draw what this decides.
 */
import type { CoreDevice } from '../devices.js';
import { consoleRoom, LIGHTS_WIDTH, TABS, type TabChoices, type TabId } from './room.js';

/** Under each tab's chip in the picker: what the tab is for. */
export const TAB_HINTS: Record<TabId, string> = {
	doors: 'locks, openers',
	lights: 'faders, scenes',
	switches: 'toggles, buttons',
	timers: 'clocks',
	media: 'players',
	climate: 'thermostats, fans',
	water: 'leaks, valves',
	sensors: 'readings',
	cameras: 'cameras, sirens'
};

/** The tab a device in `list` is on, as consoleRoom sorts it with `chosen`; none for a hub. */
export function tabIn(
	list: CoreDevice[],
	id: string,
	chosen: TabChoices = {},
	width = LIGHTS_WIDTH
): TabId | undefined {
	const room = consoleRoom(list, width, chosen);
	return TABS.find((t) => room.byTab[t.id].some((d) => d.device_id === id))?.id;
}

/** The tab a device would land on by itself: where it sorts with no choice for it. */
export function ownTab(
	list: CoreDevice[],
	id: string,
	chosen: TabChoices = {},
	width = LIGHTS_WIDTH
): TabId | undefined {
	const { [id]: _, ...rest } = chosen;
	return tabIn(list, id, rest, width);
}

/**
 * What choosing `tab` saves: the tab, or nothing when it's where the
 * device lands by itself, so it follows the sorting from then on.
 */
export const choiceFor = (tab: TabId | undefined, own: TabId | undefined): TabId | undefined =>
	tab === own ? undefined : tab;

/** A box on screen, in pixels. */
export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Where a popover `size` big goes by the button that opened it: under it,
 * its right edge at the button's, else above it when there's more room
 * there; always `margin` inside the window.
 */
export function popoverAt(
	anchor: Box,
	size: { width: number; height: number },
	view: { width: number; height: number },
	margin = 8
): { left: number; top: number } {
	const gap = 6;
	const below = view.height - (anchor.top + anchor.height) - gap - margin;
	const above = anchor.top - gap - margin;
	let top =
		size.height <= below || below >= above
			? anchor.top + anchor.height + gap
			: anchor.top - gap - size.height;
	let left = anchor.left + anchor.width - size.width;
	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
	left = clamp(left, margin, view.width - size.width - margin);
	top = clamp(top, margin, view.height - size.height - margin);
	return { left: Math.round(left), top: Math.round(top) };
}
