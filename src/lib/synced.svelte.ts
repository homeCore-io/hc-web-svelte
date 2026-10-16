/**
 * A document on the UI server, kept in step here (S2, M1): a person's own
 * preferences, or the household's shared edits and settings.
 *
 * Changes show at once and are saved behind. Each save says which version it
 * was made against; if another screen saved first, the server hands back what
 * it has, and the same change is made again on top of that — so two people's
 * changes, or one person's on two screens, both survive. Other screens hear
 * of the save on the UI server's change stream and reload.
 */

export type Edit<D> = (doc: D) => D;

export class Synced<D extends { version: number }> {
	doc = $state<D>() as D;
	loaded = $state(false);
	/** Set when a save has failed for good; the change is still shown here. */
	trouble = $state<string | null>(null);

	#url: string;
	#kind: string;
	#queue: Promise<void> = Promise.resolve();
	#listeners = new Set<(doc: D) => void>();
	/** What the server last confirmed. */
	#saved: D;
	/** Changes made here and not yet saved, oldest first. */
	#pending: Edit<D>[] = [];

	constructor(url: string, kind: string) {
		this.#url = url;
		this.#kind = kind;
		this.#saved = { version: 0 } as D;
		this.doc = this.#saved;
	}

	/** What the server last confirmed, without changes still being saved. */
	get saved(): D {
		return this.#saved;
	}

	async load(): Promise<void> {
		try {
			const res = await fetch(this.#url);
			if (res.ok) this.#take((await res.json()) as D);
		} catch {
			// Shown as generated until the server answers.
		}
		this.loaded = true;
		follow(this.#kind, (version) => {
			if (version > this.#saved.version) void this.#reload();
		});
	}

	/** Hear the document whenever it is loaded afresh. */
	onLoad(listener: (doc: D) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Make a change: shown now, saved behind. */
	change(edit: Edit<D>): Promise<void> {
		this.#pending.push(edit);
		this.#show();
		this.#queue = this.#queue.then(async () => {
			await this.#save(edit);
			this.#pending.shift();
			this.#show();
		});
		return this.#queue;
	}

	#show(): void {
		this.doc = {
			...this.#pending.reduce((d, e) => e(d), this.#saved),
			version: this.#saved.version
		};
	}

	async #save(edit: Edit<D>, tries = 0): Promise<void> {
		// Saved against the server's last word, not against our optimistic copy.
		const base = this.#saved;
		const next = { ...edit(base), version: base.version };
		let res: Response;
		try {
			res = await fetch(this.#url, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(next)
			});
		} catch {
			this.trouble = "Couldn't save — this change is only on this screen for now.";
			return;
		}
		if (res.status === 409 && tries < 3) {
			const body = (await res.json().catch(() => ({}))) as { current?: D };
			this.#saved = body.current ?? ({ version: 0 } as D);
			return this.#save(edit, tries + 1);
		}
		if (!res.ok) {
			this.trouble =
				res.status === 403
					? "You can't change this — ask an admin."
					: "Couldn't save — this change is only on this screen for now.";
			return;
		}
		this.trouble = null;
		this.#saved = (await res.json()) as D;
	}

	#take(doc: D): void {
		this.#saved = doc;
		this.#show();
		for (const l of this.#listeners) l(doc);
	}

	async #reload(): Promise<void> {
		try {
			const res = await fetch(this.#url);
			if (!res.ok) return;
			const doc = (await res.json()) as D;
			if (doc.version > this.#saved.version) this.#take(doc);
		} catch {
			// The next change event tries again.
		}
	}
}

// ---- the UI server's change stream, one per screen ----

let events: EventSource | null = null;
const followers = new Map<string, (version: number) => void>();

function follow(kind: string, heard: (version: number) => void): void {
	followers.set(kind, heard);
	if (events !== null || typeof EventSource === 'undefined') return;
	events = new EventSource('/ui/events');
	events.addEventListener('change', (e) => {
		const change = JSON.parse((e as MessageEvent<string>).data) as {
			kind: string;
			version: number;
		};
		followers.get(change.kind)?.(change.version);
	});
}
