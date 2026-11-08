/** A picture someone put on a page (14 §6), for whoever's signed in. */
import type { RequestHandler } from './$types';
import { bytesResponse, json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { picture } from '#lib/server/pictures.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const p = await picture(event.params.file);
	if (!p) return json({ error: 'No such picture.' }, 404, who.setCookies);
	const headers = new Headers({
		'content-type': p.type,
		'x-content-type-options': 'nosniff',
		// Never changes: a new picture is a new name.
		'cache-control': 'private, max-age=31536000, immutable'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return bytesResponse(event.request, p.bytes, headers);
};
