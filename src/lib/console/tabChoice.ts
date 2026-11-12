/**
 * Putting a device on a tab of its room, for the whole household
 * (`HouseDoc.console.tabs`, room.ts's `TabChoices`). For people who may
 * change the house's content; the picker comes later.
 */
import { household } from '../household.svelte.js';
import { withDeviceTab, type TabId } from './room.js';

/** Puts device `id` on `tab` in its room; `undefined` lets it go where it goes by itself. */
export function setDeviceTab(id: string, tab: TabId | undefined): Promise<void> {
	return household.change((d) => {
		const { console: was, ...rest } = d;
		const next = withDeviceTab(was, id, tab);
		return next ? { ...rest, console: next } : rest;
	});
}
