/**
 * The performance budget's build-time half (06 — V5): the JavaScript the home
 * page needs, compressed, must stay at or under 150 KB.
 *
 * Measured from the build: the client entry and every chunk it imports,
 * statically, from the Vite manifest — what a browser has to download before
 * the home can run. Lazily loaded chunks are not counted against it. The
 * browser-side half (load time, tap response, element count) arrives with the
 * generated home in R2, measured against a recorded copy of the house.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LIMIT_KB = 150;
const client = '.svelte-kit/output/client';
const manifestPath = path.join(client, '.vite/manifest.json');

if (!existsSync(manifestPath)) {
	console.error('No build found. Run `npm run build` first.');
	process.exit(2);
}
/** @type {Record<string, { file: string, imports?: string[], isEntry?: boolean, src?: string }>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

// The home page's code: SvelteKit's entries, the root layout and the root page.
const starts = Object.entries(manifest)
	.filter(
		([key, c]) =>
			c.isEntry === true ||
			key.endsWith('src/routes/+layout.svelte') ||
			key.endsWith('src/routes/+page.svelte')
	)
	.map(([key]) => key);

/** @type {Set<string>} */
const seen = new Set();
const visit = (/** @type {string} */ key) => {
	if (seen.has(key) || manifest[key] === undefined) return;
	seen.add(key);
	for (const dep of manifest[key].imports ?? []) visit(dep);
};
starts.forEach(visit);

let bytes = 0;
for (const key of seen) {
	const file = manifest[key]?.file;
	if (file?.endsWith('.js')) bytes += gzipSync(readFileSync(path.join(client, file))).length;
}
const kb = bytes / 1024;
const verdict = kb <= LIMIT_KB ? 'within' : 'OVER';
console.log(
	`Home JavaScript: ${kb.toFixed(1)} KB compressed (${seen.size} chunks) — ${verdict} the ${LIMIT_KB} KB budget.`
);
process.exit(kb <= LIMIT_KB ? 0 : 1);
