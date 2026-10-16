/**
 * The household's shared edits and presentation settings (D6, M1): its
 * changes to the generated home and rooms, room icons, the default phone bar,
 * the theme, confirmation overrides. One document for the house.
 *
 * Everyone signed in reads it — it is how the house looks. Writing takes
 * homeCore's `content:write`, its scope for authoring how the house presents
 * itself, judged by homeCore's answer and never by the role's name (S4).
 * Saving works as for a person's own document: a stale version gets 409 and
 * the current document, and the app makes its change again on top.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs, incoming } from '#lib/server/docs.js';

const KIND = 'house';
const ID = 'household';
const WRITE_SCOPE = 'content:write';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const doc = (await docs().read(KIND, ID)) ?? { version: 0 };
	return json(doc, 200, who.setCookies);
};

export const PUT: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes(WRITE_SCOPE)) {
		return json(
			{ error: 'Only people who may edit the house can change this.' },
			403,
			who.setCookies
		);
	}

	const body = await incoming(event.request);
	if (!body.ok) return json({ error: body.error }, body.status, who.setCookies);

	const written = await docs().write(
		KIND,
		ID,
		{ ...body.doc, changed_by: who.person.username },
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
