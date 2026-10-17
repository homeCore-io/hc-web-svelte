/**
 * After homeCore removes a person (A5), the UI server's own document for them
 * goes too: their Home, phone bar and preferences. Rules, scenes and shared
 * pages they made are the house's and stay.
 *
 * Takes homeCore's `users:write`, and only acts once homeCore says the person
 * is gone — a request can't delete someone's Home by naming them.
 */
import type { RequestHandler } from './$types';
import { json, secure } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DELETE: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	const id = event.params.id.toLowerCase();
	if (!UUID.test(id)) return json({ error: 'Name a person.' }, 400, who.setCookies);

	// homeCore's word that they're gone.
	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	let people: { id: string }[];
	try {
		const res = await fetch(`${coreUrl()}/api/v1/auth/users`, {
			headers: { authorization: `Bearer ${session?.token ?? ''}` }
		});
		if (!res.ok) throw new Error(String(res.status));
		people = (await res.json()) as { id: string }[];
	} catch {
		return json({ error: 'homeCore is not answering.' }, 502, who.setCookies);
	}
	if (people.some((p) => p.id.toLowerCase() === id))
		return json({ error: 'homeCore still has them.' }, 409, who.setCookies);

	const removed = await docs().remove('person', id);
	return json({ removed }, 200, who.setCookies);
};
