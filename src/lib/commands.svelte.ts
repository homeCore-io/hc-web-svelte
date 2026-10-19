/**
 * Sending commands to devices, and the waiting state while the house catches
 * up (C8). See `pending.ts` for what counts as confirmed.
 */
import { confirmed, patienceFor, type Pending } from './pending.js';

/** How long a "didn't respond" note stays on a card. */
const NOTE_MS = 4_000;

class Commands {
	pending = $state<Record<string, Pending>>({});
	/** A short message on a card: "Didn't respond", "Couldn't send". */
	notes = $state<Record<string, string>>({});

	/**
	 * Set attributes: `{ on: true }`, `{ brightness_pct: 40 }`. Asking for what
	 * the device already reports changes nothing, so homeCore sends no event to
	 * confirm it — that is sent without waiting.
	 */
	async set(
		id: string,
		kind: string,
		want: Record<string, unknown>,
		current: Record<string, unknown>
	): Promise<void> {
		if (confirmed(want, current)) {
			await this.#send(id, want);
			return;
		}
		const until = Date.now() + patienceFor(kind);
		this.pending = { ...this.pending, [id]: { want, until } };
		this.#clearNote(id);
		setTimeout(() => this.#expire(id, until), until - Date.now() + 50);
		if (!(await this.#send(id, want))) this.#drop(id);
	}

	/** Run one of the device's declared actions — nothing to wait for. */
	async act(id: string, action: string, params: Record<string, unknown> = {}): Promise<boolean> {
		this.#clearNote(id);
		return this.#send(id, { action, ...params });
	}

	/** A command in the device's own words, sent as it is (a WLED look). */
	async send(id: string, body: Record<string, unknown>): Promise<boolean> {
		this.#clearNote(id);
		return this.#send(id, body);
	}

	/** A homeCore timer's own commands: start, cancel. */
	async timer(id: string, body: Record<string, unknown>): Promise<boolean> {
		this.#clearNote(id);
		return this.#send(id, body);
	}

	/** Called on every state report: a command whose values have arrived is done. */
	settle(id: string, attrs: Record<string, unknown>): void {
		const p = this.pending[id];
		if (p !== undefined && confirmed(p.want, attrs)) this.#drop(id);
	}

	async #send(id: string, body: Record<string, unknown>): Promise<boolean> {
		try {
			const res = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/state`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (res.ok) return true;
			this.#note(id, res.status === 403 ? 'Not allowed' : "Couldn't send");
		} catch {
			this.#note(id, "Couldn't reach homeCore");
		}
		return false;
	}

	#expire(id: string, until: number): void {
		const p = this.pending[id];
		// A later press replaced this one; it has its own timer.
		if (p === undefined || p.until !== until) return;
		this.#drop(id);
		this.#note(id, "Didn't respond");
	}

	#drop(id: string): void {
		if (!(id in this.pending)) return;
		const rest = { ...this.pending };
		delete rest[id];
		this.pending = rest;
	}

	#note(id: string, text: string): void {
		this.notes = { ...this.notes, [id]: text };
		setTimeout(() => {
			if (this.notes[id] === text) this.#clearNote(id);
		}, NOTE_MS);
	}

	#clearNote(id: string): void {
		if (!(id in this.notes)) return;
		const rest = { ...this.notes };
		delete rest[id];
		this.notes = rest;
	}
}

export const commands = new Commands();
