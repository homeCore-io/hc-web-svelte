/**
 * The connection to homeCore's event stream (through the UI server, S3).
 *
 * R0 only shows that it is connected; R2 starts using what arrives. The UI
 * server adds the session's token to the upgrade, so this URL carries none.
 */
export type LiveState = 'connecting' | 'live' | 'offline';

class Live {
	state = $state<LiveState>('connecting');
	#socket: WebSocket | null = null;
	#retry = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#wanted = false;

	start(): void {
		this.#wanted = true;
		this.#open();
	}

	stop(): void {
		this.#wanted = false;
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#socket?.close();
		this.#socket = null;
	}

	#open(): void {
		if (!this.#wanted) return;
		this.state = 'connecting';
		const url = new URL('/api/v1/events/stream', location.href);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		const socket = new WebSocket(url);
		this.#socket = socket;
		socket.onopen = () => {
			this.#retry = 0;
			this.state = 'live';
		};
		socket.onclose = () => {
			if (this.#socket !== socket) return;
			this.state = 'offline';
			// Back off to 30 s, so a homeCore restart is picked up quickly and a
			// long outage doesn't hammer it.
			const wait = Math.min(30_000, 1000 * 2 ** this.#retry++);
			this.#timer = setTimeout(() => this.#open(), wait);
		};
	}
}

export const live = new Live();
