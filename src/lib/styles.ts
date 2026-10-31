/**
 * Home's styles (G3, G11): not pages of their own, but what they write — the
 * Rooms section's layout, whether the big numbers show, and whether the
 * sidebar lists rooms with their status. A person can start from a style and
 * still move things; the picker reads the style back from the same changes.
 */
import type { Change } from './layers.js';

export type Style = 'list' | 'field' | 'tiles' | 'side';
export type ShellRooms = 'names' | 'status';

export const STYLES: { id: Style; name: string; sub: string }[] = [
	{ id: 'list', name: 'Room list', sub: 'Each room on one line, as Home began' },
	{ id: 'field', name: 'Room field', sub: 'Boxes sized by what’s in each room' },
	{ id: 'tiles', name: 'Room tiles', sub: 'Every room the same size' },
	{
		id: 'side',
		name: 'Rooms in the sidebar',
		sub: 'Room status in the side list; Home keeps the rest'
	}
];

/** The style a Home reads as: its rooms' layout, and the sidebar's rooms. */
export function styleOf(layout: string, rooms: ShellRooms): Style {
	if (rooms === 'status') return 'side';
	return layout === 'field' || layout === 'tiles' ? layout : 'list';
}

/** What choosing a style writes: changes to Home, and the sidebar's rooms. */
export function styleChanges(style: Style): { changes: Change[]; rooms: ShellRooms } {
	const layout = style === 'field' || style === 'tiles' ? style : 'list';
	return {
		changes: [
			{ op: 'config', ref: 'section:rooms', config: { layout } },
			{ op: style === 'list' ? 'hide' : 'show', ref: 'section:summary' }
		],
		rooms: style === 'side' ? 'status' : 'names'
	};
}

/** The sidebar's rooms: the person's choice, else the household's, else names. */
export const shellRooms = (
	mine: { shell?: { rooms?: ShellRooms } } | undefined,
	house: { shell?: { rooms?: ShellRooms } } | undefined
): ShellRooms => mine?.shell?.rooms ?? house?.shell?.rooms ?? 'names';
