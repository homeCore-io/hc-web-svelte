import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ACCESS,
	DISPLAY,
	REFRESH,
	clearCookies,
	displayCookies,
	unlockCookies,
	expiresAt,
	grantCookies,
	isFresh,
	parseCookies,
	refreshGrant,
	resolveSession
} from './session.js';

/** A JWT-shaped token with this payload; the signature is never checked here. */
const jwt = (/** @type {object} */ claims) =>
	`x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

const NOW = 1_800_000_000_000;

afterEach(() => vi.unstubAllGlobals());

describe('reading cookies', () => {
	it('reads the pairs and decodes values', () => {
		expect(parseCookies('a=1; hc_at=x%2By; b')).toEqual({ a: '1', hc_at: 'x+y' });
	});
	it('survives no header and a malformed value', () => {
		expect(parseCookies(undefined)).toEqual({});
		expect(parseCookies('bad=%E0%A4%A')).toEqual({});
	});
});

describe('when an access token runs out', () => {
	it('reads exp in milliseconds', () => {
		expect(expiresAt(jwt({ exp: 1000 }))).toBe(1_000_000);
		expect(expiresAt('not-a-jwt')).toBeUndefined();
	});
	it('is refreshed a minute early', () => {
		expect(isFresh(jwt({ exp: NOW / 1000 + 120 }), NOW)).toBe(true);
		expect(isFresh(jwt({ exp: NOW / 1000 + 30 }), NOW)).toBe(false);
	});
	it('is sent anyway when it says nothing, for homeCore to judge', () => {
		expect(isFresh(jwt({ sub: 'x' }), NOW)).toBe(true);
		expect(isFresh(undefined, NOW)).toBe(false);
	});
});

describe('the cookies', () => {
	it('are httpOnly and strictly same-site, Secure only over https', () => {
		const [access, refresh] = grantCookies(
			{ token: 't', expires_in: 60, refresh_token: 'r', refresh_expires_in: 120 },
			false
		);
		expect(access).toBe(`${ACCESS}=t; Path=/; Max-Age=60; HttpOnly; SameSite=Strict`);
		expect(refresh).toContain(`${REFRESH}=r`);
		expect(grantCookies({ token: 't' }, true)[0]).toContain('; Secure');
	});
	it('are cleared by expiring them', () => {
		expect(clearCookies(false).every((c) => c.includes('Max-Age=0'))).toBe(true);
	});
});

describe('a session', () => {
	it('uses a fresh access token as it is, without asking homeCore', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const token = jwt({ exp: NOW / 1000 + 3600 });
		const s = await resolveSession(`${ACCESS}=${token}`, {
			core: 'http://c',
			secure: false,
			now: NOW
		});
		expect(s).toEqual({ token, setCookies: [] });
		expect(fetch).not.toHaveBeenCalled();
	});

	it('is refreshed when the access token has run out, and says so in new cookies', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ token: 'new', refresh_token: 'r2' })))
		);
		const s = await resolveSession(`${ACCESS}=${jwt({ exp: 1 })}; ${REFRESH}=r1`, {
			core: 'http://c',
			secure: false,
			now: NOW
		});
		expect(s?.token).toBe('new');
		expect(s?.setCookies.join()).toContain(`${REFRESH}=r2`);
	});

	it('is gone when there is nothing to refresh with, or homeCore refuses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('{}', { status: 401 }))
		);
		expect(await resolveSession('', { core: 'http://c', secure: false, now: NOW })).toBeUndefined();
		expect(
			await resolveSession(`${REFRESH}=refused`, { core: 'http://c', secure: false, now: NOW })
		).toBeUndefined();
	});
});

describe('a refresh token', () => {
	it('is used once however many requests present it at the same time', async () => {
		// homeCore revokes the whole chain when a refresh token is reused, so six
		// requests arriving with an expired access token must make one refresh.
		const fetch = vi.fn(async () => new Response(JSON.stringify({ token: 'once' })));
		vi.stubGlobal('fetch', fetch);
		const all = await Promise.all(
			Array.from({ length: 6 }, () => refreshGrant('http://c', 'shared-token', NOW))
		);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(all.every((g) => g?.token === 'once')).toBe(true);
	});

	it('is forgotten after a while, so the map does not grow forever', async () => {
		const fetch = vi.fn(async () => new Response(JSON.stringify({ token: 'x' })));
		vi.stubGlobal('fetch', fetch);
		await refreshGrant('http://c', 'old-token', NOW);
		await refreshGrant('http://c', 'old-token', NOW + 60_000);
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});

describe('a display (H3, H5)', () => {
	const opts = { core: 'http://core', secure: false, now: NOW };

	it('is signed in as itself when nobody else is', async () => {
		const s = await resolveSession(`${DISPLAY}=hc_sk_kitchen`, opts);
		expect(s).toEqual({ token: 'hc_sk_kitchen', setCookies: [], display: 'hc_sk_kitchen' });
	});

	it('a person unlocked on it goes first, and the display is still known', async () => {
		const person = jwt({ exp: NOW / 1000 + 300 });
		const s = await resolveSession(`${DISPLAY}=hc_sk_kitchen; ${ACCESS}=${person}`, opts);
		expect(s?.token).toBe(person);
		expect(s?.display).toBe('hc_sk_kitchen');
	});

	it('when their few minutes are up, it is the display again', async () => {
		const spent = jwt({ exp: NOW / 1000 - 10 });
		const s = await resolveSession(`${DISPLAY}=hc_sk_kitchen; ${ACCESS}=${spent}`, opts);
		expect(s?.token).toBe('hc_sk_kitchen');
	});

	it('becoming one ends a person’s session; unlocking gives no refresh token', () => {
		const set = displayCookies('hc_sk_k', false);
		expect(set[0]).toMatch(/^hc_dk=hc_sk_k; Path=\/; Max-Age=34560000; HttpOnly; SameSite=Strict$/);
		expect(set.slice(1).every((c) => /Max-Age=0/.test(c))).toBe(true);
		const unlock = unlockCookies('tok', 300, true);
		expect(unlock[0]).toMatch(
			/^hc_at=tok; Path=\/; Max-Age=300; HttpOnly; SameSite=Strict; Secure$/
		);
		expect(unlock[1]).toMatch(/^hc_rt=; .*Max-Age=0/);
	});

	it('signing a person out there leaves the display signed in', () => {
		expect(clearCookies(false).some((c) => c.startsWith(`${DISPLAY}=`))).toBe(false);
	});
});
