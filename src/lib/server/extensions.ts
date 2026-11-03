/**
 * UI extensions: drawings that live outside the app, each in a folder of its
 * own under the data directory (`extensions/{id}/extension.json` and its
 * files). The app reads the folder; how an extension gets there is for later.
 *
 * An element names its family, the file it draws with, and how: today only
 * `rive`, an animated drawing whose view model the app fills from the thing.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '#server/config.js';
import { RIVE_VALUES } from '#lib/rive/values.js';

export interface ExtensionElement {
	id: string;
	kind: 'rive';
	label: string;
	/** The look family it draws (13 §6). */
	draws: string;
	file: string;
	artboard?: string;
	stateMachine?: string;
}

export interface Extension {
	id: string;
	name: string;
	version: string;
	elements: ExtensionElement[];
}

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
/** A file inside an extension's folder: a plain name, no folders. */
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.riv$/;
const MAX_FILE = 8 * 1024 * 1024;

export const extensionsDir = () => path.join(dataDir(), 'extensions');

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** An extension's manifest, or why it can't be used. */
export function readManifest(id: string, raw: unknown): Extension | string {
	if (!raw || typeof raw !== 'object') return 'extension.json is not an object.';
	const o = raw as Record<string, unknown>;
	if (o.id !== id) return `extension.json says it is ${String(o.id)}, but its folder is ${id}.`;
	const values = typeof o.values === 'number' ? o.values : 1;
	if (values > RIVE_VALUES) return `${id} needs a newer app (values ${values}).`;
	const elements: ExtensionElement[] = [];
	for (const e of Array.isArray(o.elements) ? o.elements : []) {
		const x = (e ?? {}) as Record<string, unknown>;
		const eid = str(x.id);
		const file = str(x.file);
		const label = str(x.label);
		const draws = str(x.draws);
		if (x.kind !== 'rive' || !eid || !ID.test(eid) || !file || !FILE.test(file) || !label || !draws)
			continue;
		if (elements.some((y) => y.id === eid)) continue;
		elements.push({
			id: eid,
			kind: 'rive',
			label,
			draws,
			file,
			artboard: str(x.artboard),
			stateMachine: str(x.stateMachine)
		});
	}
	if (!elements.length) return 'extension.json has no elements the app can use.';
	return { id, name: str(o.name) ?? id, version: str(o.version) ?? '0', elements };
}

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
			if (typeof ext !== 'string') out.push(ext);
		} catch {
			// Not an extension, or not one yet.
		}
	}
	return out;
}

/** A file an extension's elements draw with, or undefined if it names none. */
export async function extensionFile(
	id: string,
	file: string,
	dir = extensionsDir()
): Promise<Uint8Array<ArrayBuffer> | undefined> {
	if (!ID.test(id) || !FILE.test(file)) return undefined;
	const ext = (await listExtensions(dir)).find((x) => x.id === id);
	if (!ext?.elements.some((e) => e.file === file)) return undefined;
	const at = path.join(dir, id, file);
	const s = await stat(at).catch(() => undefined);
	if (!s?.isFile() || s.size > MAX_FILE) return undefined;
	return new Uint8Array(await readFile(at));
}
