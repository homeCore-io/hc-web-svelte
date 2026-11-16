/**
 * `host.stream`: one of a plugin's streaming actions, started and followed
 * with `fetch` (the app's own sign-in, as every other call; no token in the
 * address), its Server-Sent Events read from the response body.
 *
 * Every event is handed to `onEvent`: first `started` with the request's id
 * (for `host.respond`), then the plugin's own (`progress`, `item`,
 * `awaiting_user`, …), and last one that ends it (`complete`, `error`,
 * `canceled`, `timeout`, or `busy` when homeCore refused a second run),
 * which `done` resolves with too. `done` never rejects.
 */
import { cancelAction, runAction } from '../pluginAdmin.js';
import type { StreamEnd, StreamEvent, StreamHandle } from './types.js';

const ENDS = new Set(['complete', 'error', 'canceled', 'timeout', 'busy']);
/** How long a canceled run may take to say so before the app stops waiting. */
const CANCEL_WAIT_MS = 10_000;
/** A dropped stream is opened again this many times; homeCore replays what was missed. */
const RECONNECTS = 3;

/** One SSE message: its event name and its data, lines joined. */
export interface SseMessage {
	event: string;
	data: string;
}

/**
 * Reads SSE messages from text as it arrives: `push` a chunk, get back the
 * messages it completed. Keeps the unfinished end for the next chunk.
 */
export class SseReader {
	#rest = '';

	push(chunk: string): SseMessage[] {
		this.#rest += chunk;
		const out: SseMessage[] = [];
		for (;;) {
			const m = /\r\n\r\n|\n\n|\r\r/.exec(this.#rest);
			if (!m) break;
			const block = this.#rest.slice(0, m.index);
			this.#rest = this.#rest.slice(m.index + m[0].length);
			let event = 'message';
			const data: string[] = [];
			for (const line of block.split(/\r\n|\n|\r/)) {
				if (line === '' || line.startsWith(':')) continue;
				const at = line.indexOf(':');
				const field = at < 0 ? line : line.slice(0, at);
				let value = at < 0 ? '' : line.slice(at + 1);
				if (value.startsWith(' ')) value = value.slice(1);
				if (field === 'event') event = value;
				else if (field === 'data') data.push(value);
			}
			if (data.length) out.push({ event, data: data.join('\n') });
		}
		return out;
	}
}

/** What `fetch` and the plugin calls are, so a test can stand in for them. */
export interface StreamDeps {
	fetch: typeof fetch;
	run: typeof runAction;
	cancel: typeof cancelAction;
}

const realDeps: StreamDeps = { fetch: (...a) => fetch(...a), run: runAction, cancel: cancelAction };

export function startStream(
	pluginId: string,
	action: string,
	params: Record<string, unknown>,
	onEvent: (e: StreamEvent) => void,
	deps: StreamDeps = realDeps
): StreamHandle {
	let requestId: string | undefined;
	let finished = false;
	let cancelAsked = false;
	const abort = new AbortController();
	let finish!: (e: StreamEnd) => void;
	const done = new Promise<StreamEnd>((resolve) => (finish = resolve));

	const tell = (e: StreamEvent) => {
		if (finished) return;
		try {
			onEvent(e);
		} catch (err) {
			console.error('host.stream: onEvent threw', err);
		}
		if (ENDS.has(e.stage)) {
			finished = true;
			abort.abort();
			finish(e as StreamEnd);
		}
	};

	const sendCancel = () => {
		if (!requestId || finished) return;
		void deps.cancel(pluginId, requestId);
		// A plugin that never says it stopped: stop waiting for it.
		setTimeout(() => tell({ stage: 'canceled', request_id: requestId }), CANCEL_WAIT_MS);
	};

	// The events already seen: a stream opened again replays from the start.
	const seen = new Set<string>();

	async function follow(rid: string): Promise<void> {
		for (let attempt = 0; !finished; attempt++) {
			try {
				const r = await deps.fetch(
					`/api/v1/plugins/${encodeURIComponent(pluginId)}/command/${encodeURIComponent(rid)}/stream`,
					{ headers: { accept: 'text/event-stream' }, signal: abort.signal }
				);
				if (!r.ok || !r.body) {
					if (r.status === 401 || r.status === 403)
						return tell({
							stage: 'error',
							message: "You aren't allowed to follow this.",
							request_id: rid
						});
					throw new Error(`homeCore said ${r.status}.`);
				}
				const sse = new SseReader();
				const text = new TextDecoder();
				const reader = r.body.getReader();
				for (;;) {
					const { value, done: over } = await reader.read();
					if (over) break;
					for (const m of sse.push(text.decode(value, { stream: true }))) {
						if (m.event !== 'stream' && m.event !== 'message') continue;
						if (seen.has(m.data)) continue;
						seen.add(m.data);
						let e: StreamEvent;
						try {
							e = JSON.parse(m.data) as StreamEvent;
						} catch {
							continue;
						}
						if (!e || typeof e.stage !== 'string') continue;
						tell({ ...e, request_id: rid });
						if (finished) return;
					}
				}
			} catch {
				if (finished) return;
			}
			if (finished) return;
			if (attempt >= RECONNECTS)
				return tell({
					stage: 'error',
					message: 'The connection to homeCore dropped.',
					request_id: rid
				});
			await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
		}
	}

	void (async () => {
		const r = await deps.run(pluginId, action, params);
		if (finished) return;
		if (!r.ok) return tell({ stage: 'error', message: r.error });
		const s = r.data;
		if (s.kind === 'busy')
			return tell({
				stage: 'busy',
				message: 'It is already doing that.',
				request_id: s.request_id
			});
		// An action that answered at once: that answer is its end.
		if (s.kind === 'reply') return tell({ stage: 'complete', data: s.reply });
		requestId = s.request_id;
		tell({ stage: 'started', request_id: s.request_id });
		if (cancelAsked) sendCancel();
		await follow(s.request_id);
	})();

	return {
		get requestId() {
			return requestId;
		},
		cancel() {
			if (finished || cancelAsked) return;
			cancelAsked = true;
			sendCancel();
		},
		done
	};
}
