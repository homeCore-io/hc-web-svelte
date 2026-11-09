/**
 * The UI server's own documents (M1), backed up and put back (A6): the
 * household's Home and look, displays' pages, and each person's Home, phone
 * bar and preferences. homeCore's backup doesn't hold them — they live here.
 *
 * `GET` gives them as JSON; `GET ?pictures=1` gives a tar of them with the
 * pictures library beside them (`docs.json`, `pictures/library.json`, and
 * each file under `pictures/`), streamed, since videos can be large.
 *
 * Admins only (`users:write`). Putting back (`POST`, either kind) replaces
 * each document named in the backup and leaves any others alone; a picture
 * already here is kept as it is, and one that isn't is added.
 */
import type { RequestHandler } from './$types';
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { changeLibrary, dir, parseFile, readLibrary, type Item } from '#lib/server/library.js';
import { end, entries, header, padding } from '#lib/server/tar.js';

const KINDS = ['house', 'display', 'person'];
const FORMAT = 'hc-web-backup';
/** The documents in a tar backup: under this, they're read whole. */
const MAX_DOCS_BYTES = 64 * 1024 * 1024;

type Docs = Record<string, Record<string, Record<string, unknown>>>;

async function allDocs() {
	const out: Record<string, Record<string, unknown>> = {};
	for (const kind of KINDS) {
		out[kind] = {};
		for (const id of await docs().ids(kind)) {
			const doc = await docs().read(kind, id);
			if (doc) out[kind][id] = doc;
		}
	}
	return { format: FORMAT, version: 1, taken_at: new Date().toISOString(), docs: out };
}

const enc = new TextEncoder();

