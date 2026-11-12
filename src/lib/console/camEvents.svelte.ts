/**
 * The day's camera events (cameras.ts), from homeCore's history: each kind a
 * camera tells apart and its stills, since midnight. Loaded for the cameras a
 * page asks about, and again a few seconds after one of them sees something
 * or takes a still, so the list follows the house without being polled.
 */
import {
	KINDS,
	eventsOf,
	startOfDay,
	type Cam,
	type CamEvent,
	type CamHistory,
	type HistoryRow
} from './cameras.js';

/** How long after a camera's change to read its history again: the still comes a moment after. */
const SETTLE_MS = 4_000;
/** Rows read per attribute; a busy day's sightings fit. */
const LIMIT = 1000;

async function rows(id: string, attribute: string, from: number): Promise<HistoryRow[]> {
	const q = new URLSearchParams({
		attribute,
		from: new Date(from).toISOString(),
		limit: String(LIMIT)
	});
	const r = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`);
	if (!r.ok) throw new Error(String(r.status));
	const list = (await r.json()) as { value: unknown; recorded_at: string }[];
	return list.map((x) => ({ at: x.recorded_at, value: x.value }));
}

class CamEvents {
	/** Each camera's events today, newest first. */
	byCam = $state<Record<string, CamEvent[]>>({});
	/** Cameras whose history couldn't be read. */
	failed = $state<Record<string, true>>({});
	/** Whether each camera has been read yet today. */
	ready = $state<Record<string, true>>({});
	#day = new Map<string, number>();
	#sig = new Map<string, string>();
	#soon = new Map<string, ReturnType<typeof setTimeout>>();
	#busy = new Set<string>();

	/**
	 * Keep these cameras' events current: read today's history for any not
	 * read today, and again soon after one of them changes. Called from an
	 * effect, so it runs again when their readings do.
	 */
	follow(cams: Cam[]): void {
		const today = startOfDay(Date.now());
		for (const c of cams) {
			const a = c.device.attributes ?? {};
			const sig = [...KINDS.map((k) => String(a[k.attr])), c.snapshot ?? ''].join('|');
			const was = this.#sig.get(c.id);
			this.#sig.set(c.id, sig);
			if (this.#day.get(c.id) !== today) void this.#load(c, today);
			else if (was !== undefined && was !== sig) this.#later(c);
		}
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
		this.#busy.add(c.id);
		try {
			const kinds = c.kinds.length > 0 ? c.kinds : [];
			const [snapshots, ...each] = await Promise.all([
				rows(c.id, 'snapshot', today),
				...kinds.map((k) => rows(c.id, KINDS.find((x) => x.id === k)!.attr, today))
			]);
			const h: CamHistory = { kinds: {}, snapshots: snapshots ?? [] };
			kinds.forEach((k, i) => (h.kinds[k] = each[i]));
			this.byCam = { ...this.byCam, [c.id]: eventsOf(c.id, h) };
			if (this.failed[c.id]) {
				const rest = { ...this.failed };
				delete rest[c.id];
				this.failed = rest;
			}
		} catch {
			this.failed = { ...this.failed, [c.id]: true };
			// Tried again the next time anything asks.
			this.#day.delete(c.id);
		} finally {
			this.#busy.delete(c.id);
			this.ready = { ...this.ready, [c.id]: true };
		}
	}
}

export const camEvents = new CamEvents();
