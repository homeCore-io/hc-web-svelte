import { describe, expect, it } from 'vitest';
import { forwardHeaders, isCorePath, mayForward, originAllowed } from './proxy.js';

describe('what is passed through to homeCore', () => {
	it('is everything under /api/v1, and nothing else', () => {
		expect(isCorePath('/api/v1/devices')).toBe(true);
		expect(isCorePath('/api/v1?x=1')).toBe(true);
		expect(isCorePath('/api/v1')).toBe(true);
		expect(isCorePath('/api/v10')).toBe(false);
		expect(isCorePath('/ui/me')).toBe(false);
		expect(isCorePath('/')).toBe(false);
	});
});

describe('a request from somewhere else', () => {
	const at = { host: 'home.local:3000' };
	it('may read', () => {
		expect(originAllowed('GET', { ...at, origin: 'https://evil.example' })).toBe(true);
	});
	it('may not change anything', () => {
		expect(originAllowed('POST', { ...at, origin: 'https://evil.example' })).toBe(false);
		expect(originAllowed('PATCH', { ...at, origin: 'not a url' })).toBe(false);
	});
	it('is not refused when it is this origin, or not from a browser page at all', () => {
		expect(originAllowed('POST', { ...at, origin: 'http://home.local:3000' })).toBe(true);
		expect(originAllowed('POST', at)).toBe(true);
	});
});

describe('the headers homeCore gets', () => {
	it('carry the session token, and never the browser cookies', () => {
		const out = forwardHeaders(
			{
				cookie: 'hc_at=secret',
				accept: 'application/json',
				host: 'home.local',
				connection: 'keep-alive'
			},
			'tok',
			'10.0.10.150:8080'
		);
		expect(out).toEqual({
			accept: 'application/json',
			host: '10.0.10.150:8080',
			authorization: 'Bearer tok'
		});
	});
	it('keep a credential the caller brought', () => {
		expect(forwardHeaders({ authorization: 'Bearer mine' }, 'tok', 'c').authorization).toBe(
			'Bearer mine'
		);
	});
});

describe('a request with no credential', () => {
	// homeCore makes whitelisted addresses admin with no token, and every
	// request through the UI server comes from its address — so anonymous
	// requests must stop here, or anybody who can reach the UI server is admin.
	it('is not passed on', () => {
		expect(mayForward('/api/v1/devices', false)).toBe(false);
		expect(mayForward('/api/v1/events/stream', false)).toBe(false);
	});
	it('is passed on only to sign in', () => {
		expect(mayForward('/api/v1/auth/login', false)).toBe(true);
		expect(mayForward('/api/v1/auth/refresh?x', false)).toBe(true);
	});
	it('is judged by homeCore once it carries one', () => {
		expect(mayForward('/api/v1/devices', true)).toBe(true);
	});
});
