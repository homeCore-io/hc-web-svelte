/**
 * Sessions — homeCore's token, kept where page scripts cannot read it.
 *
 * homeCore decides who someone is (S4); the UI server only carries the proof.
 * Signing in through `/ui/auth/login` puts homeCore's access and refresh tokens
 * in two httpOnly cookies, and everything the UI server passes through to
 * homeCore gets the access token added on the way (`proxy.js`). So the app's
 * own code never holds a credential: a script injected into the page has
 * nothing to steal, and the event stream — which a browser cannot send headers
 * to — is authenticated by the server rather than by a token in a URL the page
 * built.
 *
 * Nothing here verifies a token. Reading `exp` only decides *when to refresh*;
 * homeCore checks every token it is sent.
 */

export const ACCESS = 'hc_at';
export const REFRESH = 'hc_rt';

/** Refresh this long before the access token actually expires. */
const SKEW_MS = 60_000;

/**
 * The cookies in a request's `Cookie` header.
 * @param {string | undefined | null} header
 * @returns {Record<string, string>}
 */
export function parseCookies(header) {
	/** @type {Record<string, string>} */
	const out = {};
	for (const part of (header ?? '').split(';')) {
		const at = part.indexOf('=');
		if (at < 0) continue;
		const name = part.slice(0, at).trim();
		if (name === '') continue;
		try {
			out[name] = decodeURIComponent(part.slice(at + 1).trim());
		} catch {
			// A cookie someone else set badly is not ours to fail on.
		}
	}
	return out;
}

/**
 * When a JWT says it expires, in milliseconds, or undefined if it doesn't say.
 * @param {string} token
 * @returns {number | undefined}
 */
export function expiresAt(token) {
	const payload = token.split('.')[1];
	if (payload === undefined) return undefined;
	try {
		const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return typeof claims.exp === 'number' ? claims.exp * 1000 : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Whether an access token is still good to send.
 * @param {string | undefined} token
 * @param {number} now
 */
export function isFresh(token, now) {
	if (token === undefined || token === '') return false;
	const exp = expiresAt(token);
	// No expiry we can read: send it and let homeCore decide.
	return exp === undefined || exp - SKEW_MS > now;
}

/**
 * One `Set-Cookie` value.
 * @param {string} name
 * @param {string} value
 * @param {number} maxAgeSeconds
 * @param {boolean} secure
 */
function cookie(name, value, maxAgeSeconds, secure) {
	return [
		`${name}=${encodeURIComponent(value)}`,
		'Path=/',
		`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
		'HttpOnly',
		// Strict: no other site can make a browser send these, which is most of
		// the defence against cross-site requests; `proxy.js` checks Origin too.
		'SameSite=Strict',
		...(secure ? ['Secure'] : [])
	].join('; ');
}

/**
 * @typedef {object} Grant
 * @property {string} token
 * @property {number} [expires_in]
 * @property {string} [refresh_token]
 * @property {number} [refresh_expires_in]
 */

/**
 * The cookies for a grant homeCore just issued (login or refresh).
 * @param {Grant} grant
 * @param {boolean} secure
 * @returns {string[]}
 */
export function grantCookies(grant, secure) {
	const out = [cookie(ACCESS, grant.token, grant.expires_in ?? 3600, secure)];
	if (grant.refresh_token !== undefined) {
		out.push(cookie(REFRESH, grant.refresh_token, grant.refresh_expires_in ?? 86400, secure));
	}
	return out;
}

/** @param {boolean} secure */
export function clearCookies(secure) {
	return [cookie(ACCESS, '', 0, secure), cookie(REFRESH, '', 0, secure)];
}

/**
 * Refreshes in flight, and recently finished, by the refresh token they used.
 *
 * **A refresh token can be used exactly once.** homeCore rotates them and
 * treats a second use as theft, revoking the whole chain — so a page that
 * fires six requests the moment its access token runs out would, refreshing
 * six times, sign its person out. One refresh per token, shared by everyone
 * who presents it; and kept a little while after it finishes, for the
 * requests that left the browser carrying the old cookie before the new one
 * arrived.
 * @type {Map<string, { at: number, grant: Promise<Grant | undefined> }>}
 */
const refreshes = new Map();
const KEEP_MS = 30_000;

/**
 * A new access token for this refresh token — at most one request to homeCore
 * per refresh token, however many callers ask.
 * @param {string} core
 * @param {string} refreshToken
 * @param {number} [now]
 * @returns {Promise<Grant | undefined>}
 */
export function refreshGrant(core, refreshToken, now = Date.now()) {
	for (const [key, entry] of refreshes) {
		if (now - entry.at > KEEP_MS) refreshes.delete(key);
	}
	const known = refreshes.get(refreshToken);
	if (known !== undefined) return known.grant;
	const grant = requestRefresh(core, refreshToken);
	refreshes.set(refreshToken, { at: now, grant });
	return grant;
}

/**
 * @param {string} core
 * @param {string} refreshToken
 * @returns {Promise<Grant | undefined>}
 */
async function requestRefresh(core, refreshToken) {
	try {
		const res = await fetch(`${core}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ refresh_token: refreshToken })
		});
		if (!res.ok) return undefined;
		const body = await res.json();
		return typeof body?.token === 'string' ? body : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @typedef {object} Session
 * @property {string} token        the access token to send to homeCore
 * @property {string[]} setCookies cookies to send back, when it was refreshed
 */

/**
 * The session a request carries, refreshing it if the access token has run out.
 *
 * Undefined means "not signed in": no cookies, or a refresh homeCore refused.
 * @param {string | undefined | null} cookieHeader
 * @param {{ core: string, secure: boolean, now?: number }} opts
 * @returns {Promise<Session | undefined>}
 */
export async function resolveSession(cookieHeader, opts) {
	const jar = parseCookies(cookieHeader);
	const now = opts.now ?? Date.now();
	const access = jar[ACCESS];
	if (access !== undefined && isFresh(access, now)) return { token: access, setCookies: [] };

	const refresh = jar[REFRESH];
	if (refresh === undefined || refresh === '') return undefined;
	const grant = await refreshGrant(opts.core, refresh);
	if (grant === undefined) return undefined;
	return { token: grant.token, setCookies: grantCookies(grant, opts.secure) };
}
