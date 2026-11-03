/**
 * UI extensions (13 §12.6): drawings that live outside the app, each in a
 * folder of its own under the data directory (`extensions/{id}/extension.json`
 * and its files), installed from the Catalog or a file (extensionCatalog.ts).
 *
 * An element names the look family it draws and how:
 *
 * - `rive`: a `.riv` file whose view model the app fills from the thing.
 * - `code`: a JavaScript module defining a custom element, given the thing
 *   and a `host` (13 U1). Code runs in the browser of everyone who sees a
 *   look that uses it, so only those who may install plugins can install one.
 */
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '#server/config.js';
import { RIVE_VALUES } from '#lib/rive/values.js';

/** A choice a drawing offers, shown under it in the look editor: on or off. */
export interface DrawingOption {
	id: string;
	label: string;
	type: 'boolean';
	default: boolean;
}

interface Element {
	id: string;
	label: string;
	/** The look family it draws (13 §6). */
	draws: string;
	options?: DrawingOption[];
}
export type ExtensionElement =
	| (Element & { kind: 'rive'; file: string; artboard?: string; stateMachine?: string })
	| (Element & { kind: 'code'; module: string; element: string });

export interface Extension {
	id: string;
	name: string;
	version: string;
	elements: ExtensionElement[];
	/** Where it came from: the catalog or a file (`.installed.json`); copied in by hand, neither. */
	installed?: { from: 'catalog' | 'file'; version: string; at: string };
}

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
/** A custom element's name: lowercase, starting with a letter, with a hyphen. */
const TAG = /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/;
const MAX_FILE = 8 * 1024 * 1024;

/** The files an extension may serve, and their types. Anything else isn't served. */
export const TYPES: Record<string, string> = {
	'.riv': 'application/octet-stream',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/plain; charset=utf-8'
};

/** A path inside an extension's folder: no `..`, no root, and no hidden names. */
export const filePath = (p: string): boolean =>
	p.length > 0 &&
	p.length <= 255 &&
	!/[\\\0]/.test(p) &&
	p.split('/').every((s) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(s) && !s.includes('..'));

const typed = (p: string, ...ext: string[]) =>
	filePath(p) && ext.includes(path.extname(p).toLowerCase());

export const extensionsDir = () => path.join(dataDir(), 'extensions');

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** An element's options, those that are well formed; none is fine. */
export function readOptions(raw: unknown): DrawingOption[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const out: DrawingOption[] = [];
	for (const o of raw.slice(0, 8)) {
		const x = (o ?? {}) as Record<string, unknown>;
		const id = str(x.id);
		const label = str(x.label);
		if (!id || !/^[a-z][a-zA-Z0-9_]{0,31}$/.test(id) || !label || x.type !== 'boolean') continue;
		if (out.some((y) => y.id === id)) continue;
		out.push({ id, label: label.slice(0, 60), type: 'boolean', default: x.default !== false });
	}
	return out.length ? out : undefined;
}

function readElement(x: Record<string, unknown>): ExtensionElement | undefined {
	const id = str(x.id);
	const label = str(x.label);
	const draws = str(x.draws);
	if (!id || !ID.test(id) || !label || !draws) return undefined;
	const options = readOptions(x.options);
	const opts = options ? { options } : {};
	if (x.kind === 'rive') {
		const file = str(x.file);
		if (!file || !typed(file, '.riv')) return undefined;
		return {
			id,
			kind: 'rive',
			label,
			draws,
			file,
			artboard: str(x.artboard),
			stateMachine: str(x.stateMachine),
			...opts
		};
	}
	if (x.kind === 'code') {
		const module = str(x.module);
		const element = str(x.element);
		if (!module || !typed(module, '.js', '.mjs') || !element || !TAG.test(element))
			return undefined;
		return { id, kind: 'code', label, draws, module, element, ...opts };
	}
	return undefined;
}

/** An extension's manifest, or why it can't be used. */
export function readManifest(id: string, raw: unknown): Extension | string {
	if (!raw || typeof raw !== 'object') return 'extension.json is not an object.';
	const o = raw as Record<string, unknown>;
	if (o.id !== id) return `extension.json says it is ${String(o.id)}, but its folder is ${id}.`;
	const values = typeof o.values === 'number' ? o.values : 1;
	if (values > RIVE_VALUES) return `${id} needs a newer app (values ${values}).`;
	const elements: ExtensionElement[] = [];
	for (const e of Array.isArray(o.elements) ? o.elements : []) {
		const x = readElement((e ?? {}) as Record<string, unknown>);
		if (x && !elements.some((y) => y.id === x.id)) elements.push(x);
	}
	if (!elements.length) return 'extension.json has no elements the app can use.';
	return { id, name: str(o.name) ?? id, version: str(o.version) ?? '0', elements };
}

/** The file each element needs, so an install can check they're all there. */
export const neededFiles = (x: Extension) =>
	x.elements.map((e) => (e.kind === 'rive' ? e.file : e.module));

/** Every usable extension in the folder. One that can't be read is left out. */
export async function listExtensions(dir = extensionsDir()): Promise<Extension[]> {
	let names: string[];
	try {
		names = await readdir(dir);
	} catch {
		return [];
	}
	const out: Extension[] = [];
	for (const id of names.sort()) {
		if (!ID.test(id)) continue;
		try {
			const raw = JSON.parse(await readFile(path.join(dir, id, 'extension.json'), 'utf8'));
			const ext = readManifest(id, raw);
			if (typeof ext === 'string') continue;
			const installed = await readFile(path.join(dir, id, '.installed.json'), 'utf8')
				.then((t) => JSON.parse(t) as Extension['installed'])
				.catch(() => undefined);
			out.push(installed ? { ...ext, installed } : ext);
		} catch {
			// Not an extension, or not one yet.
		}
	}
	return out;
}

/**
 * One of an installed extension's files, with its type: one of `TYPES`, at a
 * plain path inside its folder, and not reached through a link out of it.
 */
export async function extensionFile(
	id: string,
	file: string,
	dir = extensionsDir()
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | undefined> {
	const type = TYPES[path.extname(file).toLowerCase()];
	if (!ID.test(id) || !filePath(file) || !type) return undefined;
	if (!(await listExtensions(dir)).some((x) => x.id === id)) return undefined;
	const root = await realpath(path.join(dir, id)).catch(() => undefined);
	const at = await realpath(path.join(dir, id, ...file.split('/'))).catch(() => undefined);
	if (!root || !at || !at.startsWith(root + path.sep)) return undefined;
	const s = await stat(at).catch(() => undefined);
	if (!s?.isFile() || s.size > MAX_FILE) return undefined;
	return { bytes: new Uint8Array(await readFile(at)), type };
}
