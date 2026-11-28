/**
 * homeCore's rotations, kept current from `rotation_changed`,
 * `rotation_removed` and `rotation_advanced`. Each event refetches the one
 * rotation it names, which brings what plays now with it.
 */
import { live } from './live.svelte.js';
import type { Rotation, RotationDraft } from './rotations.js';

/** Why a call failed, in a few words. */
function why(status: number, said?: string): string {
	if (said) return said;
	if (status === 401) return 'You are signed out.';
	if (status === 403) return 'You aren’t allowed to.';
	if (status === 404) return 'That rotation is gone.';
	return 'homeCore said no.';
}

async function call(
	url: string,
	init?: RequestInit
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
	try {
		const res = await fetch(url, {
			...init,
			headers: init?.body ? { 'content-type': 'application/json' } : undefined
		});
		const text = await res.text();
		let data: unknown = null;
		try {
			data = text ? JSON.parse(text) : null;
		} catch {
			// Not JSON; the status says enough.
		}
		if (res.ok) return { ok: true, data };
		const said = (data as { error?: string } | null)?.error;
		return { ok: false, error: why(res.status, said) };
	} catch {
		return { ok: false, error: 'homeCore isn’t answering.' };
	}
}

class Rotations {
	list = $state<Rotation[]>([]);
	loaded = $state(false);
	failed = $state<string | null>(null);
	#unfollow: (() => void) | null = null;
	/** Counts loads and changes, so an answer knows what came after it. */
	#seq = 0;
	/** The newest load started; an older one's answer is dropped. */
	#loading = 0;
	/** When each rotation was last changed or removed here, by `#seq`. */
	#touched = new Map<string, number>();

	async load(): Promise<void> {
		this.#follow();
		const seq = ++this.#seq;
		this.#loading = seq;
		const r = await call('/api/v1/rotations');
		// A later load is on its way: its answer is the newer one.
		if (this.#loading !== seq) return;
		if (r.ok) {
			// A rotation changed or removed here since this load asked (a
			// Play's refetch, an event) is as it is now, not as it answered.
			const newer = (id: string) => (this.#touched.get(id) ?? 0) > seq;
			const kept = this.list.filter((x) => newer(x.id));
			const fresh = (r.data as Rotation[]).filter((x) => !newer(x.id));
			this.list = sorted([...fresh, ...kept]);
			this.failed = null;
		} else this.failed = r.error;
		this.loaded = true;
	}

	byId(id: string): Rotation | undefined {
		return this.list.find((r) => r.id === id);
	}

	/** The saved rotation, or why not. */
	async save(id: string | null, draft: RotationDraft): Promise<Rotation | string> {
		const r = await call(id ? `/api/v1/rotations/${encodeURIComponent(id)}` : '/api/v1/rotations', {
			method: id ? 'PUT' : 'POST',
			body: JSON.stringify(draft)
		});
		if (!r.ok) return r.error;
		const saved = r.data as Rotation;
		this.#put(saved);
		return saved;
	}

	async remove(id: string): Promise<true | string> {
		const r = await call(`/api/v1/rotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!r.ok) return r.error;
		this.#touched.set(id, ++this.#seq);
		this.list = this.list.filter((x) => x.id !== id);
		return true;
	}

	/** Plays the choice for now; what played, or why not. */
	async play(id: string): Promise<{ played: string; missing: number[] } | string> {
		const r = await call(`/api/v1/rotations/${encodeURIComponent(id)}/play`, { method: 'POST' });
		if (!r.ok) return r.error;
		void this.#refetch(id);
		return r.data as { played: string; missing: number[] };
	}

	/** Moves it on without playing; what plays next time, or why not. */
	async advance(id: string): Promise<{ current_name: string } | string> {
		const r = await call(`/api/v1/rotations/${encodeURIComponent(id)}/advance`, {
			method: 'POST'
		});
		if (!r.ok) return r.error;
		void this.#refetch(id);
		return r.data as { current_name: string };
	}

	#put(r: Rotation): void {
		this.#touched.set(r.id, ++this.#seq);
		this.list = sorted([...this.list.filter((x) => x.id !== r.id), r]);
	}

	async #refetch(id: string): Promise<void> {
		const r = await call(`/api/v1/rotations/${encodeURIComponent(id)}`);
		if (r.ok) this.#put(r.data as Rotation);
	}

	#follow(): void {
		this.#unfollow ??= live.listen((frame) => {
			const f = frame as { type: string; rotation?: Rotation; rotation_id?: string };
			// Each connect starts with a snapshot, which has no rotations: one
			// after a dropped connection means rotation events were missed.
			if (f.type === 'snapshot' && this.loaded) void this.load();
			else if (f.type === 'rotation_changed' && f.rotation) void this.#refetch(f.rotation.id);
			else if (f.type === 'rotation_advanced' && f.rotation_id) void this.#refetch(f.rotation_id);
			else if (f.type === 'rotation_removed' && f.rotation_id) {
				this.#touched.set(f.rotation_id, ++this.#seq);
				this.list = this.list.filter((x) => x.id !== f.rotation_id);
			}
		});
	}
}

function sorted(list: Rotation[]): Rotation[] {
	return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

export const rotations = new Rotations();
