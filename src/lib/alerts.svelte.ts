/**
 * The house's alerts, live (N7): loaded once over REST and kept current from
 * the event stream, as rooms are — a snapshot that arrived first wins.
 */
import { alertsAfter, byDevice, sortAlerts, type Alert } from './alerts.js';
import { live } from './live.svelte.js';
import { judgeBatteriesBy } from './card.js';

class Alerts {
	list = $state<Alert[]>([]);
	/** Whether this homeCore has alerts at all (H4); an older one answers 404. */
	known = $state(false);
	byDevice = $derived(byDevice(this.list));
	#unfollow: (() => void) | null = null;
	#streamed = false;

	async load(): Promise<void> {
		this.#unfollow ??= live.listen((frame) => {
			const next = alertsAfter(this.list, frame);
			if (next === undefined) return;
			if (frame.type === 'snapshot') this.#streamed = true;
			this.known = true;
			this.list = next;
		});
		try {
			const res = await fetch('/api/v1/alerts');
			if (!res.ok || this.#streamed) return;
			this.list = sortAlerts((await res.json()) as Alert[]);
			this.known = true;
		} catch {
			// The stream's snapshot fills it in.
		}
	}
}

export const alerts = new Alerts();

// A card's low battery is homeCore's: its threshold, its recovery band and
// what's been ignored. Reading `list` here makes every card that asks follow it.
judgeBatteriesBy((id) =>
	alerts.known ? alerts.list.some((a) => a.device_id === id && a.kind === 'low_battery') : undefined
);
