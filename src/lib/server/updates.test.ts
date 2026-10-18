import { describe, expect, it } from 'vitest';
import { latest, newer } from './updates.js';

describe('update check', () => {
	it('compares versions as numbers', () => {
		expect(newer('0.1.10', '0.1.9')).toBe(true);
		expect(newer('v0.1.83', '0.1.83')).toBe(false);
		expect(newer('0.2.0', '0.1.99')).toBe(true);
		expect(newer('0.1.82', '0.1.83')).toBe(false);
	});

	it('asks GitHub for each, by release or else by tag, once a while', async () => {
		const asked: string[] = [];
		const get = (async (url: string) => {
			asked.push(url);
			if (url.includes('hc-web-svelte/releases')) return new Response('', { status: 404 });
			if (url.includes('hc-web-svelte/tags'))
				return new Response(
					JSON.stringify([{ name: 'v0.1.9' }, { name: 'v0.1.12' }, { name: 'x' }])
				);
			return new Response(JSON.stringify({ tag_name: 'v0.1.90', html_url: 'https://x/r' }));
		}) as typeof fetch;
		expect(await latest(get, 1)).toEqual({
			core: { version: '0.1.90', url: 'https://x/r' },
			app: {
				version: '0.1.12',
				url: 'https://github.com/homeCore-io/hc-web-svelte/tree/v0.1.12'
			}
		});
		expect(asked).toHaveLength(3);
		await latest(get, 2);
		expect(asked).toHaveLength(3);
	});
});
