/**
 * Installing UI extensions (13 U7, U8): from the registry's own signed index
 * of them, which homeCore never reads, or from a file an admin adds.
 *
 * From the catalog: the index and its detached ed25519 signature are fetched
 * fresh, checked against the registry's public key (the same one homeCore
 * trusts for plugins), and the chosen version's file is downloaded and checked
 * against the index's sha256 before it's unpacked. From a file: nothing vouches
 * for it, and the page says so before it's added.
 *
 * Either way it's unpacked beside the extensions folder and moved in whole, so
 * an extension is never half there.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RIVE_VALUES } from '#lib/rive/values.js';
import { compareVersions } from '#lib/plugins.js';
import {
	extensionsDir,
	neededFiles,
	PREVIEWS,
	readManifest,
	TYPES,
	type Extension
} from './extensions.js';
import { unpack, UnpackError } from './unpack.js';

/** Where the index is, and the key that signs it; homeCore's registry by default. */
export const registry = () => ({
	url: process.env.HC_EXTENSIONS_INDEX ?? 'https://homecore.io/registry/extensions.json',
	key: process.env.HC_REGISTRY_PUBLIC_KEY ?? 'd64zXOo99GE+uYAPbtbIwLUJHtBaACJB73cUppj93I8='
});

export interface CatalogRelease {
	version: string;
	values: number;
	url: string;
	sha256: string;
	size?: number;
	min_app?: string;
	/** A picture or short video of how it looks, checked like the file itself. */
	preview?: { url: string; sha256: string };
}

export interface CatalogExtension {
	id: string;
	name: string;
	description: string;
	category: string;
	versions: CatalogRelease[];
	/** When this app can use none of its versions: the oldest app that can. */
	needs?: string;
}

/** Where an installed extension came from, kept beside it. */
export interface Installed {
	from: 'catalog' | 'file';
	version: string;
	at: string;
}

export const INSTALLED = '.installed.json';

export class CatalogError extends Error {}

/** Whether `sig` (base64) is the key's ed25519 signature of exactly `bytes`. */
export function signedBy(bytes: Uint8Array, sig: string, keyB64: string): boolean {
	try {
		const raw = Buffer.from(keyB64.trim(), 'base64');
		if (raw.length !== 32) return false;
		// The raw key, in the SPKI wrapping Node reads.
		const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]);
		const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
		return verify(null, bytes, key, Buffer.from(sig.trim(), 'base64'));
	} catch {
		return false;
	}
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** The catalog's extensions, if the index is there and its signature holds. */
export async function catalogIndex(
	get: typeof fetch = fetch,
	{ url, key } = registry(),
	app: string = __APP_VERSION__
): Promise<CatalogExtension[]> {
	const [doc, sig] = await Promise.all([get(url), get(`${url}.sig`)]);
	// No index yet: the catalog has no extensions, which isn't an error.
	if (doc.status === 404) return [];
	if (!doc.ok || !sig.ok)
		throw new CatalogError(`The catalog couldn’t be reached (${doc.status}).`);
	const bytes = new Uint8Array(await doc.arrayBuffer());
	if (!signedBy(bytes, await sig.text(), key))
		throw new CatalogError('The catalog’s list of extensions isn’t signed by homeCore’s key.');
	const idx = JSON.parse(new TextDecoder().decode(bytes)) as { extensions?: CatalogExtension[] };
	return (idx.extensions ?? []).map((x) => {
		const all = x.versions ?? [];
		// Only what this app can draw, and install: a version may need a newer app.
		const fits = (v: CatalogRelease) =>
			(v.values ?? 1) <= RIVE_VALUES && (!v.min_app || compareVersions(app, v.min_app) >= 0);
		const versions = all.filter(fits);
		const wanting = all
			.map((v) => v.min_app)
			.filter((m): m is string => !!m && compareVersions(app, m) < 0)
			.sort(compareVersions);
		return { ...x, versions, ...(!versions.length && wanting[0] ? { needs: wanting[0] } : {}) };
	});
}

/** Unpacks an extension's file and checks it is one, and the one expected. */
export function readPackage(bytes: Uint8Array, expect?: { id: string }) {
	let files;
	try {
		files = unpack(bytes);
	} catch (e) {
		throw new CatalogError(e instanceof UnpackError ? e.message : 'It can’t be unpacked.');
	}
	const json = files.find((f) => f.path === 'extension.json');
	if (!json) throw new CatalogError('It has no extension.json.');
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder().decode(json.data));
	} catch {
		throw new CatalogError('Its extension.json isn’t JSON.');
	}
	const id = (raw as { id?: unknown })?.id;
	if (typeof id !== 'string') throw new CatalogError('Its extension.json has no id.');
	if (expect && id !== expect.id) throw new CatalogError(`It says it is ${id}, not ${expect.id}.`);
	const ext = readManifest(id, raw);
	if (typeof ext === 'string') throw new CatalogError(ext);
	if (['catalog', 'upload'].includes(id))
		throw new CatalogError(`${id} can’t be an extension’s id.`);
	for (const [i, need] of neededFiles(ext).entries())
		if (!files.some((f) => f.path === need))
			throw new CatalogError(`Its ${ext.elements[i]!.label} names ${need}, which isn’t in it.`);
	return { ext, files };
}

