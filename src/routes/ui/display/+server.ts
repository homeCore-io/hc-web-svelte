/**
 * This display's own settings (D7, M5): its pages and kiosk behaviour, as an
 * admin set them in Settings → Displays. Read by the display itself, so it
 * answers for the display key in this browser — even while a person is
 * unlocked on it.
 */
import type { RequestHandler } from './$types';
import { DISPLAY, parseCookies } from '#server/session.js';
import { json } from '#lib/server/http.js';
import { docs } from '#lib/server/docs.js';
import { displayDocId, displayFor } from '#lib/server/display.js';

export const GET: RequestHandler = async (event) => {
	const key = parseCookies(event.request.headers.get('cookie'))[DISPLAY];
	if (!key) return json({ error: 'This browser is not a display.' }, 404);
	const display = await displayFor(key);
	if (display === 'unreachable') return json({ error: 'homeCore is not answering.' }, 502);
	if (display === null) return json({ error: 'This display was removed.' }, 401);
	const doc = (await docs().read('display', displayDocId(display.id))) ?? { version: 0 };
	return json({ ...doc, id: display.id, name: display.name });
};
