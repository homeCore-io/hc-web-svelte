/**
 * The UI extensions in the data directory (lib/server/extensions.ts): their
 * elements, for the look editor and for whatever a look draws with them.
 * Everyone signed in reads them, as they read the looks.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { listExtensions } from '#lib/server/extensions.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	return json({ extensions: await listExtensions() }, 200, who.setCookies);
};
