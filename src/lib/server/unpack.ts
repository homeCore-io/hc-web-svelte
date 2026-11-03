/**
 * Reading an extension's file (13 U10): a `.tar.zst` as plugins are packed, a
 * `.tar.gz`, or a `.zip`, told apart by their first bytes. Only regular files
 * come out, each at a plain relative path; links, devices and anything that
 * would land outside the folder are refused, as is anything too large.
 *
 * Written here rather than taken from a package: it's small, it runs on files
 * from outside the house, and every rule it keeps is in view.
 */
import { gunzipSync, inflateRawSync, zstdDecompressSync } from 'node:zlib';

export interface Unpacked {
	/** Path within the extension, `/`-separated. */
	path: string;
	data: Uint8Array;
}

export const LIMITS = { files: 200, bytes: 32 * 1024 * 1024 };

export class UnpackError extends Error {}

/** A path that stays inside the folder: no `..`, no root, no backslash, no NUL. */
export const safePath = (p: string): boolean =>
	p.length > 0 &&
	p.length <= 255 &&
	!p.startsWith('/') &&
	!/[\\\0]/.test(p) &&
	p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');

const starts = (b: Uint8Array, magic: number[]) => magic.every((m, i) => b[i] === m);

/** The files in an extension's file, whatever it's packed as. */
export function unpack(bytes: Uint8Array): Unpacked[] {
	let files: Unpacked[];
	if (starts(bytes, [0x50, 0x4b, 0x03, 0x04]) || starts(bytes, [0x50, 0x4b, 0x05, 0x06]))
		files = unzip(bytes);
	else if (starts(bytes, [0x28, 0xb5, 0x2f, 0xfd]))
		files = untar(decompress(() => zstdDecompressSync(bytes, { maxOutputLength: LIMITS.bytes })));
	else if (starts(bytes, [0x1f, 0x8b]))
		files = untar(decompress(() => gunzipSync(bytes, { maxOutputLength: LIMITS.bytes })));
	else throw new UnpackError('It isn’t a .tar.zst, .tar.gz or .zip file.');
	return withoutTop(files);
}

function decompress(f: () => Uint8Array): Uint8Array {
	try {
		return f();
	} catch {
		throw new UnpackError('It can’t be read, or it unpacks to more than 32 MB.');
	}
}

function keep(out: Unpacked[], path: string, data: Uint8Array) {
	if (!safePath(path)) throw new UnpackError(`It holds a file outside its folder: ${path}`);
	if (out.some((f) => f.path === path)) throw new UnpackError(`It holds ${path} twice.`);
	if (out.length >= LIMITS.files) throw new UnpackError('It holds too many files.');
	const total = out.reduce((n, f) => n + f.data.length, 0) + data.length;
	if (total > LIMITS.bytes) throw new UnpackError('It unpacks to more than 32 MB.');
	out.push({ path, data });
}

const text = (b: Uint8Array) => new TextDecoder().decode(b).replace(/\0.*$/s, '');

function untar(b: Uint8Array): Unpacked[] {
	const out: Unpacked[] = [];
	let longName: string | undefined;
	for (let at = 0; at + 512 <= b.length;) {
		const h = b.subarray(at, at + 512);
		if (h.every((x) => x === 0)) break;
		const size = parseInt(text(h.subarray(124, 136)).trim() || '0', 8);
		if (!Number.isFinite(size) || size < 0) throw new UnpackError('Its tar is damaged.');
		const type = String.fromCharCode(h[156] ?? 0);
		const prefix = text(h.subarray(345, 500));
		const name = longName ?? (prefix ? `${prefix}/` : '') + text(h.subarray(0, 100));
		longName = undefined;
		const data = b.subarray(at + 512, at + 512 + size);
		if (data.length < size) throw new UnpackError('Its tar is cut short.');
		at += 512 + Math.ceil(size / 512) * 512;
		if (type === 'L') longName = text(data);
		else if (type === '0' || type === '\0') keep(out, name.replace(/^\.\//, ''), data.slice());
		else if (type === '5' || type === 'x' || type === 'g') continue;
		else throw new UnpackError(`It holds something other than files: ${name}`);
	}
	return out;
}

function unzip(b: Uint8Array): Unpacked[] {
	const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
	let end = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--)
		if (v.getUint32(i, true) === 0x06054b50) {
			end = i;
			break;
		}
	if (end < 0) throw new UnpackError('Its zip is damaged.');
	const count = v.getUint16(end + 10, true);
	let at = v.getUint32(end + 16, true);
	const out: Unpacked[] = [];
	for (let n = 0; n < count; n++) {
		if (at + 46 > b.length || v.getUint32(at, true) !== 0x02014b50)
			throw new UnpackError('Its zip is damaged.');
		const flags = v.getUint16(at + 8, true);
		const method = v.getUint16(at + 10, true);
		const packed = v.getUint32(at + 20, true);
		const size = v.getUint32(at + 24, true);
		const nameLen = v.getUint16(at + 28, true);
		const extraLen = v.getUint16(at + 30, true);
		const commentLen = v.getUint16(at + 32, true);
		const mode = v.getUint32(at + 38, true) >>> 16;
		const local = v.getUint32(at + 42, true);
		const name = new TextDecoder().decode(b.subarray(at + 46, at + 46 + nameLen));
		at += 46 + nameLen + extraLen + commentLen;
		if (name.endsWith('/')) continue;
		if (flags & 1) throw new UnpackError('Its zip is encrypted.');
		// A symbolic link, as zip tools on Unix record one.
		if ((mode & 0o170000) === 0o120000) throw new UnpackError(`It holds a link: ${name}`);
		if (size > LIMITS.bytes || packed === 0xffffffff)
			throw new UnpackError('It unpacks to more than 32 MB.');
		if (v.getUint32(local, true) !== 0x04034b50) throw new UnpackError('Its zip is damaged.');
		const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
		const raw = b.subarray(start, start + packed);
		let data: Uint8Array;
		if (method === 0) data = raw.slice();
		else if (method === 8)
			data = decompress(() => inflateRawSync(raw, { maxOutputLength: LIMITS.bytes }));
		else throw new UnpackError(`Its zip uses a compression this can’t read (${method}).`);
		if (data.length !== size) throw new UnpackError('Its zip is damaged.');
		keep(out, name, data);
	}
	return out;
}

/**
 * A folder zipped as itself: every file under one top folder, with
 * `extension.json` in it rather than beside it. Its files, without the folder.
 */
function withoutTop(files: Unpacked[]): Unpacked[] {
	if (files.some((f) => f.path === 'extension.json')) return files;
	const top = files[0]?.path.split('/')[0];
	if (!top || !files.every((f) => f.path.startsWith(`${top}/`))) return files;
	return files.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
}
