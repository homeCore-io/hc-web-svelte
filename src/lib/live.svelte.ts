/**
 * The connection to homeCore's event stream (through the UI server, S3).
 *
 * Asks for the house as it stands on every connect (`snapshot=true`, H2), so
 * a reconnect after an outage resynchronises everything rather than leaving
 * whatever changed meanwhile stale. Frames go to whoever listens: rooms now,
 * devices in R2. The UI server adds the session's token to the upgrade, so
 * this URL carries none.
 */
import type { Frame } from './house.js';

export type LiveState = 'connecting' | 'live' | 'offline';

type Listener = (frame: Frame) => void;

class Live {
	state = $state<LiveState>('connecting');
	#socket: WebSocket | null = null;
	#retry = 0;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#wanted = false;
	#listeners = new Set<Listener>();

	/** Hear every frame from now on. Returns the way to stop. */
	listen(listener: Listener): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

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
		url.searchParams.set('snapshot', 'true');
		// Which tab this is, so homeCore's list of who's connected can tell
		// one person's tabs apart from a screen reconnecting over and over.
		url.searchParams.set('client_id', tabId());
		const socket = new WebSocket(url);
		this.#socket = socket;
		socket.onopen = () => {
			this.#retry = 0;
			this.state = 'live';
		};
		socket.onmessage = (message) => {
			let frame: Frame;
			try {
				frame = JSON.parse(String(message.data)) as Frame;
			} catch {
				return;
			}
			for (const listener of this.#listeners) listener(frame);
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

/** This tab's id: made once, kept while the tab lives. */
function tabId(): string {
	try {
		const had = sessionStorage.getItem('hc-tab');
		if (had) return had;
		const made = Math.random().toString(36).slice(2, 10);
		sessionStorage.setItem('hc-tab', made);
		return made;
	} catch {
		return 'tab';
	}
}

export const live = new Live();
