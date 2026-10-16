/**
 * Who is signed in, and what they may do — homeCore's answer (S4).
 *
 * Also where an expired access token gets refreshed when the app starts, so
 * the event stream it opens next has a good one to carry.
 */
import type { RequestHandler } from './$types';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

export const GET: RequestHandler = async (event) => {
	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	if (session === undefined) return json({ error: 'Not signed in.' }, 401);

	let res: Response;
	try {
		res = await fetch(`${coreUrl()}/api/v1/auth/me`, {
			headers: { authorization: `Bearer ${session.token}` }
		});
	} catch {
		return json({ error: 'homeCore is not answering.' }, 502, session.setCookies);
	}
	const me = await res.json().catch(() => ({}));
	return json(me, res.status, session.setCookies);
};
