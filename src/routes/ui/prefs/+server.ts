/**
 * A person's own preferences and personal layers (M2–M4, N2, V2): one
 * document per person, which only they read or write.
 *
 * `PUT` carries the version the change was made against; if the document has
 * moved on (their other phone wrote first), the answer is 409 with the
 * current document, and the app reapplies its change to that.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs, incoming } from '#lib/server/docs.js';

const KIND = 'person';

/** homeCore's user ids are UUIDs; the store's own check is the backstop. */
const idOf = (id: string) => id.toLowerCase().replace(/[^0-9a-f-]/g, '');

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const doc = (await docs().read(KIND, idOf(who.person.id))) ?? { version: 0 };
	return json(doc, 200, who.setCookies);
};

export const PUT: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);

	const body = await incoming(event.request);
	if (!body.ok) return json({ error: body.error }, body.status, who.setCookies);

	const written = await docs().write(
		KIND,
		idOf(who.person.id),
		{ ...body.doc, person: who.person.id },
		body.version
	);
	if (!written.ok)
		return json(
			{ error: 'Changed elsewhere.', current: written.current ?? { version: 0 } },
			409,
			who.setCookies
		);
	return json(written.doc, 200, who.setCookies);
};
