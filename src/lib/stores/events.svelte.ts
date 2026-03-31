import { browser } from '$app/environment';
import type { HcEvent } from '$lib/models/event';
import { HomeCoreEventsApi } from '$lib/api/events';

class EventsState {
	items = $state<HcEvent[]>([]);
	connected = $state(false);
	error = $state<string | null>(null);
	started = $state(false);
	#api: HomeCoreEventsApi | null = null;

	connect() {
		if (!browser || this.started) return;
		this.started = true;
		this.#api = new HomeCoreEventsApi();
		this.#api.connect({
			onEvent: (event) => {
				this.items = [event, ...this.items].slice(0, 100);
			},
			onConnected: (connected) => {
				this.connected = connected;
			},
			onError: (message) => {
				this.error = message;
			}
		});
	}

	reset() {
		this.#api?.dispose();
		this.#api = null;
		this.items = [];
		this.connected = false;
		this.error = null;
		this.started = false;
	}
}

export const eventsState = new EventsState();
