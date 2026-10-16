/**
 * What arrives from homeCore, and how the app's copy of the house follows it.
 *
 * Pure functions over plain data, so they are tested without a browser; the
 * runes stores (`rooms.svelte.ts`, later devices) hold the result.
 */
import { humanise } from './text.js';

/** A room as homeCore sends it (`GET /areas`, snapshots, `room_changed`). */
export interface CoreRoom {
	id: string;
	name: string;
	/** Absent from a homeCore before H1, whose `name` is the slug. */
	slug?: string;
	aliases?: string[];
	/** Who chose the name: a person, a plugin (`bridge`), or homeCore guessing from a slug. */
	named_by?: 'person' | 'bridge' | 'guessed';
	device_ids?: string[];
}

export interface Room {
	id: string;
	name: string;
	slug: string;
	aliases: string[];
	namedBy?: 'person' | 'bridge' | 'guessed';
	deviceIds: string[];
}

/** One frame from the event stream; only the fields the app reads. */
export type Frame =
	| { type: 'snapshot'; rooms?: CoreRoom[] }
	| { type: 'room_changed'; room: CoreRoom }
	| { type: 'room_removed'; room_id: string; merged_into?: string }
	| { type: string };

export function roomFromCore(r: CoreRoom): Room {
	// A homeCore before H1 kept only the slug, in `name`; it is the best there is.
	const typed = r.slug !== undefined;
	return {
		id: r.id,
		name: typed ? r.name : humanise(r.name),
		slug: r.slug ?? r.name,
		aliases: r.aliases ?? [],
		...(r.named_by ? { namedBy: r.named_by } : {}),
		deviceIds: r.device_ids ?? []
	};
}

export function sortRooms(rooms: Room[]): Room[] {
	return [...rooms].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * The rooms after a frame, or `undefined` if the frame says nothing about
 * rooms — so a caller can tell "no change" from "now there are none".
 */
export function roomsAfter(rooms: Room[], frame: Frame): Room[] | undefined {
	switch (frame.type) {
		case 'snapshot': {
			const f = frame as Extract<Frame, { type: 'snapshot' }>;
			return f.rooms === undefined ? undefined : sortRooms(f.rooms.map(roomFromCore));
		}
		case 'room_changed': {
			const room = roomFromCore((frame as Extract<Frame, { type: 'room_changed' }>).room);
			return sortRooms([...rooms.filter((r) => r.id !== room.id), room]);
		}
		case 'room_removed': {
			const { room_id } = frame as Extract<Frame, { type: 'room_removed' }>;
			return rooms.filter((r) => r.id !== room_id);
		}
		default:
			return undefined;
	}
}
