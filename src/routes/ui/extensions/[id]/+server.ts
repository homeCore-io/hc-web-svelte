/**
 * One installed UI extension: `DELETE` removes it. A look that chose one of
 * its drawings draws those things as Classic does again (13 U5).
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { admin } from '#lib/server/extensionAdmin.js';
import { remove } from '#lib/server/extensionStore.js';

export const DELETE: RequestHandler = async (event) => {
	const a = await admin(event);
	if ('fail' in a) return a.fail!;
	return (await remove(event.params.id))
		? json({ ok: true }, 200, a.who.setCookies)
		: json({ error: 'No such extension.' }, 404, a.who.setCookies);
};
