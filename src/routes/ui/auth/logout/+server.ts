import type { RequestHandler } from './$types';
import { coreUrl } from '#server/config.js';
import { REFRESH, clearCookies, parseCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

/**
 * Sign out: homeCore ends the session (core 0.1.84 — its tokens stop working
 * at once), then the cookies are forgotten. An older homeCore has no logout
 * and says 404; forgetting the cookies is then all there is.
 */
export const POST: RequestHandler = async (event) => {
	const refresh = parseCookies(event.request.headers.get('cookie'))[REFRESH];
	if (refresh) {
		try {
			await fetch(`${coreUrl()}/api/v1/auth/logout`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ refresh_token: refresh }),
				signal: AbortSignal.timeout(5000)
			});
		} catch {
			// homeCore away: the cookies still go.
		}
	}
	return json({ ok: true }, 200, clearCookies(secure(event)));
};
