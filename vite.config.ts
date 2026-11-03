/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { coreProxy } from './server/vite-plugin.js';

// The app's version, for System (A6): the release tag in CI, else package.json's.
const version =
	process.env.APP_VERSION ||
	(
		JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
			version: string;
		}
	).version;

export default defineConfig({
	define: { __APP_VERSION__: JSON.stringify(version) },
	plugins: [
		// Before SvelteKit, so `/api/v1/…` never reaches the app's router.
		coreProxy(),
		sveltekit({ adapter: adapter({ out: 'build' }) })
	],
	server: { port: 5180, strictPort: true },
	test: {
		include: ['src/**/*.test.ts', 'server/**/*.test.js'],
		setupFiles: ['src/lib/testSetup.ts']
	}
});
