/**
 * Pictures on pages (14 §6, the Picture widget): images people upload, kept
 * by the app's own server under the data directory (`pictures/`), as
 * extensions are. Only the kinds a browser draws safely: PNG, JPEG, WebP and
 * GIF, told by their first bytes, never by a name. SVG is refused: it can
 * carry script.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { dataDir } from '#server/config.js';

export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;

const TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif'
} as const;
type Ext = keyof typeof TYPES;

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);

/** What kind of image the bytes are, by their first bytes; none, if not one of ours. */
export function sniff(b: Uint8Array): Ext | undefined {
	if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
	if (starts(b, [0xff, 0xd8, 0xff])) return 'jpg';
	if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
	if (starts(b, [0x47, 0x49, 0x46, 0x38])) return 'gif';
	return undefined;
}

const dir = () => path.join(dataDir(), 'pictures');
/** A stored picture's name: a random id and its kind. Nothing else is ever read. */
const NAME = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/;

/** Kept, and its name to fetch it by; none, if the bytes aren't a picture we take. */
export async function keep(bytes: Uint8Array): Promise<string | undefined> {
	const ext = sniff(bytes);
	if (!ext) return undefined;
	const name = `${randomBytes(12).toString('hex')}.${ext}`;
	await mkdir(dir(), { recursive: true });
	await writeFile(path.join(dir(), name), bytes);
	return name;
}

/** A stored picture's bytes and type; none for a name that isn't one. */
export async function picture(
	name: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | undefined> {
	if (!NAME.test(name)) return undefined;
	try {
		const bytes = new Uint8Array(await readFile(path.join(dir(), name)));
		return { bytes, type: TYPES[name.split('.')[1] as Ext] };
	} catch {
		return undefined;
	}
}
