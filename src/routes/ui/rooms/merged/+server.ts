/**
 * After homeCore merges one room into another (H1), the UI server's own
 * documents follow: everything that pointed at the merged room — its place
 * and icon in the household's document, displays' pages, each person's
 * phone bar and edits — points at the room it went into (`remapRoom`).
 *
 * Takes homeCore's `areas:write`, and only acts once homeCore says the merge
 * happened: the first room is gone and the second is there. A request can't
 * scramble anyone's pages by naming rooms that weren't merged.
 */
import type { RequestHandler } from './$types';
import { json, secure } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';
import { remapRoom } from '#lib/remap.js';

const KINDS = ['house', 'display', 'person'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('areas:write'))
		return json({ error: 'Only people who may change rooms can do this.' }, 403, who.setCookies);

	const body = (await event.request.json().catch(() => ({}))) as { from?: unknown; into?: unknown };
	const from = typeof body.from === 'string' ? body.from : '';
	const into = typeof body.into === 'string' ? body.into : '';
	if (!UUID.test(from) || !UUID.test(into) || from === into)
		return json({ error: 'Name two different rooms.' }, 400, who.setCookies);

	// homeCore's word that the merge happened.
	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	let rooms: { id: string }[];
	try {
		const res = await fetch(`${coreUrl()}/api/v1/areas`, {
			headers: { authorization: `Bearer ${session?.token ?? ''}` }
		});
		if (!res.ok) throw new Error(String(res.status));
		rooms = (await res.json()) as { id: string }[];
	} catch {
		return json({ error: 'homeCore is not answering.' }, 502, who.setCookies);
	}
	if (rooms.some((r) => r.id === from) || !rooms.some((r) => r.id === into))
		return json({ error: 'homeCore hasn’t merged those rooms.' }, 409, who.setCookies);

	let changed = 0;
	for (const kind of KINDS) {
		for (const id of await docs().ids(kind)) {
			// Another write may land between read and write; try again on that.
			for (let attempt = 0; attempt < 3; attempt++) {
				const doc = await docs().read(kind, id);
				if (!doc) break;
				const { version, updated_at: _at, ...rest } = doc;
				const next = remapRoom(rest, from, into) as Record<string, unknown>;
				if (JSON.stringify(next) === JSON.stringify(rest)) break;
				const written = await docs().write(kind, id, next, version);
				if (written.ok) {
					changed++;
					break;
				}
			}
		}
	}
	return json({ changed }, 200, who.setCookies);
};
