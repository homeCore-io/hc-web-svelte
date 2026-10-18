/**
 * Which homeCore this is, for the parts of the app that need a newer one:
 * read once from `/health` (public) and kept. Until it answers, nothing new
 * is offered — an older homeCore would only refuse it.
 */
import { compareVersions } from './plugins.js';

class Core {
	#version = $state<string | null>(null);
	#asked = false;

	/** The version, once it's known. Reading it asks, the first time. */
	get version(): string | null {
		this.load();
		return this.#version;
	}

	/** Read the version, once. */
	load(): void {
		if (this.#asked) return;
		this.#asked = true;
		void fetch('/api/v1/health')
			.then((r) => r.json())
			.then((h: { version?: string }) => {
				this.#version = h.version ?? null;
			})
			.catch(() => {
				this.#asked = false;
			});
	}

	/** Whether this homeCore is `min` or newer. Asks, the first time. */
	since(min: string): boolean {
		const v = this.version;
		return v !== null && compareVersions(v, min) >= 0;
	}
}

export const core = new Core();