/** Puts an unpacked extension in place, replacing the one with its id. */
export async function place(
	{ ext, files }: ReturnType<typeof readPackage>,
	installed: Installed,
	dir = extensionsDir()
): Promise<Extension> {
	await mkdir(dir, { recursive: true });
	const temp = path.join(dir, `.new-${ext.id}-${process.pid}-${Date.now()}`);
	const old = path.join(dir, `.old-${ext.id}-${process.pid}-${Date.now()}`);
	const final = path.join(dir, ext.id);
	try {
		for (const f of files) {
			const at = path.join(temp, ...f.path.split('/'));
			await mkdir(path.dirname(at), { recursive: true });
			await writeFile(at, f.data);
		}
		await writeFile(path.join(temp, INSTALLED), JSON.stringify(installed));
		await rename(final, old).catch(() => {});
		await rename(temp, final);
	} finally {
		await rm(temp, { recursive: true, force: true });
		await rm(old, { recursive: true, force: true });
	}
	return ext;
}

/** Installs a version from the catalog, checking its file against the signed index. */
export async function installFromCatalog(
	id: string,
	version: string,
	get: typeof fetch = fetch,
	where = { index: registry(), dir: extensionsDir() }
): Promise<Extension> {
	const x = (await catalogIndex(get, where.index)).find((e) => e.id === id);
	const rel = x?.versions.find((v) => v.version === version);
	if (!x || !rel) throw new CatalogError(`The catalog has no ${id} ${version} this app can use.`);
	const r = await get(rel.url);
	if (!r.ok) throw new CatalogError(`${x.name} couldn’t be downloaded (${r.status}).`);
	const bytes = new Uint8Array(await r.arrayBuffer());
	if (sha256(bytes) !== rel.sha256.toLowerCase())
		throw new CatalogError(`${x.name} didn’t match its checksum, so it wasn’t installed.`);
	const pkg = readPackage(bytes, { id });
	return place(
		pkg,
		{ from: 'catalog', version: rel.version, at: new Date().toISOString() },
		where.dir
	);
}

/** Installs an extension from a file an admin chose. */
export async function installFromFile(bytes: Uint8Array, dir = extensionsDir()) {
	const pkg = readPackage(bytes);
	return place(pkg, { from: 'file', version: pkg.ext.version, at: new Date().toISOString() }, dir);
}

/** Removes an installed extension. */
export async function remove(id: string, dir = extensionsDir()): Promise<boolean> {
	if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) return false;
	const at = path.join(dir, id);
	const gone = path.join(dir, `.gone-${id}-${Date.now()}`);
	try {
		await rename(at, gone);
	} catch {
		return false;
	}
	await rm(gone, { recursive: true, force: true });
	return true;
}

const MAX_PREVIEW = 8 * 1024 * 1024;
/** Previews already fetched and checked, by checksum; the newest few. */
const previews = new Map<string, { bytes: Uint8Array<ArrayBuffer>; type: string }>();

/**
 * A Catalog release's preview, for the page to show before installing: fetched
 * by this server, and served only if it matches the signed index's checksum,
 * so the browser never fetches it from elsewhere.
 */
export async function catalogPreview(
	id: string,
	version: string,
	get: typeof fetch = fetch,
	index = registry()
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | undefined> {
	const rel = (await catalogIndex(get, index))
		.find((x) => x.id === id)
		?.versions.find((v) => v.version === version);
	const p = rel?.preview;
	if (!p?.url || !/^[0-9a-f]{64}$/i.test(p.sha256 ?? '')) return undefined;
	const ext = path.extname(new URL(p.url).pathname).toLowerCase();
	if (!PREVIEWS.includes(ext)) return undefined;
	const want = p.sha256.toLowerCase();
	const kept = previews.get(want);
	if (kept) return kept;
	const r = await get(p.url);
	if (!r.ok) return undefined;
	const bytes = new Uint8Array(await r.arrayBuffer());
	if (bytes.length > MAX_PREVIEW || sha256(bytes) !== want) return undefined;
	const got = { bytes, type: TYPES[ext]! };
	previews.set(want, got);
	if (previews.size > 12) previews.delete(previews.keys().next().value!);
	return got;
}
