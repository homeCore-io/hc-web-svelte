import type { HcEvent } from '$lib/models/event';
import { buildWebSocketUrl, getStoredToken } from './client';

export type EventStreamHandlers = {
	onEvent: (event: HcEvent) => void;
	onConnected?: (connected: boolean) => void;
	onError?: (message: string) => void;
};

export class HomeCoreEventsApi {
	#socket: WebSocket | null = null;
	#reconnectTimer: number | null = null;
	#disposed = false;

	connect(handlers: EventStreamHandlers) {
		this.#disposed = false;
		this.#open(handlers);
	}

	dispose() {
		this.#disposed = true;
		if (this.#reconnectTimer !== null) {
			window.clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}
		this.#socket?.close();
		this.#socket = null;
	}

	#open(handlers: EventStreamHandlers) {
		const token = getStoredToken();
		if (!token) {
			handlers.onConnected?.(false);
			return;
		}

		try {
			const url = buildWebSocketUrl('/events/stream', token);
			this.#socket = new WebSocket(url);
			this.#socket.onopen = () => handlers.onConnected?.(true);
			this.#socket.onmessage = (message) => {
				try {
					const parsed = JSON.parse(String(message.data)) as HcEvent;
					handlers.onEvent(parsed);
				} catch {
					handlers.onError?.('Invalid event payload received');
				}
			};
			this.#socket.onerror = () => {
				handlers.onConnected?.(false);
				this.#scheduleReconnect(handlers);
			};
			this.#socket.onclose = () => {
				handlers.onConnected?.(false);
				this.#scheduleReconnect(handlers);
			};
		} catch (error) {
			handlers.onConnected?.(false);
			handlers.onError?.(error instanceof Error ? error.message : 'Unable to connect to event stream');
			this.#scheduleReconnect(handlers);
		}
	}

	#scheduleReconnect(handlers: EventStreamHandlers) {
		if (this.#disposed || this.#reconnectTimer !== null) return;
		this.#reconnectTimer = window.setTimeout(() => {
			this.#reconnectTimer = null;
			this.#open(handlers);
		}, 3000);
	}
}
