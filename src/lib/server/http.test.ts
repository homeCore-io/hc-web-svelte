import { afterEach, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { secure, bytesResponse } from './http.js';

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

describe('bytes with ranges', () => {
	const bytes = new TextEncoder().encode('0123456789');
	const get = (range?: string) =>
		bytesResponse(
			new Request('http://x/', range ? { headers: { range } } : {}),
			bytes,
			new Headers()
		);
	it('answers a range with that part, and anything else with the whole', async () => {
		const part = get('bytes=2-4');
		expect(part.status).toBe(206);
		expect(part.headers.get('content-range')).toBe('bytes 2-4/10');
		expect(await part.text()).toBe('234');
		expect(await get('bytes=7-').text()).toBe('789');
		expect(await get('bytes=-3').text()).toBe('789');
		expect(get('bytes=20-').status).toBe(416);
		const whole = get();
		expect(whole.status).toBe(200);
		expect(whole.headers.get('accept-ranges')).toBe('bytes');
		expect(get('nonsense').status).toBe(200);
	});
});
