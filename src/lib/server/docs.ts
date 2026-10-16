/**
 * The UI server's document store, for its routes.
 */
import { dataDir } from '#server/config.js';
import { storeAt } from '#server/store.js';

export const docs = () => storeAt(dataDir());

/** The largest document a client may write — a person's layers are a few KB. */
export const MAX_DOC_BYTES = 256 * 1024;

/**
 * A document a client wants to write, read from the request: an object, with
 * the version it was made against. The server's own fields are dropped.
 */
export async function incoming(
	request: Request
): Promise<
	| { ok: true; doc: Record<string, unknown>; version: number }
	| { ok: false; status: number; error: string }
> {
	const text = await request.text();
	if (text.length > MAX_DOC_BYTES) return { ok: false, status: 413, error: 'Too large.' };
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return { ok: false, status: 400, error: 'Not JSON.' };
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return { ok: false, status: 400, error: 'Expected an object.' };
	}
	const { version, updated_at: _ignored, ...doc } = body as Record<string, unknown>;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
		return { ok: false, status: 400, error: 'Say which version this change was made against.' };
	}
	return { ok: true, doc, version };
}
