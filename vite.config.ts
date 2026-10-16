/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { coreProxy } from './server/vite-plugin.js';

export default defineConfig({
	plugins: [
		// Before SvelteKit, so `/api/v1/…` never reaches the app's router.
		coreProxy(),
		sveltekit({ adapter: adapter({ out: 'build' }) })
	],
	server: { port: 5180, strictPort: true },
	test: { include: ['src/**/*.test.ts', 'server/**/*.test.js'] }
});
