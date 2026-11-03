#!/usr/bin/env node
/**
 * Every icon of the app from one drawing:
 *
 *     node scripts/make-icons.mjs      # rewrites static/favicon.svg and the PNGs
 *
 * The mark is "Roof + Core" — a roofline over a solid dot — from hc-web-flutter
 * (its `tool/make_icons.py` explains the geometry; the gap between the roof
 * and the dot is the whole design, and at 16 px it is about 1.5 px). Here it
 * takes the app's accent colours: brown with white in light, amber with
 * near-black in dark. The SVG favicon follows the device's light or dark; the
 * PNGs (home screens, older browsers) can't, and are the light one.
 *
 * Drawn by distance functions rather than a rasteriser, so it needs nothing
 * installed and draws the same on every machine. The sidebar's mark
 * (`src/lib/components/Mark.svelte`) draws the same shape: change both.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const STATIC = join(import.meta.dirname, '..', 'static');

// In a 64-unit square, as Flutter's.
const CORNER = 14;
const ROOF_W = 8.5;
/** @typedef {[number, number]} Pt */
/** @type {Pt} */ const EAVE_L = [11.5, 29];
/** @type {Pt} */ const APEX = [32, 11.5];
/** @type {Pt} */ const EAVE_R = [52.5, 29];
/** @type {Pt} */ const CORE = [32, 47.5];
const CORE_R = 8;

// From src/app.css: --accent and --accent-ink, light and dark.
const LIGHT = { tile: '#9A4A07', mark: '#FFFFFF' };
const DARK = { tile: '#F2B544', mark: '#1A1306' };

const roofPath = `M${EAVE_L.join(' ')} L${APEX.join(' ')} L${EAVE_R.join(' ')}`;

function svg() {
	/** @param {{ tile: string, mark: string }} c */
	const colours = ({ tile, mark }) => `.t{fill:${tile}}.r{stroke:${mark}}.c{fill:${mark}}`;
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
		`<style>${colours(LIGHT)}@media (prefers-color-scheme:dark){${colours(DARK)}}</style>` +
		`<rect class="t" width="64" height="64" rx="${CORNER}"/>` +
		`<path class="r" d="${roofPath}" fill="none" stroke-width="${ROOF_W}" stroke-linecap="round" stroke-linejoin="round"/>` +
		`<circle class="c" cx="${CORE[0]}" cy="${CORE[1]}" r="${CORE_R}"/>` +
		'</svg>\n'
	);
}

// ---- distances, in design units; negative inside ----
/** @param {number} px @param {number} py @param {Pt} a @param {Pt} b */
function segment(px, py, [ax, ay], [bx, by]) {
	const dx = bx - ax,
		dy = by - ay;
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** @param {number} px @param {number} py @param {number} r */
function roundedSquare(px, py, r) {
	const qx = Math.abs(px - 32) - (32 - r),
		qy = Math.abs(py - 32) - (32 - r);
	return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * The mark at `size` px. `tile` rounds the corners; a maskable or Apple icon
 * bleeds to the edge (the platform cuts its own shape) with the mark shrunk by
 * `scale` into the safe zone.
 *
 * @param {number} size
 * @param {{ tile: boolean, scale?: number }} opts
 */
function draw(size, { tile, scale = 1 }) {
	/** @param {string} h @returns {number[]} */
	const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
	const bg = hex(LIGHT.tile),
		fg = hex(LIGHT.mark);
	const unit = 64 / size; // design units per pixel
	const px = Buffer.alloc(size * size * 4);
	/** @param {number} d */
	const cover = (d) => Math.max(0, Math.min(1, 0.5 - d / unit));
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const ux = (x + 0.5) * unit,
				uy = (y + 0.5) * unit;
			// The mark, scaled about the centre.
			const mx = 32 + (ux - 32) / scale,
				my = 32 + (uy - 32) / scale;
			const roof = Math.min(segment(mx, my, EAVE_L, APEX), segment(mx, my, APEX, EAVE_R));
			const dMark =
				Math.min(roof - ROOF_W / 2, Math.hypot(mx - CORE[0], my - CORE[1]) - CORE_R) * scale;
			const a = tile ? cover(roundedSquare(ux, uy, CORNER)) : 1;
			const m = cover(dMark);
			const i = (y * size + x) * 4;
			for (let c = 0; c < 3; c++)
				px[i + c] = Math.round((bg[c] ?? 0) + ((fg[c] ?? 0) - (bg[c] ?? 0)) * m);
			px[i + 3] = Math.round(a * 255);
		}
	}
	return png(size, px);
}

// ---- a PNG, RGBA, by hand ----
const CRC = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
/** @param {Buffer} buf */
function crc(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = (CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const sum = Buffer.alloc(4);
	sum.writeUInt32BE(crc(td));
	return Buffer.concat([len, td, sum]);
}
/** @param {number} size @param {Buffer} rgba */
function png(size, rgba) {
	const head = Buffer.alloc(13);
	head.writeUInt32BE(size, 0);
	head.writeUInt32BE(size, 4);
	head.set([8, 6, 0, 0, 0], 8);
	const rows = Buffer.alloc(size * (size * 4 + 1));
	for (let y = 0; y < size; y++)
		rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', head),
		chunk('IDAT', deflateSync(rows, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const out = {
	'favicon.svg': svg(),
	'favicon.png': draw(64, { tile: true }),
	'icon-192.png': draw(192, { tile: true }),
	'icon-512.png': draw(512, { tile: true }),
	// 0.72 keeps the roof's ends well inside the 80% circle a launcher may cut.
	'icon-maskable-512.png': draw(512, { tile: false, scale: 0.72 }),
	// iOS rounds the corners itself, and leaves a transparent corner black.
	'apple-touch-icon.png': draw(180, { tile: false, scale: 0.8 })
};
for (const [name, data] of Object.entries(out)) writeFileSync(join(STATIC, name), data);
const gap = CORE[1] - CORE_R - (EAVE_L[1] + ROOF_W / 2);
console.log(`gap: ${gap} units = ${((gap * 16) / 64).toFixed(2)} px at 16px`);
console.log(`wrote ${Object.keys(out).join(', ')} in static/`);
