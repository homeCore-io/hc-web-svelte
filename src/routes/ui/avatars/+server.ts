/**
 * Everyone's pictures (the PhotoAvatar board): how each person in the
 * household shows, for anyone signed in and for displays. Only the picture
 * comes from each person's own document; the rest of it stays theirs.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { readLibrary } from '#lib/server/library.js';
import { avatarEntry } from '#lib/server/avatars.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const { items } = await readLibrary();
	const people = [];
	for (const id of await docs().ids('person'))
		people.push(avatarEntry(id, await docs().read('person', id), items));
	return json({ people }, 200, who.setCookies);
};
