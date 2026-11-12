/**
 * Everyone's pictures, as the app server hands them out (`/ui/avatars`):
 * read the first time someone else's picture is drawn, and again when the
 * app comes back to the front. A person's own comes from their own document,
 * so it changes as they choose.
 */
import type { AvatarChoice } from './avatar.js';

export interface AvatarEntry {
	id: string;
	username?: string;
	avatar: AvatarChoice;
	photo?: string;
}

class Avatars {
	people = $state<AvatarEntry[]>([]);
	#asked = false;

	/** Read them, once, when a picture first needs them. */
	want(): void {
		if (this.#asked || typeof window === 'undefined') return;
		this.#asked = true;
		void this.load();
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void this.load();
		});
	}

	async load(): Promise<void> {
		const res = await fetch('/ui/avatars').catch(() => null);
		if (!res?.ok) return;
		const body = (await res.json().catch(() => ({}))) as { people?: AvatarEntry[] };
		if (Array.isArray(body.people)) this.people = body.people;
	}

	/** A person's, by their id, else by the name history gives them. */
	of(id: string | undefined, name: string): AvatarEntry | undefined {
		const key = id?.toLowerCase();
		return key
			? this.people.find((p) => p.id === key)
			: this.people.find((p) => p.username === name);
	}
}

export const avatars = new Avatars();
