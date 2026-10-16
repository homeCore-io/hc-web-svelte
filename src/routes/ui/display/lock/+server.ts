/**
 * Lock a display again before its few minutes are up: the person's session
 * ends here, and the display is itself.
 */
import type { RequestHandler } from './$types';
import { clearCookies } from '#server/session.js';
import { json, secure } from '#lib/server/http.js';

export const POST: RequestHandler = async (event) =>
	json({ ok: true }, 200, clearCookies(secure(event)));