/** The documents and the pictures, as a tar, read from disk as it's sent. */
function tarOf(backup: Awaited<ReturnType<typeof allDocs>>): ReadableStream<Uint8Array> {
	async function* parts(): AsyncGenerator<Uint8Array> {
		const file = function* (name: string, bytes: Uint8Array) {
			yield header(name, bytes.length);
			yield bytes;
			yield padding(bytes.length);
		};
		yield* file('docs.json', enc.encode(JSON.stringify(backup, null, '\t')));
		const lib = await readLibrary();
		yield* file(
			'pictures/library.json',
			enc.encode(JSON.stringify({ items: lib.items }, null, '\t'))
		);
		let names: string[] = [];
		try {
			names = (await readdir(dir())).filter((n) => parseFile(n));
		} catch {
			// No pictures yet.
		}
		for (const n of names) {
			const at = path.join(dir(), n);
			const s = await stat(at).catch(() => undefined);
			if (!s) continue;
			yield header(`pictures/${n}`, s.size, s.mtime);
			let sent = 0;
			for await (const chunk of createReadStream(at)) {
				// A file that grew since: only what the header said.
				const b = (chunk as Buffer).subarray(0, s.size - sent);
				sent += b.length;
				if (b.length) yield new Uint8Array(b);
			}
			if (sent < s.size) yield new Uint8Array(s.size - sent);
			yield padding(s.size);
		}
		yield end();
	}
	const it = parts();
	return new ReadableStream({
		async pull(controller) {
			const { done, value } = await it.next();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		async cancel() {
			await it.return(undefined);
		}
	});
}

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	const backup = await allDocs();
	if (event.url.searchParams.get('pictures') !== '1') return json(backup, 200, who.setCookies);
	const headers = new Headers({
		'content-type': 'application/x-tar',
		'content-disposition': `attachment; filename="hc-web-backup-${backup.taken_at.slice(0, 10)}.tar"`,
		'cache-control': 'no-store'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return new Response(tarOf(backup), { headers });
};

/** Whether this person may take a backup, before the browser saves one. */
export const HEAD: RequestHandler = async (event) => {
	const who = await whoIs(event);
	const status = !who.ok ? who.status : who.person.scopes.includes('users:write') ? 200 : 403;
	const headers = new Headers();
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return new Response(null, { status, headers });
};

/** Each document named in a backup, over whatever is there now, whatever its version. */
async function restoreDocs(all: Docs): Promise<number> {
	let restored = 0;
	for (const kind of KINDS) {
		for (const [id, doc] of Object.entries(all[kind] ?? {})) {
			if (!doc || typeof doc !== 'object') continue;
			const { version: _v, updated_at: _u, ...rest } = doc;
			for (let attempt = 0; attempt < 3; attempt++) {
				const current = await docs()
					.read(kind, id)
					.catch(() => undefined);
				const written = await docs()
					.write(kind, id, rest, current?.version ?? 0)
					.catch(() => ({ ok: false as const }));
				if (written.ok) {
					restored++;
					break;
				}
			}
		}
	}
	return restored;
}

const isBackup = (b: unknown): b is { format: string; docs: Docs } =>
	!!b &&
	typeof b === 'object' &&
	(b as { format?: unknown }).format === FORMAT &&
	typeof (b as { docs?: unknown }).docs === 'object' &&
	(b as { docs?: unknown }).docs !== null;

/** A tar backup: its documents, and the pictures this house doesn't have yet. */
async function restoreTar(
	body: ReadableStream<Uint8Array>
): Promise<{ ok: true; restored: number; pictures: number } | { ok: false; error: string }> {
	let backup: unknown;
	let items: Record<string, Item> = {};
	const added = new Set<string>();
	await mkdir(dir(), { recursive: true });
	try {
		for await (const e of entries(body)) {
			if (e.name === 'docs.json' || e.name === 'pictures/library.json') {
				if (e.size > MAX_DOCS_BYTES) return { ok: false, error: 'That backup is damaged.' };
				const parts: Uint8Array[] = [];
				for await (const p of e.body()) parts.push(p);
				const parsed = JSON.parse(Buffer.concat(parts).toString('utf8'));
				if (e.name === 'docs.json') {
					if (!isBackup(parsed)) return { ok: false, error: 'That isn’t a backup of this app.' };
					backup = parsed;
				} else items = parsed?.items ?? {};
				continue;
			}
			// Nothing is written before the backup has shown it is one: its documents come first.
			if (!backup) return { ok: false, error: 'That isn’t a backup of this app.' };
			const name = e.name.startsWith('pictures/') ? e.name.slice('pictures/'.length) : '';
			if (!parseFile(name)) continue;
			const at = path.join(dir(), name);
			// One here already is kept as it is: files are named by a random id.
			if (await stat(at).catch(() => undefined)) continue;
			const part = `${at}.part`;
			const fh = await open(part, 'w');
			try {
				for await (const p of e.body()) await fh.write(p);
			} finally {
				await fh.close();
			}
			await rename(part, at);
			added.add(name);
		}
	} catch {
		for (const n of added) await rm(path.join(dir(), n), { force: true });
		return { ok: false, error: 'That backup is damaged or cut short.' };
	}
	if (!isBackup(backup)) return { ok: false, error: 'That isn’t a backup of this app.' };
	const restored = await restoreDocs(backup.docs);
	// Pictures this house didn't have: their entries, where their file is here now.
	const have = new Set(
		(await readdir(dir()).catch(() => [] as string[])).filter((n) => parseFile(n))
	);
	// The library counts a file it has no entry for as an old picture by nobody;
	// one just put back gets its entry from the backup instead.
	const listed = (await docs().read('pictures', 'library')) as { items?: object } | undefined;
	const kept = new Set(Object.keys(listed?.items ?? {}));
	const pictures =
		(await changeLibrary((lib) => {
			let n = 0;
			for (const [id, it] of Object.entries(items)) {
				if (kept.has(id) || !it || typeof it !== 'object' || it.id !== id) continue;
				if (!have.has(`${id}.${it.ext}`)) continue;
				const sizes = Object.fromEntries(
					Object.entries(it.sizes ?? {}).filter(([, f]) => typeof f === 'string' && have.has(f))
				);
				lib.items[id] = { ...it, sizes };
				n++;
			}
			return n;
		})) ?? 0;
	return { ok: true, restored, pictures };
}

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('users:write'))
		return json({ error: 'Only an admin can do this.' }, 403, who.setCookies);
	if ((event.request.headers.get('content-type') ?? '').includes('tar')) {
		if (!event.request.body)
			return json({ error: 'Send the backup as the body.' }, 400, who.setCookies);
		const r = await restoreTar(event.request.body);
		return r.ok
			? json({ restored: r.restored, pictures: r.pictures }, 200, who.setCookies)
			: json({ error: r.error }, 400, who.setCookies);
	}
	const body = await event.request.json().catch(() => null);
	if (!isBackup(body))
		return json({ error: 'That isn’t a backup of this app.' }, 400, who.setCookies);
	return json({ restored: await restoreDocs(body.docs), pictures: 0 }, 200, who.setCookies);
};
