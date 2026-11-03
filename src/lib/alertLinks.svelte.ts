/**
 * Which automations alerts start (`GET /alerts/automations`), read while a
 * screen that shows it is open and again when a rule, an alert rule or an
 * ignore changes. `known` is false on a homeCore without it, and the screens
 * then offer no "Do something…".
 */
import type { AutomationAlerts } from './alertStarts.js';
import { live } from './live.svelte.js';

class AlertLinks {
	list = $state<AutomationAlerts[]>([]);
	known = $state(false);
	#unfollow: (() => void) | null = null;
	#timer: ReturnType<typeof setTimeout> | null = null;

	async load(): Promise<void> {
		this.#unfollow ??= live.listen((frame) => {
			const t = (frame as { type: string }).type;
			if (t === 'rule_changed' || t === 'rule_removed') this.soon();
		});
		try {
			const r = await fetch('/api/v1/alerts/automations');
			if (!r.ok) {
				this.known = false;
				return;
			}
			this.list = (await r.json()) as AutomationAlerts[];
			this.known = true;
		} catch {
			// Kept as it was.
		}
	}

	/** Read again shortly: several rule changes at once cost one read. */
	soon(): void {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.#timer = null;
			void this.load();
		}, 250);
	}

	byId(id: string): AutomationAlerts | undefined {
		return this.list.find((x) => x.id === id);
	}
}

export const alertLinks = new AlertLinks();
