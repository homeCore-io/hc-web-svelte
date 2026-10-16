import type { RequestHandler } from './$types';
import { clearCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

/** Sign out: forget the session's cookies. */
export const POST: RequestHandler = async (event) =>
	json({ ok: true }, 200, clearCookies(secure(event)));
