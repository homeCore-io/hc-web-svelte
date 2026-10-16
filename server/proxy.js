/**
 * homeCore, passed through (S3).
 *
 * The browser talks to one origin: the UI server. Everything under `/api/v1`
 * — requests and the event stream alike — goes on to homeCore unchanged,
 * except that the session's token is added (`session.js`) and the browser's
 * cookies are not sent on. homeCore needs no CORS, and the app's code never
 * holds a credential.
 *
 * One implementation for both places it runs: the dev server mounts it as a
 * Vite plugin (`vite-plugin.js`) and the production server calls it directly
 * (`index.js`), so what is tried in development is what ships.
 */
import http from 'node:http';
import https from 'node:https';
import { resolveSession } from './session.js';

/** @param {string | undefined} url */
export function isCorePath(url) {
	if (url === undefined) return false;
	return url === '/api/v1' || url.startsWith('/api/v1/') || url.startsWith('/api/v1?');
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** homeCore routes anyone may call: signing in is how a credential is got. */
const PUBLIC = new Set(['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/health']);

/**
 * Whether to pass a request on when it carries no credential at all.
 *
 * **Never, except to sign in.** homeCore treats some addresses as trusted
 * (`[auth].whitelist`) and makes any request from them an admin, with no
 * token needed — and every request through the UI server comes from the UI
 * server's address. On the reference house that address is whitelisted, so a
 * pass-through that forwarded anonymous requests handed admin to anybody who
 * could reach this server. A credential always wins over the whitelist in
 * homeCore, so a request that carries one is judged as its own.
 * @param {string | undefined} url
 * @param {boolean} credentialed
 */
export function mayForward(url, credentialed) {
	if (credentialed) return true;
	const path = (url ?? '').split('?')[0] ?? '';
	return PUBLIC.has(path);
}

/**
 * Whether a request may change something, judged by where it came from.
 *
 * The session cookies are `SameSite=Strict`, so another site cannot make a
 * browser send them; this is the second lock. A browser always says where a
 * cross-site request came from, so a state-changing request whose Origin is
 * not this server is refused. One with no Origin at all is not from a
 * browser page and is let through — it has no cookies to borrow.
 * @param {string | undefined} method
 * @param {import('node:http').IncomingHttpHeaders} headers
 */
export function originAllowed(method, headers) {
	if (SAFE.has(method ?? 'GET')) return true;
	const origin = headers.origin;
	if (origin === undefined) return true;
	try {
		return new URL(origin).host === headers.host;
	} catch {
		return false;
	}
}

/** Headers that describe one hop, not the request. */
const HOP = new Set([
	'connection',
	'keep-alive',
	'proxy-connection',
	'transfer-encoding',
	'upgrade',
	'te',
	'trailer',
	'host',
	'cookie'
]);

/**
 * The headers to send to homeCore.
 * @param {import('node:http').IncomingHttpHeaders} incoming
 * @param {string | undefined} token
 * @param {string} coreHost
 */
export function forwardHeaders(incoming, token, coreHost) {
	/** @type {Record<string, string | string[]>} */
	const out = {};
	for (const [name, value] of Object.entries(incoming)) {
		if (value === undefined || HOP.has(name)) continue;
		out[name] = value;
	}
	out.host = coreHost;
	// A caller that brought its own credential (a script, a test) keeps it.
	if (token !== undefined && out.authorization === undefined) {
		out.authorization = `Bearer ${token}`;
	}
	return out;
}

/** @param {string} core */
function target(core) {
	const url = new URL(core);
	return { url, client: url.protocol === 'https:' ? https : http };
}

/** @param {import('node:http').IncomingMessage} req */
function isSecure(req) {
	return (
		/** @type {import('node:tls').TLSSocket} */ (req.socket).encrypted === true ||
		req.headers['x-forwarded-proto'] === 'https'
	);
}

/**
 * Pass one HTTP request through to homeCore.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} core
 */
export async function proxyRequest(req, res, core) {
	if (!originAllowed(req.method, req.headers)) {
		res.writeHead(403, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'cross-site request refused' }));
		return;
	}
	const session = await resolveSession(req.headers.cookie, { core, secure: isSecure(req) });
	if (!mayForward(req.url, session !== undefined || req.headers.authorization !== undefined)) {
		res.writeHead(401, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error: 'Not signed in.' }));
		return;
	}
	const { url, client } = target(core);

	const upstream = client.request(
		{
			protocol: url.protocol,
			hostname: url.hostname,
			port: url.port,
			method: req.method,
			path: req.url,
			headers: forwardHeaders(req.headers, session?.token, url.host)
		},
		(reply) => {
			/** @type {Record<string, string | string[] | number>} */
			const headers = {};
			for (const [name, value] of Object.entries(reply.headers)) {
				if (value !== undefined && !HOP.has(name)) headers[name] = value;
			}
			if (session !== undefined && session.setCookies.length > 0) {
				headers['set-cookie'] = session.setCookies;
			}
			res.writeHead(reply.statusCode ?? 502, headers);
			reply.pipe(res);
		}
	);
	upstream.on('error', () => {
		if (!res.headersSent) {
			res.writeHead(502, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ error: 'homeCore is not answering' }));
		} else {
			res.destroy();
		}
	});
	req.pipe(upstream);
}

/**
 * Pass a WebSocket upgrade — the event stream — through to homeCore.
 *
 * homeCore authenticates its stream by a `token` query parameter, because a
 * browser cannot set headers on a WebSocket. The server adds it here, from the
 * session, so the page never builds a URL with a credential in it.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:stream').Duplex} socket
 * @param {Buffer} head
 * @param {string} core
 */
export async function proxyUpgrade(req, socket, head, core) {
	const refuse = (/** @type {number} */ status, /** @type {string} */ text) => {
		socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
	};
	// An upgrade is a GET, but opening the stream is as good as reading the
	// house, so it is held to the stricter rule.
	if (!originAllowed('POST', req.headers)) return refuse(403, 'Forbidden');

	const session = await resolveSession(req.headers.cookie, { core, secure: isSecure(req) });
	const path = new URL(req.url ?? '/', 'http://x');
	const credentialed = session !== undefined || path.searchParams.has('token');
	if (!mayForward(req.url, credentialed)) return refuse(401, 'Unauthorized');
	const { url, client } = target(core);
	if (session !== undefined) path.searchParams.set('token', session.token);

	const upstream = client.request({
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port,
		method: 'GET',
		path: path.pathname + path.search,
		headers: {
			...forwardHeaders(req.headers, undefined, url.host),
			connection: 'Upgrade',
			upgrade: req.headers.upgrade ?? 'websocket'
		}
	});

	upstream.on('upgrade', (reply, upstreamSocket, upstreamHead) => {
		const lines = [`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}`];
		for (let i = 0; i < reply.rawHeaders.length; i += 2) {
			lines.push(`${reply.rawHeaders[i]}: ${reply.rawHeaders[i + 1]}`);
		}
		socket.write(lines.join('\r\n') + '\r\n\r\n');
		if (upstreamHead.length > 0) socket.write(upstreamHead);
		if (head.length > 0) upstreamSocket.write(head);
		upstreamSocket.pipe(socket).pipe(upstreamSocket);
		upstreamSocket.on('error', () => socket.destroy());
		socket.on('error', () => upstreamSocket.destroy());
	});
	// homeCore answered without upgrading — usually 401. Say so and close.
	upstream.on('response', (reply) => refuse(reply.statusCode ?? 502, reply.statusMessage ?? ''));
	upstream.on('error', () => refuse(502, 'Bad Gateway'));
	upstream.end();
}
