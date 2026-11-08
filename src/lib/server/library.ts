/**
 * The pictures library (design 15): every picture and video anyone added,
 * kept by the UI server and never by homeCore (P1). One index document
 * (`pictures/library`) says what each file is: its name, who added it, whether
 * it's everyone's or theirs alone, its albums, and the smaller copies the app
 * made of it for tiles and screens (P7). The files themselves sit beside it
 * under `pictures/`, by a random name that is also the picture's id.
 *
 * Where a picture is used (P4) isn't kept: its address is looked for in the
 * household's, the displays' and people's documents when asked, so it can
 * never be out of date. Deleting one takes it off all of them.
 */
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, rename, rm, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { dataDir } from '#server/config.js';
import { docs } from './docs.js';
import { sniff as sniffPicture } from './pictures.js';

export const MAX_PICTURE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** A smaller copy the app made: a tile, a screen's width, a video's first frame. */
export const MAX_SIZE_BYTES = 4 * 1024 * 1024;
export const SIZES = ['tile', 'screen', 'poster'] as const;
export type Size = (typeof SIZES)[number];

export const TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	mp4: 'video/mp4',
	webm: 'video/webm'
} as const;
export type Ext = keyof typeof TYPES;

/** A video's kind by its first bytes: MP4's `ftyp` box, WebM's EBML header. */
export function sniffVideo(b: Uint8Array): 'mp4' | 'webm' | undefined {
	if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'mp4';
	if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
	return undefined;
}

/** What the bytes are, of what we take; none otherwise (an SVG above all). */
export const sniff = (b: Uint8Array): Ext | undefined => sniffPicture(b) ?? sniffVideo(b);

export interface Item {
	/** The random name the file is kept by, without its kind. */
	id: string;
	ext: Ext;
	name: string;
	kind: 'picture' | 'video';
	bytes: number;
	/** Who added it (homeCore's id), and their name then; none for one from before the library. */
	owner: string | null;
	by: string;
	at: string;
	/** Everyone's in the house, or its owner's alone (P5). */
	shared: boolean;
	albums: string[];
	/** The smaller copies made of it, by their file names. */
	sizes: Partial<Record<Size, string>>;
}

export interface Library {
	version: number;
	items: Record<string, Item>;
}

/** The address a picture is used by, in any document. */
export const urlOf = (it: Pick<Item, 'id' | 'ext'>) => `/ui/pictures/${it.id}.${it.ext}`;

const ID = /^[a-f0-9]{24}$/;
/** A file of ours: an original, or one of its smaller copies. Nothing else is ever read. */
const FILE = /^([a-f0-9]{24})(?:\.(tile|screen|poster))?\.(png|jpg|webp|gif|mp4|webm)$/;

export function parseFile(name: string): { id: string; size?: Size; ext: Ext } | undefined {
	const m = FILE.exec(name);
	return m ? { id: m[1]!, size: m[2] as Size | undefined, ext: m[3] as Ext } : undefined;
}

export const dir = () => path.join(dataDir(), 'pictures');
const fileOf = (name: string) => path.join(dir(), name);

/** Who's asking: a person, or a display (which only looks, P8). */
export interface Asker {
	id: string;
	username: string;
	scopes: string[];
	display?: boolean;
}

const EDIT = 'content:write';

/** Whether they see it: everyone's, or theirs. A display sees only everyone's. */
export const sees = (it: Item, who: Asker) => it.shared || (!who.display && it.owner === who.id);

/** Whether they may rename, share or delete it: its owner, or for one of everyone's, people who edit the house. */
export const mayChange = (it: Item, who: Asker) =>
	!who.display && (it.owner === who.id || (it.shared && who.scopes.includes(EDIT)));

/** A picture as the app gets it: its address, and what this person may do with it. */
export const shape = (it: Item, who: Asker) => ({
	...it,
	url: urlOf(it),
	mine: it.owner === who.id,
	mayChange: mayChange(it, who)
});

// ---- the index ----

