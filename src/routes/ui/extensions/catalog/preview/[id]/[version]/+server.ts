/**
 * A Catalog release's preview (lib/server/extensionCatalog.ts): fetched and
 * checked against the signed index by this server, for anyone who can open
 * the Catalog. Nothing comes back for one that doesn't match.
 */
import type { RequestHandler } from './$types';
import { bytesResponse, json } from '#lib/server/http.js';
import { admin } from '#lib/server/extensionAdmin.js';
import { catalogPreview } from '#lib/server/extensionCatalog.js';

export const GET: RequestHandler = async (event) => {
	const a = await admin(event);
	if ('fail' in a) return a.fail!;
	const p = await catalogPreview(event.params.id, event.params.version).catch(() => undefined);
	if (!p) return json({ error: 'No preview.' }, 404, a.who.setCookies);
	const headers = new Headers({
		'content-type': p.type,
		'x-content-type-options': 'nosniff',
		'cache-control': 'private, max-age=3600'
	});
	for (const c of a.who.setCookies) headers.append('set-cookie', c);
	return bytesResponse(event.request, p.bytes, headers);
};
