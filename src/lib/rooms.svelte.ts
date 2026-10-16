/**
 * The house's rooms, for navigation. R0 lists them; R2 builds pages from them.
 */
import { humanise } from './text.js';

export interface Room {
	id: string;
	name: string;
}

class Rooms {
	list = $state<Room[]>([]);

	async load(): Promise<void> {
		try {
			const res = await fetch('/api/v1/areas');
			if (!res.ok) return;
			const areas = (await res.json()) as { id: string; name: string }[];
			this.list = areas
				.map((a) => ({ id: a.id, name: humanise(a.name) }))
				.sort((a, b) => a.name.localeCompare(b.name));
		} catch {
			// The sidebar shows no rooms; nothing else depends on them yet.
		}
	}
}

export const rooms = new Rooms();
