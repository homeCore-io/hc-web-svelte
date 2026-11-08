/**
 * One picture (design 15): its file, or one of the smaller copies made of it
 * (`?size=tile|screen|poster`, the original where there's none); changing
 * its name, who sees it and its albums; deleting it, which takes it off
 * everywhere it's used (P4).
 *
 * Its file is for whoever may see it: everyone's to anyone signed in and to
 * displays, one of someone's own only to them.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import {
	changeLibrary,
	fileResponse,
	findUses,
	mayChange,
	parseFile,
	readLibrary,
	removeFiles,
	sees,
	shape,
	SIZES,
	takeOff,
	TYPES,
	urlOf,
	USED_IN,
	type Item,
	type Size
} from '#lib/server/library.js';
import { docs } from '#lib/server/docs.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const f = parseFile(event.params.file);
	const it = f && !f.size ? (await readLibrary()).items[f.id] : undefined;
	if (!it || it.ext !== f!.ext || !sees(it, who.person))
		return json({ error: 'No such picture.' }, 404, who.setCookies);
	const size = event.url.searchParams.get('size') as Size | null;
	const copy = size && SIZES.includes(size) ? it.sizes[size] : undefined;
	const name = copy || `${it.id}.${it.ext}`;
	const headers = new Headers({
		'content-type': TYPES[parseFile(name)!.ext],
		'x-content-type-options': 'nosniff',
		// Never changes: a new picture is a new name. A copy asked for before it
		// was made is the original for now, so that answer isn’t kept.
		'cache-control': size && !copy ? 'private, no-cache' : 'private, max-age=31536000, immutable'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return (
		(await fileResponse(event.request, name, headers)) ??
		json({ error: 'No such picture.' }, 404, who.setCookies)
	);
};

/** The picture this request names, and whether they may change it. */
async function named(file: string) {
	const f = parseFile(file);
	return f && !f.size ? (await readLibrary()).items[f.id] : undefined;
}

/** Whether it's used anywhere everyone sees: the household's pages and rooms, a display. */
async function usedShared(it: Item): Promise<boolean> {
	for (const kind of USED_IN.filter((k) => k !== 'person'))
		for (const id of await docs().ids(kind))
			if (findUses(await docs().read(kind, id), urlOf(it)).length > 0) return true;
	return false;
}

export const PATCH: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const it = await named(event.params.file);
	if (!it || !sees(it, who.person)) return json({ error: 'No such picture.' }, 404, who.setCookies);
	const body = (await event.request.json().catch(() => ({}))) as {
		name?: unknown;
		shared?: unknown;
		albums?: unknown;
	};
	// Sharing one is for its owner, or anyone putting it somewhere shared (P5);
	// the rest is for whoever may change it.
	const sharingOnly = body.shared === true && body.name === undefined && body.albums === undefined;
	if (!mayChange(it, who.person) && !(sharingOnly && it.owner === who.person.id))
		return json({ error: 'Only whoever added it can change it.' }, 403, who.setCookies);
	if (body.shared === false && it.shared && (await usedShared(it)))
		return json(
			{
				error:
					'It’s on a room, a display or a shared page, so it stays everyone’s while it’s used there.'
			},
			409,
			who.setCookies
		);
	const next = await changeLibrary((lib) => {
		const cur = lib.items[it.id];
		if (!cur) return undefined;
		if (typeof body.name === 'string') cur.name = body.name.trim().slice(0, 80) || cur.name;
		if (typeof body.shared === 'boolean') cur.shared = body.shared;
		if (Array.isArray(body.albums))
			cur.albums = [
				...new Set(
					body.albums
						.filter((a): a is string => typeof a === 'string')
						.map((a) => a.trim().slice(0, 40))
						.filter(Boolean)
				)
			].slice(0, 20);
		return cur;
	});
	if (!next) return json({ error: 'No such picture.' }, 404, who.setCookies);
	return json(shape(next, who.person), 200, who.setCookies);
};

export const DELETE: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const it = await named(event.params.file);
	if (!it || !sees(it, who.person)) return json({ error: 'No such picture.' }, 404, who.setCookies);
	// One from before the library has no owner: it's for people who edit the house.
	if (!mayChange(it, who.person))
		return json(
			{ error: 'Only whoever added it, or someone who edits the house’s pages, can delete it.' },
			403,
			who.setCookies
		);
	const changed = await takeOff(it);
	await changeLibrary((lib) => {
		delete lib.items[it.id];
		return true;
	});
	await removeFiles(it);
	return json({ deleted: it.id, changed }, 200, who.setCookies);
};
