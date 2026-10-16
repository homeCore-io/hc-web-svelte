/**
 * Who is signed in, and what they may do — homeCore's answer (S4).
 *
 * Also where an expired access token gets refreshed when the app starts, so
 * the event stream it opens next has a good one to carry.
 */
import type { RequestHandler } from './$types';
import { coreUrl } from '#server/config.js';
import { expiresAt, resolveSession } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';
import { displayFor } from '#lib/server/display.js';

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
	const me = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	// A person unlocked on a display (H5): say which display, so the app can
	// show it is only for a few minutes, and lock again.
	if (res.ok && session.display !== undefined && session.token !== session.display) {
		const display = await displayFor(session.display);
		if (display !== 'unreachable' && display !== null)
			me.unlocked_on = { ...display, until: expiresAt(session.token) };
	}
	return json(me, res.status, session.setCookies);
};
