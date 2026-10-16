/**
 * This person's own layers and preferences (M2–M4, N2, V2), kept on the UI
 * server so they follow the person from phone to laptop — and nobody else
 * sees them.
 *
 * Changes show at once and are saved behind. Each save says which version it
 * was made against; if another of the person's screens saved first, the
 * server hands back what it has, and the same change is made again on top of
 * that — so a star on the phone and a hide on the laptop both survive.
 * Other screens hear of the save on the UI server's change stream and reload.
 */
import { addChange, type Change, type PersonDoc } from './layers.js';

type Edit = (doc: PersonDoc) => PersonDoc;

class Personal {
	doc = $state<PersonDoc>({ version: 0 });
	loaded = $state(false);
	/** Set when a save has failed for good; the change is still shown here. */
	trouble = $state<string | null>(null);
	#queue: Promise<void> = Promise.resolve();
	#events: EventSource | null = null;
	#listeners = new Set<(doc: PersonDoc) => void>();

	async load(): Promise<void> {
		try {
			const res = await fetch('/ui/prefs');
			if (res.ok) this.#take((await res.json()) as PersonDoc);
		} catch {
			// Shown as generated until the server answers.
		}
		this.loaded = true;
		this.#follow();
	}

	/** Hear the document whenever it is loaded afresh. */
	onLoad(listener: (doc: PersonDoc) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Make a change: shown now, saved behind. */
	change(edit: Edit): Promise<void> {
		this.#pending.push(edit);
		this.#show();
		this.#queue = this.#queue.then(async () => {
			await this.#save(edit);
			this.#pending.shift();
			this.#show();
		});
		return this.#queue;
	}

	/** Changes made here and not yet saved, oldest first. */
	#pending: Edit[] = [];

	/** What the server last confirmed, with what is still being saved on top. */
	#show(): void {
		this.doc = {
			...this.#pending.reduce((d, e) => e(d), this.#saved),
			version: this.#saved.version
		};
	}

	// ---- the vocabulary the pages use ----

	changes(page: string): Change[] {
		return this.doc.pages?.[page] ?? [];
	}

	changePage(page: string, change: Change): Promise<void> {
		return this.change((d) => ({
			...d,
			pages: { ...d.pages, [page]: addChange(d.pages?.[page], change) }
		}));
	}

	/** "Reset to shared": this page back to how everyone else sees it. */
	resetPage(page: string): Promise<void> {
		return this.change((d) => {
			const pages = { ...d.pages };
			delete pages[page];
			return { ...d, pages };
		});
	}

	isFavourite(ref: string): boolean {
		return this.doc.favourites?.includes(ref) ?? false;
	}

	// ---- saving ----

	async #save(edit: Edit, tries = 0): Promise<void> {
		// Saved against the server's last word, not against our optimistic copy.
		const base = this.#saved;
		const next = { ...edit(base), version: base.version };
		let res: Response;
		try {
			res = await fetch('/ui/prefs', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(next)
			});
		} catch {
			this.trouble = "Couldn't save — this change is only on this screen for now.";
			return;
		}
		if (res.status === 409 && tries < 3) {
			const body = (await res.json().catch(() => ({}))) as { current?: PersonDoc };
			this.#saved = body.current ?? { version: 0 };
			return this.#save(edit, tries + 1);
		}
		if (!res.ok) {
			this.trouble = "Couldn't save — this change is only on this screen for now.";
			return;
		}
		this.trouble = null;
		this.#saved = (await res.json()) as PersonDoc;
	}

	/** What the server last confirmed. */
	#saved: PersonDoc = { version: 0 };

	#take(doc: PersonDoc): void {
		this.#saved = doc;
		this.#show();
		for (const l of this.#listeners) l(doc);
	}

	#follow(): void {
		if (this.#events !== null || typeof EventSource === 'undefined') return;
		this.#events = new EventSource('/ui/events');
		this.#events.addEventListener('change', (e) => {
			const change = JSON.parse((e as MessageEvent<string>).data) as { version: number };
			if (change.version > this.#saved.version) void this.#reload();
		});
	}

	async #reload(): Promise<void> {
		try {
			const res = await fetch('/ui/prefs');
			if (!res.ok) return;
			const doc = (await res.json()) as PersonDoc;
			if (doc.version > this.#saved.version) this.#take(doc);
		} catch {
			// The next change event tries again.
		}
	}
}

export const personal = new Personal();
