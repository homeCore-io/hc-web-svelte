/**
 * The UI server's own documents (M1), backed up and put back (A6): the
 * household's Home and look, displays' pages, and each person's Home, phone
 * bar and preferences. homeCore's backup doesn't hold them — they live here.
 *
 * Admins only (`users:write`). Putting back replaces each document named in
 * the backup and leaves any others alone.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';

const KINDS = ['house', 'display', 'person'];
const FORMAT = 'hc-web-backup';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	const out: Record<string, Record<string, unknown>> = {};
	for (const kind of KINDS) {
		out[kind] = {};
		for (const id of await docs().ids(kind)) {
			const doc = await docs().read(kind, id);
			if (doc) out[kind][id] = doc;
		}
	}
	return json(
		{ format: FORMAT, version: 1, taken_at: new Date().toISOString(), docs: out },
		200,
		who.setCookies
	);
};

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	const body = (await event.request.json().catch(() => null)) as {
		format?: unknown;
		docs?: Record<string, Record<string, Record<string, unknown>>>;
	} | null;
	if (!body || body.format !== FORMAT || typeof body.docs !== 'object' || body.docs === null)
		return json({ error: 'That isn’t a backup of this app.' }, 400, who.setCookies);

	let restored = 0;
	for (const kind of KINDS) {
		for (const [id, doc] of Object.entries(body.docs[kind] ?? {})) {
			if (!doc || typeof doc !== 'object') continue;
			const { version: _v, updated_at: _u, ...rest } = doc;
			// Over whatever is there now, whatever its version.
			for (let attempt = 0; attempt < 3; attempt++) {
				const current = await docs()
					.read(kind, id)
					.catch(() => undefined);
				const written = await docs()
					.write(kind, id, rest, current?.version ?? 0)
					.catch(() => ({ ok: false as const }));
				if (written.ok) {
					restored++;
					break;
				}
			}
		}
	}
	return json({ restored }, 200, who.setCookies);
};
