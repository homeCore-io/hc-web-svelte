/**
 * Live video: one go2rtc stream played into a `<video>` by MSE over its
 * WebSocket, from the app's own `/video` (server/video.js), as the Reolink
 * plugin's own screens play it. Kept to the live edge with a small buffer;
 * a dropped connection is tried again after a few seconds.
 */

export type LiveState = 'connecting' | 'live' | 'lost' | 'error' | 'unsupported';
/** Or not asked to play: off screen, the page hidden, or no stream. */
export type Playing = LiveState | 'paused';

type MSClass = typeof MediaSource;
const MS = (): MSClass | undefined =>
	(globalThis as { ManagedMediaSource?: MSClass }).ManagedMediaSource ?? globalThis.MediaSource;
const CODECS = [
	'avc1.640029',
	'avc1.64002A',
	'avc1.640033',
	'hvc1.1.6.L153.B0',
	'mp4a.40.2',
	'mp4a.40.5',
	'opus'
];
const RETRY_MS = 3_000;

export class Live {
	#video: HTMLVideoElement;
	#stream: string;
	#onstate: (s: LiveState) => void;
	#queue: ArrayBuffer[] = [];
	#ws?: WebSocket;
	#sb?: SourceBuffer;
	#retry?: ReturnType<typeof setTimeout>;
	#stopped = false;
	#live = false;

	constructor(video: HTMLVideoElement, stream: string, onstate: (s: LiveState) => void) {
		this.#video = video;
		this.#stream = stream;
		this.#onstate = onstate;
		this.#start();
	}

	#start() {
		const M = MS();
		if (!M) return this.#onstate('unsupported');
		this.#live = false;
		this.#onstate('connecting');
		const ms = new M();
		const v = this.#video;
		v.disableRemotePlayback = true;
		v.src = URL.createObjectURL(ms);
		ms.addEventListener(
			'sourceopen',
			() => {
				URL.revokeObjectURL(v.src);
				if (this.#stopped) return;
				const proto = location.protocol === 'https:' ? 'wss' : 'ws';
				const ws = new WebSocket(
					`${proto}://${location.host}/video/api/ws?src=${encodeURIComponent(this.#stream)}`
				);
				this.#ws = ws;
				ws.binaryType = 'arraybuffer';
				ws.onopen = () => {
					const ok = CODECS.filter((c) => M.isTypeSupported(`video/mp4; codecs="${c}"`));
					ws.send(JSON.stringify({ type: 'mse', value: ok.join(',') }));
				};
				ws.onmessage = (e) => {
					if (typeof e.data === 'string') {
						const msg = JSON.parse(e.data) as { type?: string; value?: string };
						if (msg.type === 'mse' && msg.value) {
							try {
								const sb = ms.addSourceBuffer(msg.value);
								sb.mode = 'segments';
								sb.addEventListener('updateend', () => this.#pump());
								this.#sb = sb;
							} catch {
								this.#onstate('error');
							}
						} else if (msg.type === 'error') this.#onstate('error');
						return;
					}
					this.#queue.push(e.data as ArrayBuffer);
					this.#pump();
				};
				ws.onclose = () => {
					if (this.#stopped) return;
					this.#onstate('lost');
					this.#retry = setTimeout(() => this.#restart(), RETRY_MS);
				};
			},
			{ once: true }
		);
		v.play().catch(() => {});
	}

	#pump() {
		const sb = this.#sb;
		if (!sb || sb.updating || this.#queue.length === 0) return;
		try {
			sb.appendBuffer(this.#queue.shift()!);
		} catch {
			this.#queue = [];
			return;
		}
		const v = this.#video;
		if (v.buffered.length === 0) return;
		const end = v.buffered.end(v.buffered.length - 1);
		// Keep to the live edge, and the buffer small.
		if (end - v.currentTime > 2) v.currentTime = end - 0.3;
		if (!sb.updating && v.currentTime - v.buffered.start(0) > 20) {
			try {
				sb.remove(v.buffered.start(0), v.currentTime - 5);
			} catch {
				// Trimmed next time.
			}
		}
		if (v.readyState >= 2 && !this.#live) {
			this.#live = true;
			this.#onstate('live');
		}
	}

	#restart() {
		this.#teardown();
		this.#queue = [];
		this.#start();
	}

	#teardown() {
		clearTimeout(this.#retry);
		if (this.#ws) {
			this.#ws.onclose = null;
			this.#ws.close();
		}
		this.#ws = undefined;
		this.#sb = undefined;
		this.#video.removeAttribute('src');
		this.#video.load();
	}

	stop() {
		this.#stopped = true;
		this.#teardown();
	}
}
