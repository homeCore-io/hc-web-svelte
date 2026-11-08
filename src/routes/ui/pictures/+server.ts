/**
 * The pictures library (design 15, P2): what this person may see, each with
 * where it's used, and adding one. The body of a `POST` is the file, a
 * picture up to 20 MB or a video up to 200 MB; `?name=` names it, and
 * `?shared=1` makes it everyone's from the start (else it's theirs alone).
 * A display looks, and adds nothing (P8).
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import {
	changeLibrary,
	keepUpload,
	MAX_VIDEO_BYTES,
	readLibrary,
	sees,
	shape,
	urlOf,
	usesOf,
	type Item
} from '#lib/server/library.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const lib = await readLibrary();
	const items = Object.values(lib.items)
		.filter((it) => sees(it, who.person))
		.sort((a, b) => b.at.localeCompare(a.at));
	const uses = await usesOf(items, who.person);
	return json(
		{
			items: items.map((it) => ({ ...shape(it, who.person), ...uses.get(it.id) })),
			albums: [...new Set(items.flatMap((it) => it.albums))].sort()
		},
		200,
		who.setCookies
	);
};

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (who.person.display)
		return json({ error: 'A display can’t add pictures.' }, 403, who.setCookies);
	if (Number(event.request.headers.get('content-length') ?? 0) > MAX_VIDEO_BYTES)
		return json({ error: 'It’s larger than 200 MB.' }, 413, who.setCookies);
	const kept = await keepUpload(event.request.body);
	if (!kept.ok) return json({ error: kept.error }, kept.status, who.setCookies);
	const q = event.url.searchParams;
	const it: Item = {
		id: kept.id,
		ext: kept.ext,
		name: (q.get('name') ?? '').trim().slice(0, 80) || 'Picture',
		kind: kept.ext === 'mp4' || kept.ext === 'webm' ? 'video' : 'picture',
		bytes: kept.bytes,
		owner: who.person.id,
		by: who.person.username,
		at: new Date().toISOString(),
		shared: q.get('shared') === '1',
		albums: [],
		sizes: {}
	};
	await changeLibrary((lib) => {
		lib.items[it.id] = it;
		return true;
	});
	return json(
		{ ...shape(it, who.person), url: urlOf(it), uses: [], elsewhere: 0 },
		200,
		who.setCookies
	);
};
