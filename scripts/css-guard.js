/**
 * The built CSS must keep the standard backdrop-filter wherever it has the
 * -webkit- one. When a source rule declared both, the minifier once kept only
 * the prefixed copy, which Chrome and Firefox ignore, so every glass surface
 * lost its blur and the page behind read through the phone's sheets.
 *
 * Run after `npm run build`, as part of `npm run budget`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = '.svelte-kit/output/client/_app/immutable/assets';
if (!existsSync(dir)) {
	console.error('No build found. Run `npm run build` first.');
	process.exit(2);
}

/** @type {string[]} */
const bad = [];
for (const name of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
	const css = readFileSync(path.join(dir, name), 'utf8');
	// Each declaration block: what sits between a { and the next }.
	for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
		const body = m[2] ?? '';
		const prefixed = /-webkit-backdrop-filter\s*:/.test(body);
		const standard = /(^|[;\s])backdrop-filter\s*:/.test(body);
		if (prefixed && !standard) bad.push(`${name}: ${(m[1] ?? '').trim().slice(0, 80)}`);
	}
}

if (bad.length > 0) {
	console.error('These rules lost the standard backdrop-filter in the build:');
	for (const b of bad) console.error(`  ${b}`);
	process.exit(1);
}
console.log('Built CSS: every -webkit-backdrop-filter has a standard backdrop-filter beside it.');
