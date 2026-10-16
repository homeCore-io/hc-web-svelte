/**
 * homeCore's own scenes. Plugin scenes (Caseta, Hue, Lutron) are devices and
 * come with the devices; both look and behave the same in the app (D10).
 *
 * From the snapshot and `scene_changed` / `scene_removed` (H2), with a REST
 * load for a homeCore from before H2.
 */
import { live } from './live.svelte.js';

export interface CoreScene {
	id: string;
	name: string;
	/** Device id → what to set it to: attributes, or `{ actions: [...] }`. */
	states?: Record<string, unknown>;
}

class Scenes {
	list = $state<CoreScene[]>([]);
	#unfollow: (() => void) | null = null;
	#streamed = false;

	async load(): Promise<void> {
		this.#follow();
		try {
			const res = await fetch('/api/v1/scenes');
			const list = res.ok ? ((await res.json()) as CoreScene[]) : undefined;
			if (list !== undefined && !this.#streamed) this.list = sorted(list);
		} catch {
			// No scenes shown; devices' scenes still are.
		}
	}

	async run(id: string): Promise<boolean> {
		try {
			const res = await fetch(`/api/v1/scenes/${encodeURIComponent(id)}/activate`, {
				method: 'POST'
			});
			return res.ok;
		} catch {
			return false;
		}
	}

	#follow(): void {
		this.#unfollow ??= live.listen((frame) => {
			const f = frame as {
				type: string;
				scenes?: CoreScene[];
				scene?: CoreScene;
				scene_id?: string;
			};
			if (f.type === 'snapshot' && f.scenes !== undefined) {
				this.#streamed = true;
				this.list = sorted(f.scenes);
			} else if (f.type === 'scene_changed' && f.scene) {
				this.list = sorted([...this.list.filter((s) => s.id !== f.scene!.id), f.scene]);
			} else if (f.type === 'scene_removed') {
				this.list = this.list.filter((s) => s.id !== f.scene_id);
			}
		});
	}
}

function sorted(list: CoreScene[]): CoreScene[] {
	return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export const scenes = new Scenes();
