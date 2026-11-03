/**
 * A file an extension's element draws with: only one its manifest names.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { extensionFile } from '#lib/server/extensions.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const bytes = await extensionFile(event.params.id, event.params.file);
	if (!bytes) return json({ error: 'No such file.' }, 404, who.setCookies);
	const headers = new Headers({
		'content-type': 'application/octet-stream',
		'cache-control': 'private, no-cache'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return new Response(bytes, { status: 200, headers });
};
