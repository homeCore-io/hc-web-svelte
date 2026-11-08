/**
 * A smaller copy of a picture (P7), made by the app when it was added: a
 * tile for the library, a screen's width, a video's first frame. Only a
 * picture of ours, up to 4 MB, and only from whoever may change it.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import {
	changeLibrary,
	keepSize,
	mayChange,
	MAX_SIZE_BYTES,
	parseFile,
	readLibrary,
	SIZES,
	type Size
} from '#lib/server/library.js';

export const PUT: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const size = event.params.size as Size;
	if (!SIZES.includes(size)) return json({ error: 'No such size.' }, 404, who.setCookies);
	const f = parseFile(event.params.file);
	const it = f && !f.size ? (await readLibrary()).items[f.id] : undefined;
	if (!it || (!mayChange(it, who.person) && it.owner !== who.person.id))
		return json({ error: 'No such picture.' }, 404, who.setCookies);
	if (Number(event.request.headers.get('content-length') ?? 0) > MAX_SIZE_BYTES)
		return json({ error: 'Too large.' }, 413, who.setCookies);
	const bytes = new Uint8Array(await event.request.arrayBuffer());
	if (bytes.length > MAX_SIZE_BYTES) return json({ error: 'Too large.' }, 413, who.setCookies);
	const name = await keepSize(it, size, bytes);
	if (!name) return json({ error: 'That isn’t a picture.' }, 415, who.setCookies);
	await changeLibrary((lib) => {
		const cur = lib.items[it.id];
		if (!cur) return undefined;
		cur.sizes = { ...cur.sizes, [size]: name };
		return true;
	});
	return json({ ok: true }, 200, who.setCookies);
};
