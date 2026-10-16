/**
 * Which display a browser is (H3), from the key in its display cookie —
 * homeCore's answer, cached for a minute like a person's (`identity.ts`).
 */
import { coreUrl } from '#server/config.js';

export interface DisplayIdentity {
	id: string;
	name: string;
}

const TTL_MS = 60_000;
const known = new Map<string, { display: DisplayIdentity | null; at: number }>();

/** The display this key is, or null if homeCore says it isn't one (any more). */
export async function displayFor(key: string): Promise<DisplayIdentity | null | 'unreachable'> {
	const now = Date.now();
	for (const [k, v] of known) if (now - v.at > TTL_MS) known.delete(k);
	const cached = known.get(key);
	if (cached) return cached.display;

	let res: Response;
	try {
		res = await fetch(`${coreUrl()}/api/v1/auth/me`, {
			headers: { authorization: `Bearer ${key}` }
		});
	} catch {
		return 'unreachable';
	}
	const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	const display =
		res.ok && body.kind === 'display' && typeof body.id === 'string'
			? { id: body.id, name: String(body.username ?? '') }
			: null;
	known.set(key, { display, at: now });
	return display;
}

/** The store's id for a display's settings: its id, which is a UUID. */
export const displayDocId = (id: string) => id.toLowerCase().replace(/[^0-9a-f-]/g, '');
