/**
 * What a picture file is, by its first bytes, never by its name (design 15):
 * PNG, JPEG, WebP and GIF, the kinds a browser draws safely. SVG is refused:
 * it can carry script. Videos are told apart in the library (`library.ts`).
 */

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
