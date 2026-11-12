/**
 * A person's photo, as their picture (`avatars.ts`): to anyone signed in and
 * to displays, though the library may keep the picture theirs alone. Only the
 * one their own document names, and only one they could choose.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { fileResponse, parseFile, readLibrary, TYPES } from '#lib/server/library.js';
import { avatarFile, avatarPicture, personIdOf } from '#lib/server/avatars.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const id = personIdOf(event.params.id);
	const doc = id ? await docs().read('person', id) : undefined;
	const it = avatarPicture(id, doc, (await readLibrary()).items);
	if (!it) return json({ error: 'No such picture.' }, 404, who.setCookies);
	const name = avatarFile(it);
	const headers = new Headers({
		'content-type': TYPES[parseFile(name)!.ext],
		'x-content-type-options': 'nosniff',
		// Its address names the picture (`?v=`), so a new one is a new address.
		'cache-control': 'private, max-age=86400'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return (
		(await fileResponse(event.request, name, headers)) ??
		json({ error: 'No such picture.' }, 404, who.setCookies)
	);
};