export async function readLibrary(): Promise<Library> {
	const doc = (await docs().read('pictures', 'library')) as Library | undefined;
	const lib: Library = { version: doc?.version ?? 0, items: { ...(doc?.items ?? {}) } };
	// Pictures from before the library: everyone's, by nobody in particular.
	let names: string[] = [];
	try {
		names = await readdir(dir());
	} catch {
		// None yet.
	}
	for (const n of names) {
		const f = parseFile(n);
		if (!f || f.size || lib.items[f.id]) continue;
		const s = await stat(fileOf(n)).catch(() => undefined);
		if (!s) continue;
		lib.items[f.id] = {
			id: f.id,
			ext: f.ext,
			name: 'Picture',
			kind: f.ext === 'mp4' || f.ext === 'webm' ? 'video' : 'picture',
			bytes: s.size,
			owner: null,
			by: '',
			at: s.mtime.toISOString(),
			shared: true,
			albums: [],
			sizes: {}
		};
	}
	return lib;
}

/** Change the index, again on a newer one if someone else wrote first. */
export async function changeLibrary<T>(
	fn: (lib: Library) => T | undefined
): Promise<T | undefined> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const lib = await readLibrary();
		const out = fn(lib);
		if (out === undefined) return undefined;
		const written = await docs().write('pictures', 'library', { items: lib.items }, lib.version);
		if (written.ok) return out;
	}
	throw new Error('The pictures library kept changing.');
}

// ---- files ----

/**
 * A file sent as a request's body, kept under a new random name: refused if
 * it's none of ours or larger than its kind may be. The bytes are written as
 * they arrive, so a video never sits whole in memory.
 */
export async function keepUpload(
	body: ReadableStream<Uint8Array> | null
): Promise<
	{ ok: true; id: string; ext: Ext; bytes: number } | { ok: false; status: number; error: string }
> {
	if (!body) return { ok: false, status: 400, error: 'Send the file as the body.' };
	await mkdir(dir(), { recursive: true });
	const id = randomBytes(12).toString('hex');
	const tmp = fileOf(`${id}.part`);
	const fh = await open(tmp, 'w');
	let head = new Uint8Array(0);
	let ext: Ext | undefined;
	let bytes = 0;
	const fail = async (status: number, error: string) => {
		await fh.close().catch(() => {});
		await rm(tmp, { force: true });
		return { ok: false as const, status, error };
	};
	const reader = body.getReader();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.length;
			if (!ext) {
				head = new Uint8Array([...head, ...value.subarray(0, 16)]);
				if (head.length >= 12) {
					ext = sniff(head);
					if (!ext) {
						await reader.cancel().catch(() => {});
						return fail(415, 'That isn’t a picture (PNG, JPEG, WebP, GIF) or a video (MP4, WebM).');
					}
				}
			}
			const max = ext === 'mp4' || ext === 'webm' ? MAX_VIDEO_BYTES : MAX_PICTURE_BYTES;
			if (bytes > max) {
				await reader.cancel().catch(() => {});
				return fail(
					413,
					max === MAX_VIDEO_BYTES ? 'It’s larger than 200 MB.' : 'It’s larger than 20 MB.'
				);
			}
			await fh.write(value);
		}
	} catch {
		return fail(400, 'It didn’t all arrive.');
	}
	if (!ext) return fail(415, 'That isn’t a picture or a video.');
	await fh.close();
	await rename(tmp, fileOf(`${id}.${ext}`));
	return { ok: true, id, ext, bytes };
}

/** A smaller copy, from bytes the app made: a picture of ours, never a video. */
export async function keepSize(
	it: Item,
	size: Size,
	bytes: Uint8Array
): Promise<string | undefined> {
	const ext = sniffPicture(bytes);
	if (!ext) return undefined;
	const name = `${it.id}.${size}.${ext}`;
	await mkdir(dir(), { recursive: true });
	const fh = await open(fileOf(name), 'w');
	await fh.write(bytes);
	await fh.close();
	return name;
}

/** Remove a picture's files: the original and its copies. */
export async function removeFiles(it: Item): Promise<void> {
	await rm(fileOf(`${it.id}.${it.ext}`), { force: true });
	for (const n of Object.values(it.sizes))
		if (n && FILE.test(n)) await rm(fileOf(n), { force: true });
}

/**
 * A file as a response, a range of it if asked (a video seeks): read from
 * disk as it's sent.
 */
