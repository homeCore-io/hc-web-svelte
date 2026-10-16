/**
 * The house's rooms, for navigation. R0 lists them; R2 builds pages from them.
 *
 * Kept current from the event stream (H2): the snapshot sent on connect, then
 * `room_changed` and `room_removed`, so a room renamed on one screen is
 * renamed on every other without a reload. A homeCore from before H2 sends
 * neither, so the list is also loaded once over REST — and ignored if a
 * snapshot got there first, since an event after the snapshot may already
 * have changed what the REST answer describes.
 */
import { roomFromCore, roomsAfter, sortRooms, type CoreRoom, type Room } from './house.js';
import { live } from './live.svelte.js';

export type { Room } from './house.js';

class Rooms {
	list = $state<Room[]>([]);
	#unfollow: (() => void) | null = null;
	#streamed = false;

	async load(): Promise<void> {
		this.#follow();
		try {
			const res = await fetch('/api/v1/areas');
			const areas = res.ok ? ((await res.json()) as CoreRoom[]) : undefined;
			if (areas === undefined || this.#streamed) return;
			this.list = sortRooms(areas.map(roomFromCore));
		} catch {
			// The sidebar shows no rooms; nothing else depends on them yet.
		}
	}

	#follow(): void {
		this.#unfollow ??= live.listen((frame) => {
			const next = roomsAfter(this.list, frame);
			if (next === undefined) return;
			if (frame.type === 'snapshot') this.#streamed = true;
			this.list = next;
		});
	}
}

export const rooms = new Rooms();
