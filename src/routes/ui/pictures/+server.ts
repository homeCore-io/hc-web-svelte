/**
 * A picture for a page (14 §6): the body is the image. Anyone signed in may
 * add one, for their own pages as for the household's. Up to 8 MB.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { keep, MAX_PICTURE_BYTES } from '#lib/server/pictures.js';

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const tooBig = () => json({ error: 'It’s larger than 8 MB.' }, 413, who.setCookies);
	if (Number(event.request.headers.get('content-length') ?? 0) > MAX_PICTURE_BYTES) return tooBig();
	const bytes = new Uint8Array(await event.request.arrayBuffer());
	if (bytes.length > MAX_PICTURE_BYTES) return tooBig();
	const name = await keep(bytes);
	if (!name)
		return json({ error: 'That isn’t a PNG, JPEG, WebP or GIF picture.' }, 415, who.setCookies);
	return json({ url: `/ui/pictures/${name}` }, 200, who.setCookies);
};