export async function fileResponse(
	request: Request,
	name: string,
	headers: Headers
): Promise<Response | undefined> {
	if (!FILE.test(name)) return undefined;
	const file = fileOf(name);
	const s = await stat(file).catch(() => undefined);
	if (!s) return undefined;
	const size = s.size;
	headers.set('accept-ranges', 'bytes');
	const stream = (start: number, end: number) =>
		Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
	const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (m && (m[1] || m[2])) {
		let start = m[1] ? Number(m[1]) : size - Number(m[2]);
		let end = m[1] && m[2] ? Number(m[2]) : size - 1;
		start = Math.max(0, start);
		end = Math.min(end, size - 1);
		if (start > end || start >= size) {
			headers.set('content-range', `bytes */${size}`);
			return new Response(null, { status: 416, headers });
		}
		headers.set('content-range', `bytes ${start}-${end}/${size}`);
		headers.set('content-length', String(end - start + 1));
		return new Response(stream(start, end), { status: 206, headers });
	}
	headers.set('content-length', String(size));
	return new Response(size > 0 ? stream(0, size - 1) : null, { status: 200, headers });
}

// ---- where it's used (P4) ----

export type Path = (string | number)[];

const isUse = (v: unknown, url: string) =>
	typeof v === 'string' && (v === url || v.startsWith(`${url}?`));

/** Every place in a document that holds the address. */
export function findUses(doc: unknown, url: string, at: Path = []): Path[] {
	if (isUse(doc, url)) return [at];
	if (Array.isArray(doc)) return doc.flatMap((v, i) => findUses(v, url, [...at, i]));
	if (doc && typeof doc === 'object')
		return Object.entries(doc).flatMap(([k, v]) => findUses(v, url, [...at, k]));
	return [];
}

/** The document without the address anywhere: the key that held it gone, or its place in a list. */
export function stripUses(doc: unknown, url: string): unknown {
	if (Array.isArray(doc)) return doc.filter((v) => !isUse(v, url)).map((v) => stripUses(v, url));
	if (doc && typeof doc === 'object')
		return Object.fromEntries(
			Object.entries(doc)
				.filter(([, v]) => !isUse(v, url))
				.map(([k, v]) => [k, stripUses(v, url)])
		);
	return doc;
}

/** The documents a picture can be used in: the household's, each display's, each person's. */
export const USED_IN = ['house', 'display', 'person'] as const;
export type Use = { in: (typeof USED_IN)[number]; id: string; path: Path };

/**
 * Where each picture is used, as far as `who` may know: in the household's
 * and displays' documents, and in their own. Uses in someone else's own
 * pages are only counted.
 */
export async function usesOf(
	items: Item[],
	who: Asker
): Promise<Map<string, { uses: Use[]; elsewhere: number }>> {
	const out = new Map(items.map((it) => [it.id, { uses: [] as Use[], elsewhere: 0 }]));
	const mine = who.id.toLowerCase().replace(/[^0-9a-f-]/g, '');
	for (const kind of USED_IN)
		for (const id of await docs().ids(kind)) {
			const doc = await docs().read(kind, id);
			if (!doc) continue;
			for (const it of items) {
				const found = findUses(doc, urlOf(it));
				if (found.length === 0) continue;
				const o = out.get(it.id)!;
				if (kind === 'person' && id !== mine) o.elsewhere += found.length;
				else o.uses.push(...found.map((p) => ({ in: kind, id, path: p })));
			}
		}
	return out;
}

/** Take a picture off every document that uses it. How many documents changed. */
export async function takeOff(it: Item): Promise<number> {
	const url = urlOf(it);
	let changed = 0;
	for (const kind of USED_IN)
		for (const id of await docs().ids(kind))
			for (let attempt = 0; attempt < 3; attempt++) {
				const doc = await docs().read(kind, id);
				if (!doc || findUses(doc, url).length === 0) break;
				const { version, updated_at: _at, ...rest } = doc;
				const written = await docs().write(
					kind,
					id,
					stripUses(rest, url) as Record<string, unknown>,
					version
				);
				if (written.ok) {
					changed++;
					break;
				}
			}
	return changed;
}

export const isId = (id: string) => ID.test(id);
