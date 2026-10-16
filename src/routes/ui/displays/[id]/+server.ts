/**
 * A display's settings, for Settings → Displays (D7): which pages it shows
 * and how it behaves as a kiosk. Presentation, so the UI server keeps them
 * (M1), keyed by the display's id in homeCore. Writing takes
 * `content:write`, as the household's pages do.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs, incoming } from '#lib/server/docs.js';
import { displayDocId } from '#lib/server/display.js';

const KIND = 'display';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const doc = (await docs().read(KIND, displayDocId(event.params.id))) ?? { version: 0 };
	return json(doc, 200, who.setCookies);
};

export const PUT: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('content:write'))
		return json(
			{ error: 'Only people who may edit the house can change this.' },
			403,
			who.setCookies
		);
	const body = await incoming(event.request);
	if (!body.ok) return json({ error: body.error }, body.status, who.setCookies);
	const written = await docs().write(KIND, displayDocId(event.params.id), body.doc, body.version);
	if (!written.ok)
		return json(
			{ error: 'Changed elsewhere.', current: written.current ?? { version: 0 } },
			409,
			who.setCookies
		);
	return json(written.doc, 200, who.setCookies);
};
