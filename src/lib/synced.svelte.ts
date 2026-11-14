/**
 * A document on the UI server, kept in step here (S2, M1): a person's own
 * preferences, or the household's shared edits and settings.
 *
 * Changes show at once and are saved behind. Each save says which version it
 * was made against; if another screen saved first, the server hands back what
 * it has, and the same change is made again on top of that — so two people's
 * changes, or one person's on two screens, both survive. Other screens hear
 * of the save on the UI server's change stream and reload.
 *
 * A change that couldn't be saved stays shown, and goes again with the next
 * save, so a blip loses nothing and the screen never quietly drops a change.
 */

export type Edit<D> = (doc: D) => D;

export class Synced<D extends { version: number }> {
	doc = $state<D>() as D;
	loaded = $state(false);
	/** Set when a save has failed for good; the change is still shown here. */
	trouble = $state<string | null>(null);
	/**
	 * Set while the server hasn't handed the document over: what is shown is
	 * generated, not what was saved, and loading tries again until it is.
	 */
	missing = $state(false);

	#url: string;
	#kind: string;
	#migrate: Edit<D>;
	#queue: Promise<void> = Promise.resolve();
	#listeners = new Set<(doc: D) => void>();
	/** What the server last confirmed. */
	#saved: D;
	/** Changes made here and not yet saved, oldest first, including any that failed. */
	#pending: Edit<D>[] = [];

	/** `migrate` reads an older shape of the document in today's (04 §7). */
	constructor(url: string, kind: string, migrate: Edit<D> = (d) => d) {
		this.#url = url;
		this.#kind = kind;
		this.#migrate = migrate;
		this.#saved = { version: 0 } as D;
		this.doc = this.#saved;
	}

	/** What the server last confirmed, without changes still being saved. */
	get saved(): D {
		return this.#saved;
	}

	async load(): Promise<void> {
		await this.#fetch();
		this.loaded = true;
		follow(this.#kind, (version) => {
			if (version > this.#saved.version) void this.#reload();
		});
	}

	#wait = 0;
	/** Asks for the document; failing, says so and asks again a little later each time. */
	async #fetch(): Promise<void> {
		try {
			const res = await fetch(this.#url);
			if (res.ok) {
				this.#take((await res.json()) as D);
				this.missing = false;
				this.#wait = 0;
				return;
			}
		} catch {
			// Shown as generated until the server answers.
		}
		this.missing = true;
		this.#wait = Math.min(30_000, this.#wait === 0 ? 2_000 : this.#wait * 2);
		setTimeout(() => void this.#fetch(), this.#wait);
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
			// Everything still unsaved goes together; a failed change is kept for the next try.
			const edits = [...this.#pending];
			if (edits.length === 0) return;
			const all: Edit<D> = (d) => edits.reduce((x, e) => e(x), d);
			// Refused (no right to change it) can never succeed, so it isn't kept.
			if ((await this.#save(all)) !== 'failed') this.#pending.splice(0, edits.length);
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

	async #save(edit: Edit<D>, tries = 0): Promise<'saved' | 'failed' | 'refused'> {
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
			return 'failed';
		}
		if (res.status === 409 && tries < 3) {
			const body = (await res.json().catch(() => ({}))) as { current?: D };
			this.#saved = this.#migrate(body.current ?? ({ version: 0 } as D));
			return this.#save(edit, tries + 1);
		}
		if (res.status === 403) {
			this.trouble = "You can't change this — ask an admin.";
			return 'refused';
		}
		if (!res.ok) {
			this.trouble = "Couldn't save — this change is only on this screen for now.";
			return 'failed';
		}
		this.trouble = null;
		this.#saved = (await res.json()) as D;
		return 'saved';
	}

	#take(doc: D): void {
		this.#saved = this.#migrate(doc);
		this.#show();
		for (const l of this.#listeners) l(this.#saved);
	}

	async #reload(): Promise<void> {
		try {
			const res = await fetch(this.#url);
			if (!res.ok) return;
			const doc = (await res.json()) as D;
			if (doc.version > this.#saved.version) this.#take(doc);
			this.missing = false;
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
