/**
 * The store's UI extensions (lib/server/extensionStore.ts): `GET` lists them
 * from the registry's signed index; `POST {id, version}` installs one.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { admin } from '#lib/server/extensionAdmin.js';
import { installFromStore, storeIndex, StoreError } from '#lib/server/extensionStore.js';

export const GET: RequestHandler = async (event) => {
	const a = await admin(event);
	if ('fail' in a) return a.fail!;
	try {
		return json({ extensions: await storeIndex() }, 200, a.who.setCookies);
	} catch (e) {
		const error = e instanceof StoreError ? e.message : 'The store couldn’t be reached.';
		return json({ error }, 502, a.who.setCookies);
	}
};

export const POST: RequestHandler = async (event) => {
	const a = await admin(event);
	if ('fail' in a) return a.fail!;
	const body = (await event.request.json().catch(() => null)) as {
		id?: unknown;
		version?: unknown;
	} | null;
	if (typeof body?.id !== 'string' || typeof body.version !== 'string')
		return json({ error: 'Say which extension and version.' }, 400, a.who.setCookies);
	try {
		const ext = await installFromStore(body.id, body.version);
		return json({ extension: ext }, 200, a.who.setCookies);
	} catch (e) {
		const error = e instanceof StoreError ? e.message : 'It couldn’t be installed.';
		return json({ error }, 422, a.who.setCookies);
	}
};
