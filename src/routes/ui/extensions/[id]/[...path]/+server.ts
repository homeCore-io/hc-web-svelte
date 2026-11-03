/**
 * One of an installed extension's files (lib/server/extensions.ts): its
 * drawing's `.riv`, or a code element's module and what it imports. Typed by
 * its name, never sniffed.
 */
import type { RequestHandler } from './$types';
import { bytesResponse, json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { extensionFile } from '#lib/server/extensions.js';

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const file = await extensionFile(event.params.id, event.params.path);
	if (!file) return json({ error: 'No such file.' }, 404, who.setCookies);
	const headers = new Headers({
		'content-type': file.type,
		'x-content-type-options': 'nosniff',
		'cache-control': 'private, no-cache'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return bytesResponse(event.request, file.bytes, headers);
};
