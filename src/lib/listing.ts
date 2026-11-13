/**
 * Reading a list from homeCore for a settings page, and saying why it didn't
 * come in a way a person can act on: still loading, not allowed, a homeCore
 * too old to have it, or not answering. Kept apart so that no page leaves
 * "Loading…" up for a list that was refused.
 */

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
