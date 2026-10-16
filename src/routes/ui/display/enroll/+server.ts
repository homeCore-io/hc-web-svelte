/**
 * Make this browser a display (H3, D7): an admin made the display in
 * Settings and was shown its key once; it is typed here, on the tablet. The
 * key is checked with homeCore and kept in an httpOnly cookie — page scripts
 * never hold it — and any person's session in this browser ends.
 */
import type { RequestHandler } from './$types';
import { displayCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';
import { displayFor } from '#lib/server/display.js';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { key?: unknown };
	const key = typeof body.key === 'string' ? body.key.trim() : '';
	if (!/^hc_sk_[A-Za-z0-9_-]{20,}$/.test(key))
		return json({ error: "That doesn't look like a display key." }, 400);

	const display = await displayFor(key);
	if (display === 'unreachable') return json({ error: 'homeCore is not answering.' }, 502);
	if (display === null) return json({ error: 'homeCore doesn’t know that key as a display.' }, 401);
	return json({ display }, 200, displayCookies(key, secure(event)));
};
