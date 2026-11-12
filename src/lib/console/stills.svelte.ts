/**
 * Snapshots of the cameras now, as the kiosk takes them: a frame of each
 * stream on screen from go2rtc (through the app's `/video`), one request at a
 * time and never overlapping, every 8 seconds round. The last good picture
 * is kept when one fails, and its age shown once it's stale. Nothing is
 * asked while the page is hidden. The NVR allows only a few sessions, so
 * only streams something on screen shows are asked for.
 */
import { frameUrl } from './cameras.js';

export const ROUND_MS = 8_000;
const TIMEOUT_MS = 10_000;
/** Older than this, a snapshot shows its age. */
export const STALE_MS = 60_000;

export interface Shot {
	url: string;
	/** When it was taken (ms). */
	at: number;
}

class Stills {
	shots = $state<Record<string, Shot>>({});
	/** Whether this app has live video at all (`HC_GO2RTC_URL`); unknown until asked. */
	video = $state<boolean | undefined>(undefined);
	#want = new Map<string, number>();
	#running = false;

	/** Show a stream's snapshots while something on screen does; the returned function stops. */
	use(stream: string): () => void {
		this.#want.set(stream, (this.#want.get(stream) ?? 0) + 1);
		void this.#run();
		return () => {
			const n = (this.#want.get(stream) ?? 1) - 1;
			if (n > 0) this.#want.set(stream, n);
			else this.#want.delete(stream);
		};
	}

	/** Take this stream's next snapshot now (a camera just picked). */
	async now(stream: string): Promise<void> {
		await this.#take(stream);
	}

	async #run() {
		if (this.#running) return;
		this.#running = true;
		try {
			while (this.#want.size > 0 && this.video !== false) {
				if (!document.hidden) for (const s of [...this.#want.keys()]) await this.#take(s);
				await new Promise((r) => setTimeout(r, ROUND_MS));
			}
		} finally {
			this.#running = false;
			this.#forget();
		}
	}

	async #take(stream: string) {
		if (!this.#want.has(stream) || this.video === false) return;
		const stop = new AbortController();
		const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
		try {
			const res = await fetch(frameUrl(stream), { cache: 'no-store', signal: stop.signal });
			// No go2rtc behind this app: no snapshots to take, and none asked again.
			if (res.status === 404 && /json/.test(res.headers.get('content-type') ?? '')) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				if (/no live video/i.test(body.error ?? '')) this.video = false;
				return;
			}
			if (!res.ok) return;
			const url = URL.createObjectURL(await res.blob());
			const old = this.shots[stream];
			this.shots = { ...this.shots, [stream]: { url, at: Date.now() } };
			this.video = true;
			if (old) URL.revokeObjectURL(old.url);
		} catch {
			// Kept: the last good one, its age shown when it's stale.
		} finally {
			clearTimeout(timer);
		}
	}

	/** Pictures of streams nothing shows any more, let go. */
	#forget() {
		const keep: Record<string, Shot> = {};
		for (const [s, shot] of Object.entries(this.shots)) {
			if (this.#want.has(s)) keep[s] = shot;
			else URL.revokeObjectURL(shot.url);
		}
		this.shots = keep;
	}
}

export const stills = new Stills();

/** "12 s", "3m old", for a snapshot's corner; empty while it's fresh enough not to say. */
export function ageWord(at: number | undefined, now: number, always = false): string {
	if (at === undefined) return 'no image';
	const age = Math.max(0, now - at);
	if (age > 86_400_000) return `${Math.floor(age / 86_400_000)}d old`;
	if (age > 3_600_000) return `${Math.floor(age / 3_600_000)}h old`;
	if (age > STALE_MS) return `${Math.round(age / 60_000) || 1}m old`;
	return always ? `${Math.floor(age / 1000)} s` : '';
}
