/**
 * Displays' settings no display has any more (D7): Settings → Displays sends
 * the ids homeCore still has, and the settings of any other display are
 * removed — those of one deleted before its settings went with it.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { displayDocId } from '#lib/server/display.js';

const KIND = 'display';

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('content:write'))
		return json(
			{ error: 'Only people who may edit the house can change this.' },
			403,
			who.setCookies
		);
	const body = (await event.request.json().catch(() => null)) as { keep?: unknown } | null;
	if (!Array.isArray(body?.keep) || !body.keep.every((k) => typeof k === 'string'))
		return json({ error: 'Send the displays to keep.' }, 400, who.setCookies);
	const keep = new Set((body.keep as string[]).map(displayDocId));
	let removed = 0;
	for (const id of await docs().ids(KIND))
		if (!keep.has(id) && (await docs().remove(KIND, id))) removed++;
	return json({ removed }, 200, who.setCookies);
};
