/**
 * Unlock a display with a person's PIN (H5, N9): homeCore names the person
 * and gives a token that lasts a few minutes, with no refresh token. It goes
 * in the access cookie for exactly that long, so when it runs out the
 * display is itself again — on the server, whatever the page does.
 */
import type { RequestHandler } from './$types';
import { coreUrl } from '#server/config.js';
import { DISPLAY, parseCookies, unlockCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

export const POST: RequestHandler = async (event) => {
	const key = parseCookies(event.request.headers.get('cookie'))[DISPLAY];
	if (!key) return json({ error: 'This browser is not a display.' }, 403);
	const body = (await event.request.json().catch(() => ({}))) as { pin?: unknown };
	const pin = typeof body.pin === 'string' ? body.pin : '';

	let res: Response;
	try {
		res = await fetch(`${coreUrl()}/api/v1/auth/pin-session`, {
			method: 'POST',
			headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
			body: JSON.stringify({ pin })
		});
	} catch {
		return json({ error: 'homeCore is not answering.' }, 502);
	}
	const answer = (await res.json().catch(() => ({}))) as {
		token?: string;
		expires_in?: number;
		user?: unknown;
		error?: string;
		retry_after_seconds?: number;
	};
	if (!res.ok || typeof answer.token !== 'string') {
		return json(
			{ error: answer.error ?? 'That PIN isn’t right.', retry_after: answer.retry_after_seconds },
			res.ok ? 502 : res.status
		);
	}
	const seconds = answer.expires_in ?? 300;
	return json(
		{ user: answer.user, expires_in: seconds },
		200,
		unlockCookies(answer.token, seconds, secure(event))
	);
};
