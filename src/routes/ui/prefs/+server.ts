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
import { docs, MAX_DOC_BYTES } from '#lib/server/docs.js';

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

	const text = await event.request.text();
	if (text.length > MAX_DOC_BYTES) return json({ error: 'Too large.' }, 413, who.setCookies);
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return json({ error: 'Not JSON.' }, 400, who.setCookies);
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Expected an object.' }, 400, who.setCookies);
	}
	const { version, updated_at: _ignored, ...doc } = body as Record<string, unknown>;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
		return json({ error: 'Say which version this change was made against.' }, 400, who.setCookies);
	}

	const written = await docs().write(
		KIND,
		idOf(who.person.id),
		{ ...doc, person: who.person.id },
		version
	);
	if (!written.ok)
		return json(
			{ error: 'Changed elsewhere.', current: written.current ?? { version: 0 } },
			409,
			who.setCookies
		);
	return json(written.doc, 200, who.setCookies);
};
