/**
 * Sign in — homeCore checks the password; the UI server keeps the result.
 *
 * The password goes straight on to homeCore and is never stored here (S4).
 * What comes back is put in httpOnly cookies (`server/session.js`), and only
 * the person's profile is returned to the page.
 */
import type { RequestHandler } from './$types';
import { coreUrl } from '#server/config.js';
import { grantCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

export const POST: RequestHandler = async (event) => {
	let body: { username?: unknown; password?: unknown };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Send a username and password.' }, 400);
	}
	if (typeof body.username !== 'string' || typeof body.password !== 'string') {
		return json({ error: 'Send a username and password.' }, 400);
	}

	let res: Response;
	try {
		res = await fetch(`${coreUrl()}/api/v1/auth/login`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				// What signed in, for the person's list of sessions in homeCore.
				'user-agent': event.request.headers.get('user-agent') ?? 'homeCore app'
			},
			body: JSON.stringify({ username: body.username, password: body.password })
		});
	} catch {
		return json({ error: 'homeCore is not answering.' }, 502);
	}
	const grant = await res.json().catch(() => ({}));
	if (!res.ok || typeof grant.token !== 'string') {
		const error = res.status === 401 ? 'That username and password don’t match.' : grant.error;
		return json({ error: error ?? 'Sign-in failed.' }, res.status === 200 ? 502 : res.status);
	}
	return json({ user: grant.user }, 200, grantCookies(grant, secure(event)));
};
