/**
 * People and access's calls to homeCore (A5): accounts, roles, passwords,
 * PINs and API keys; and, after removing someone, the UI server's own
 * document for them.
 */
import type { ApiKey, Person, RoleInfo } from './people.js';

export type Answer<T> =
	{ ok: true; data: T } | { ok: false; error: string; status?: number; body?: unknown };

async function call<T>(method: string, path: string, body?: unknown): Promise<Answer<T>> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		return { ok: false, error: 'homeCore is not answering.' };
	}
	const text = await res.text();
	let data: unknown = text;
	try {
		data = text === '' ? null : JSON.parse(text);
	} catch {
		// homeCore's own words, as text.
	}
	if (res.ok) return { ok: true, data: data as T };
	const said = data as { error?: unknown } | null;
	// A wrong current password is a 401 too — homeCore's words say which.
	if (res.status === 403 || (res.status === 401 && typeof said?.error !== 'string'))
		return { ok: false, error: "You aren't allowed to do this.", status: res.status };
	return {
		ok: false,
		status: res.status,
		body: data,
		error:
			typeof said?.error === 'string'
				? said.error
				: typeof data === 'string' && data.trim()
					? data.trim()
					: `homeCore said no (${res.status}).`
	};
}

const one = (id: string) => `/plugins/${encodeURIComponent(id)}`;

const user = (id: string) => `/auth/users/${encodeURIComponent(id)}`;

export const loadPeople = () => call<Person[]>('GET', '/auth/users');
export const loadRoles = () => call<RoleInfo[]>('GET', '/auth/roles');

export const addPerson = (username: string, password: string, role: string) =>
	call<Person>('POST', '/auth/users', { username, password, role });

/** Ends their sessions on a homeCore that has A5; they sign in again. */
export const setRole = (id: string, role: string) =>
	call<Person>('PATCH', `${user(id)}/role`, { role });

/** Signs them out everywhere. */
export const setPassword = (id: string, password: string) =>
	call<null>('PATCH', `${user(id)}/password`, { password });

/** So they can choose another on Me. */
export const clearPin = (id: string) => call<null>('DELETE', `${user(id)}/pin`);

/** Removes them from homeCore, then their Home and preferences from the UI server. */
export async function removePerson(id: string): Promise<Answer<{ removed: boolean }>> {
	const gone = await call<null>('DELETE', user(id));
	if (!gone.ok) return gone;
	const res = await fetch(`/ui/people/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
		() => null
	);
	if (!res?.ok)
		return {
			ok: false,
			error: 'They’re removed from homeCore, but their own Home couldn’t be tidied away.'
		};
	return { ok: true, data: (await res.json()) as { removed: boolean } };
}

/** When each person last did anything homeCore records, by their id. */
export async function lastActive(people: Person[]): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	await Promise.all(
		people.map(async (p) => {
			const r = await call<{ ts: string }[]>(
				'GET',
				`/audit?actor_id=${encodeURIComponent(p.id)}&limit=1`
			);
			if (r.ok && r.data[0]) out[p.id] = r.data[0].ts;
		})
	);
	return out;
}

/** Change your own password. Every session ends, this one too. */
export const changeMyPassword = (current_password: string, new_password: string) =>
	call<null>('POST', '/auth/change-password', { current_password, new_password });

// ---- keys ----

const key = (id: string) => `/auth/api-keys/${encodeURIComponent(id)}`;

export const loadKeys = () => call<ApiKey[]>('GET', '/auth/api-keys');

export const makeKey = (body: {
	label: string;
	scopes: string[];
	expires_in_days?: number;
	owner_uid?: string;
	allowed_cidrs?: string[];
}) => call<ApiKey & { token: string }>('POST', '/auth/api-keys', body);

export const editKey = (
	id: string,
	body: { label?: string; scopes?: string[]; expires_in_days?: number; allowed_cidrs?: string[] }
) => call<ApiKey>('PATCH', key(id), body);

export const revokeKey = (id: string) => call<null>('DELETE', key(id));

/** A new secret for the same key; the old one stops working. */
export const rotateKey = (id: string) => call<{ token: string }>('POST', `${key(id)}/rotate`);
