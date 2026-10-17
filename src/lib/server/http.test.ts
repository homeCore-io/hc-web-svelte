import { afterEach, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { secure } from './http.js';

const event = (url: string, headers: Record<string, string> = {}) =>
	({ url: new URL(url), request: new Request(url, { headers }) }) as unknown as RequestEvent;

describe('secure cookies', () => {
	afterEach(() => {
		delete process.env.ORIGIN;
	});

	it('not over plain HTTP, whatever adapter-node calls the request', () => {
		// adapter-node with no ORIGIN reports https for a plain-HTTP request.
		expect(secure(event('https://10.0.10.150:3001/ui/auth/login'))).toBe(false);
	});

	it('when a TLS proxy in front says so, or ORIGIN is https', () => {
		expect(secure(event('http://10.0.10.150:3001/', { 'x-forwarded-proto': 'https' }))).toBe(true);
		process.env.ORIGIN = 'https://home.example';
		expect(secure(event('https://home.example/'))).toBe(true);
	});
});
