/**
 * Who a `/ui/…` request is from — homeCore's answer, never the UI server's own
 * (S4). Cached for a minute per token, so a page's burst of requests asks
 * homeCore once.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';
import { secure } from './http.js';

export interface Person {
	id: string;
	username: string;
	role: string;
	scopes: string[];
}

export type Identity =
	| { ok: true; person: Person; setCookies: string[] }
	| { ok: false; status: number; error: string; setCookies: string[] };

const TTL_MS = 60_000;
const known = new Map<string, { person: Person; at: number }>();

export async function whoIs(event: RequestEvent): Promise<Identity> {
	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	if (session === undefined)
		return { ok: false, status: 401, error: 'Not signed in.', setCookies: [] };
	const { token, setCookies } = session;

	const now = Date.now();
	for (const [k, v] of known) if (now - v.at > TTL_MS) known.delete(k);
	const cached = known.get(token);
	if (cached) return { ok: true, person: cached.person, setCookies };

	let res: Response;
	try {
		res = await fetch(`${coreUrl()}/api/v1/auth/me`, {
			headers: { authorization: `Bearer ${token}` }
		});
	} catch {
		return { ok: false, status: 502, error: 'homeCore is not answering.', setCookies };
	}
	const body = (await res.json().catch(() => ({}))) as Partial<Person>;
	if (!res.ok || typeof body.id !== 'string') {
		return { ok: false, status: res.ok ? 502 : res.status, error: 'Not signed in.', setCookies };
	}
	const person: Person = {
		id: body.id,
		username: String(body.username ?? ''),
		role: String(body.role ?? ''),
		scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : []
	};
	known.set(token, { person, at: now });
	return { ok: true, person, setCookies };
}
