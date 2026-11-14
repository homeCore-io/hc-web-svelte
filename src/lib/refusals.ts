/**
 * What homeCore refuses, said so a person can act on it: a list that didn't
 * come (still loading, not allowed, a homeCore too old to have it, or not
 * answering), and an admin page this sign-in can't open. Kept out of Home's
 * code, for settings pages, so that none leaves "Loading…" up for a list that
 * was refused.
 */
import { session } from './me.svelte.js';

export type Listed<T> = { ok: true; value: T } | { ok: false; status: number | null };

/** GET `/api/v1{path}`: the parsed body, or the status it failed with (`null`: no answer). */
export async function listOf<T>(path: string): Promise<Listed<T>> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`);
	} catch {
		return { ok: false, status: null };
	}
	if (!res.ok) return { ok: false, status: res.status };
	try {
		return { ok: true, value: (await res.json()) as T };
	} catch {
		return { ok: false, status: res.status };
	}
}

/**
 * Why `what` (a plural, "displays") couldn't be read, in words. A 404 means a
 * homeCore older than `since`, when the page knows which version brought it.
 */
export function refusal(status: number | null, what: string, since?: string): string {
	if (status === null) return 'homeCore isn’t answering. Try again in a moment.';
	if (status === 401 || status === 403) return `This sign-in can’t see ${what}.`;
	if (status === 404 && since)
		return `This homeCore doesn’t have ${what} yet. It needs v${since} or later.`;
	return `homeCore couldn’t list ${what} (error ${status}).`;
}

/** An admin's sign-in that homeCore won't treat as one: a key without `users:write`. */
export const adminKeyOnly = () => session.me?.role === 'admin' && !session.isAdmin;

/**
 * Why an admin page isn't shown: `plain` for someone who isn't an admin, and
 * for an admin's limited key, that this sign-in can't `verb` and why.
 */
export function notAdmin(plain: string, verb: string): string {
	return adminKeyOnly()
		? `This sign-in can’t ${verb}. It uses a key without admin rights; sign in with your password, or use a key that has the users:write scope.`
		: plain;
}
