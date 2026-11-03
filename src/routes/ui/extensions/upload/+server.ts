/**
 * An extension from a file an admin chose: the body is the file (`.tar.zst`,
 * `.tar.gz` or `.zip`). Nothing vouches for it; the Catalog page says so first.
 * With `?check`, it is only read: what it holds comes back, nothing installed.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { admin } from '#lib/server/extensionAdmin.js';
import { installFromFile, readPackage, CatalogError } from '#lib/server/extensionCatalog.js';

const MAX_BYTES = 16 * 1024 * 1024;

export const POST: RequestHandler = async (event) => {
	const a = await admin(event);
	if ('fail' in a) return a.fail!;
	const length = Number(event.request.headers.get('content-length') ?? 0);
	if (length > MAX_BYTES) return json({ error: 'It’s larger than 16 MB.' }, 413, a.who.setCookies);
	const bytes = new Uint8Array(await event.request.arrayBuffer());
	if (bytes.length > MAX_BYTES)
		return json({ error: 'It’s larger than 16 MB.' }, 413, a.who.setCookies);
	try {
		if (event.url.searchParams.has('check'))
			return json({ extension: readPackage(bytes).ext }, 200, a.who.setCookies);
		return json({ extension: await installFromFile(bytes) }, 200, a.who.setCookies);
	} catch (e) {
		const error = e instanceof CatalogError ? e.message : 'It couldn’t be installed.';
		return json({ error }, 422, a.who.setCookies);
	}
};
