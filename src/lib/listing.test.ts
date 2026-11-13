import { afterEach, describe, expect, test, vi } from 'vitest';
import { listOf, refusal } from './listing.js';

describe('refusal', () => {
	test('names the reason a person can act on', () => {
		expect(refusal(403, 'displays')).toBe('This sign-in can’t see displays.');
		expect(refusal(401, 'displays')).toBe('This sign-in can’t see displays.');
		expect(refusal(null, 'displays')).toMatch(/isn’t answering/);
		expect(refusal(500, 'displays')).toBe('homeCore couldn’t list displays (error 500).');
	});
	test('blames the version only for a 404, and only when the page knows which', () => {
		expect(refusal(404, 'displays', '0.1.77')).toBe(
			'This homeCore doesn’t have displays yet. It needs v0.1.77 or later.'
		);
		expect(refusal(404, 'displays')).toBe('homeCore couldn’t list displays (error 404).');
		expect(refusal(403, 'displays', '0.1.77')).not.toMatch(/v0\.1\.77/);
	});
});

describe('listOf', () => {
	afterEach(() => vi.unstubAllGlobals());
	test('a list, a refusal, and no answer', async () => {
		vi.stubGlobal('fetch', async () => new Response('[1,2]', { status: 200 }));
		expect(await listOf<number[]>('/x')).toEqual({ ok: true, value: [1, 2] });
		vi.stubGlobal('fetch', async () => new Response('{}', { status: 403 }));
		expect(await listOf('/x')).toEqual({ ok: false, status: 403 });
		vi.stubGlobal('fetch', async () => {
			throw new TypeError('down');
		});
		expect(await listOf('/x')).toEqual({ ok: false, status: null });
	});
});
