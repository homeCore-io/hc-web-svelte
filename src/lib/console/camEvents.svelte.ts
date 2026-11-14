/**
 * The day's camera events (cameras.ts), from homeCore's history: each kind a
 * camera tells apart and its stills, since midnight. Loaded for the cameras a
 * page asks about, and again a few seconds after one of them sees something
 * or takes a still, so the list follows the house without being polled.
 *
 * Read a few requests at a time (queue.ts), and let go of as soon as no page
 * follows that camera any more, so leaving the cameras doesn't leave core
 * answering for them.
 */
import { isAbort, Queue } from './queue.js';
import {
	KINDS,
	eventsOf,
	startOfDay,
	stillAt,
	stillKept,
	type Cam,
	type CamEvent,
	type CamHistory,
	type HistoryRow
} from './cameras.js';

/** How long after a camera's change to read its history again: the still comes a moment after. */
const SETTLE_MS = 4_000;
/** Rows read per attribute; a busy day's sightings fit. */
const LIMIT = 1000;

/** History requests at once, for every camera together. */
const AT_ONCE = 4;
const asking = new Queue(AT_ONCE);

async function rows(
	id: string,
	attribute: string,
	from: number,
	signal: AbortSignal
): Promise<HistoryRow[]> {
	const q = new URLSearchParams({
		attribute,
		from: new Date(from).toISOString(),
		limit: String(LIMIT)
	});
	return asking.run(async () => {
		const r = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`, { signal });
		if (!r.ok) throw new Error(String(r.status));
		const list = (await r.json()) as { value: unknown; recorded_at: string }[];
		return list.map((x) => ({ at: x.recorded_at, value: x.value }));
	}, signal);
}

class CamEvents {
	/** Each camera's events today, newest first. */
	byCam = $state<Record<string, CamEvent[]>>({});
	/** Cameras whose history couldn't be read. */
	failed = $state<Record<string, true>>({});
	/** Each camera's stills today, as its history names them. */
	stills = $state<Record<string, string[]>>({});
	/** When each camera's newest still found deleted was taken (ms): those older are too. */
	goneAt = $state<Record<string, number>>({});
	/** Whether each camera has been read yet today. */
	ready = $state<Record<string, true>>({});
	#day = new Map<string, number>();
	#sig = new Map<string, string>();
	#soon = new Map<string, ReturnType<typeof setTimeout>>();
	#busy = new Map<string, AbortController>();
	/** How many pages follow each camera now. */
	#followers = new Map<string, number>();

	/**
	 * Keep these cameras' events current: read today's history for any not
	 * read today, and again soon after one of them changes. Called from an
	 * effect, so it runs again when their readings do; the function it
	 * returns, the effect's cleanup, stops following them, and once no page
	 * does, what is still being read for them is let go.
	 */
	follow(cams: Cam[]): () => void {
		const today = startOfDay(Date.now());
		const ids = cams.map((c) => c.id);
		for (const id of ids) this.#followers.set(id, (this.#followers.get(id) ?? 0) + 1);
		for (const c of cams) {
			const a = c.device.attributes ?? {};
			const sig = [...KINDS.map((k) => String(a[k.attr])), c.snapshot ?? ''].join('|');
			const was = this.#sig.get(c.id);
			this.#sig.set(c.id, sig);
			if (this.#day.get(c.id) !== today) void this.#load(c, today);
			else if (was !== undefined && was !== sig) this.#later(c);
		}
		return () => {
			for (const id of ids) {
				const n = (this.#followers.get(id) ?? 1) - 1;
				if (n > 0) this.#followers.set(id, n);
				else this.#followers.delete(id);
			}
			// An effect running again follows them again straight away: only
			// those still unfollowed after that are let go.
			setTimeout(() => {
				for (const id of ids) if (!this.#followers.has(id)) this.#leave(id);
			}, 0);
		};
	}

	/** No page follows this camera: its reading is let go, and done again when one does. */
	#leave(id: string) {
		clearTimeout(this.#soon.get(id));
		this.#soon.delete(id);
		const reading = this.#busy.get(id);
		if (!reading) return;
		reading.abort();
		this.#day.delete(id);
	}

	/** Whether a camera's still is likely still kept by its plugin, so worth asking for. */
	kept(cam: string, path: string): boolean {
		return stillKept(path, this.stills[cam] ?? [], this.goneAt[cam]);
	}

	/** A camera's still found deleted: it and every older one are no longer asked for. */
	lost(cam: string, path: string): void {
		const at = stillAt(path);
		if (at !== undefined && at > (this.goneAt[cam] ?? -1))
			this.goneAt = { ...this.goneAt, [cam]: at };
	}

	#later(c: Cam) {
		clearTimeout(this.#soon.get(c.id));
		this.#soon.set(
			c.id,
			setTimeout(() => void this.#load(c, startOfDay(Date.now())), SETTLE_MS)
		);
	}

	async #load(c: Cam, today: number) {
		this.#day.set(c.id, today);
		if (this.#busy.has(c.id)) return this.#later(c);
		const stop = new AbortController();
		this.#busy.set(c.id, stop);
		let letGo = false;
		try {
			const kinds = c.kinds.length > 0 ? c.kinds : [];
			const [snapshots, ...each] = await Promise.all([
				rows(c.id, 'snapshot', today, stop.signal),
				...kinds.map((k) => rows(c.id, KINDS.find((x) => x.id === k)!.attr, today, stop.signal))
			]);
			const h: CamHistory = { kinds: {}, snapshots: snapshots ?? [] };
			kinds.forEach((k, i) => (h.kinds[k] = each[i]));
			this.byCam = { ...this.byCam, [c.id]: eventsOf(c.id, h) };
			this.stills = {
				...this.stills,
				[c.id]: h.snapshots.map((r) => r.value).filter((v): v is string => typeof v === 'string')
			};
			if (this.failed[c.id]) {
				const rest = { ...this.failed };
				delete rest[c.id];
				this.failed = rest;
			}
		} catch (e) {
			// Let go of on purpose, or failed: read again the next time anything asks.
			this.#day.delete(c.id);
			letGo = isAbort(e) || stop.signal.aborted;
			if (!letGo) this.failed = { ...this.failed, [c.id]: true };
		} finally {
			// The rest of a reading let go of is let go too.
			stop.abort();
			this.#busy.delete(c.id);
			if (!letGo) this.ready = { ...this.ready, [c.id]: true };
		}
	}
}

export const camEvents = new CamEvents();
