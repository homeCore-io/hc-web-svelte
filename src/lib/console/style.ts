/**
 * The console's own choices for each person (the console boards): how its
 * faders and switches are drawn, whether switches and timers sit as rows or
 * as tiles, and whether its sidebar is open or folded to the icon rail. Kept in the person's preferences, so they follow them to
 * every screen; the household can set the controls' style for anyone who
 * hasn't chosen.
 *
 * Read from documents anyone can write, so a value this app doesn't know is
 * treated as unset.
 */

import type { PillPrefs } from './cameras.js';
import type { TabChoices } from './room.js';

export type FaderStyle = 'machined' | 'glass' | 'lightbar';
export type SwitchStyle = 'precision' | 'keypad' | 'offon';
export type Sidebar = 'open' | 'folded';
/**
 * How switches and timers sit together: as rows, each switch with its
 * toggle and the timers' clocks below; or as tiles of one size, side by side.
 */
export type SetLook = 'rows' | 'tiles';

/** A person's console choices (`PersonDoc.console`). */
export interface ConsolePrefs {
	sidebar?: Sidebar;
	fader?: FaderStyle;
	switch?: SwitchStyle;
	switchesAs?: SetLook;
}

/** The household's defaults for the controls (`HouseDoc.console`). */
export interface ConsoleHouse {
	fader?: FaderStyle;
	switch?: SwitchStyle;
	/** Camera events as pills in a room's header and on Home (cameras.ts). */
	pills?: PillPrefs;
	/** The tab each device was put on in its room, by device id (room.ts). */
	tabs?: TabChoices;
}

export const FADER_STYLES: readonly { id: FaderStyle; name: string }[] = [
	{ id: 'machined', name: 'Machined' },
	{ id: 'glass', name: 'Glass pill' },
	{ id: 'lightbar', name: 'Light bar' }
];

export const SWITCH_STYLES: readonly { id: SwitchStyle; name: string }[] = [
	{ id: 'precision', name: 'Precision' },
	{ id: 'keypad', name: 'Keypad' },
	{ id: 'offon', name: 'Off · On' }
];

export const SET_LOOKS: readonly { id: SetLook; name: string }[] = [
	{ id: 'rows', name: 'Rows' },
	{ id: 'tiles', name: 'Tiles' }
];

const known = <T extends string>(all: readonly { id: T }[], v: unknown): T | undefined =>
	all.some((s) => s.id === v) ? (v as T) : undefined;

/** How faders are drawn: the person's choice, else the household's, else Machined. */
export const faderStyle = (mine?: ConsolePrefs, house?: ConsoleHouse): FaderStyle =>
	known(FADER_STYLES, mine?.fader) ?? known(FADER_STYLES, house?.fader) ?? 'machined';

/** How switches are drawn: the person's choice, else the household's, else Precision. */
export const switchStyle = (mine?: ConsolePrefs, house?: ConsoleHouse): SwitchStyle =>
	known(SWITCH_STYLES, mine?.switch) ?? known(SWITCH_STYLES, house?.switch) ?? 'precision';

/** How switches and timers sit together: the person's choice, else rows. */
export const switchesAs = (mine?: ConsolePrefs): SetLook =>
	known(SET_LOOKS, mine?.switchesAs) ?? 'rows';

/** Whether the sidebar is open or folded to its icons; open until the person folds it. */
export const sidebarOf = (mine?: ConsolePrefs): Sidebar =>
	mine?.sidebar === 'folded' ? 'folded' : 'open';

/**
 * A person's console choices with `patch` made: a choice set to `undefined`
 * goes back to the default and is taken out, and nothing left is no choices.
 */
export function withPrefs(
	mine: ConsolePrefs | undefined,
	patch: Partial<Record<keyof ConsolePrefs, string | undefined>>
): ConsolePrefs | undefined {
	const next: Record<string, string> = {};
	const all = { ...mine, ...patch };
	const sidebar = all.sidebar === 'open' || all.sidebar === 'folded' ? all.sidebar : undefined;
	const fader = known(FADER_STYLES, all.fader);
	const sw = known(SWITCH_STYLES, all.switch);
	const as = known(SET_LOOKS, all.switchesAs);
	if (sidebar) next.sidebar = sidebar;
	if (fader) next.fader = fader;
	if (sw) next.switch = sw;
	// Rows is the default, so it's kept as no choice.
	if (as === 'tiles') next.switchesAs = as;
	return Object.keys(next).length > 0 ? (next as ConsolePrefs) : undefined;
}

/** A preferences document with its console choices changed by `patch`. */
export function withConsole<D extends { console?: ConsolePrefs }>(
	doc: D,
	patch: Partial<Record<keyof ConsolePrefs, string | undefined>>
): D {
	const { console: was, ...rest } = doc;
	const next = withPrefs(was, patch);
	return (next ? { ...rest, console: next } : rest) as D;
}
