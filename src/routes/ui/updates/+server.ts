/**
 * Newer releases of homeCore and this app, for the System page (admins only).
 * Empty when the check is turned off or GitHub can't be reached.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { latest, updatesOff } from '#lib/server/updates.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	if (updatesOff()) return json({ off: true }, 200, who.setCookies);
	return json(await latest(), 200, who.setCookies);
};
