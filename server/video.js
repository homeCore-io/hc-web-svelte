/**
 * Live video, passed through to go2rtc (Reolink plugin, C6).
 *
 * The browser plays a camera from this server's own address, `/video/…`, and
 * this server passes it to go2rtc (`HC_GO2RTC_URL`): MSE over a WebSocket,
 * stills and stream files. So video works where the app works — over HTTPS,
 * away from home — and only for someone signed in. go2rtc itself has no idea
 * who anyone is, so three things are held here:
 *
 * - **Who.** The session is checked with homeCore (`/auth/me`), not only read
 *   from its cookie, and remembered for a minute per token.
 * - **What.** Only go2rtc's addresses for watching are passed on. Its own API
 *   (its streams, with the cameras' passwords in them; adding one; its
 *   config) is not.
 * - **Which.** A stream is asked for by name. go2rtc would also take an
 *   address (`src=rtsp://…`) and go and fetch it, which would let a page make
 *   it reach anywhere; that is refused.
 */
import http from 'node:http';
import https from 'node:https';
import { resolveSession } from './session.js';
import { originAllowed } from './proxy.js';

export const PREFIX = '/video';

/** go2rtc's address, without a trailing slash; empty when there's no video. */
export function go2rtcUrl() {
	return (process.env.HC_GO2RTC_URL ?? '').replace(/\/+$/, '');
}

/** @param {string | undefined} url */
export function isVideoPath(url) {
	return url !== undefined && (url === PREFIX || url.startsWith(`${PREFIX}/`));
}

/** go2rtc's addresses for watching, and nothing else. */
const WATCH = [
	/^\/api\/ws$/,
	/^\/api\/frame\.(jpeg|mp4)$/,
	/^\/api\/stream\.(mp4|m3u8|mjpeg|ts|aac|flv)$/,
	/^\/api\/hls\/[A-Za-z0-9._-]+$/
];

/** A stream's name: no address, nothing that reaches out. */
const NAME = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * The go2rtc path and query for a `/video/…` request, or why not.
 * @param {string} url
 * @returns {{ ok: true, path: string } | { ok: false, status: number }}
 */
export function videoTarget(url) {
	const u = new URL(url, 'http://x');
	const path = u.pathname.slice(PREFIX.length) || '/';
	if (!WATCH.some((r) => r.test(path))) return { ok: false, status: 404 };
	// HLS segments carry go2rtc's own session id, not a stream.
	if (!path.startsWith('/api/hls/')) {
		const src = u.searchParams.getAll('src');
		if (src.length !== 1 || !NAME.test(src[0] ?? '')) return { ok: false, status: 400 };
	}
	return { ok: true, path: path + u.search };
}

/** @type {Map<string, { ok: boolean, at: number }>} */
const known = new Map();
const TTL_MS = 60_000;

/**
 * Whether the request's session is someone homeCore knows now.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} core
 * @param {boolean} secure
 */
async function signedIn(req, core, secure) {
	const session = await resolveSession(req.headers.cookie, { core, secure });
	if (session === undefined) return false;
	const now = Date.now();
	for (const [k, v] of known) if (now - v.at > TTL_MS) known.delete(k);
	const cached = known.get(session.token);
	if (cached) return cached.ok;
	let ok = false;
	try {
		const res = await fetch(`${core}/api/v1/auth/me`, {
			headers: { authorization: `Bearer ${session.token}` }
		});
		ok = res.ok;
	} catch {
		return false;
	}
	known.set(session.token, { ok, at: now });
	return ok;
}

/** @param {import('node:http').IncomingMessage} req */
function isSecure(req) {
	return (
		/** @type {import('node:tls').TLSSocket} */ (req.socket).encrypted === true ||
		req.headers['x-forwarded-proto'] === 'https'
	);
}

/** Headers for go2rtc: none of the browser's cookies, origin or credentials. */
const DROP = new Set([
	'connection',
	'keep-alive',
	'proxy-connection',
	'transfer-encoding',
	'upgrade',
	'te',
	'trailer',
	'host',
	'cookie',
	'authorization',
	'origin',
	'referer'
]);

/**
 * @param {import('node:http').IncomingHttpHeaders} incoming
 * @param {string} host
 */
export function videoHeaders(incoming, host) {
	/** @type {Record<string, string | string[]>} */
	const out = {};
	for (const [name, value] of Object.entries(incoming)) {
		if (value !== undefined && !DROP.has(name)) out[name] = value;
	}
	out.host = host;
	return out;
}

/** @param {string} base */
function target(base) {
	const url = new URL(base);
	return { url, client: url.protocol === 'https:' ? https : http };
}

/**
 * A request for a still or a stream file.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} core
 */
export async function videoRequest(req, res, core) {
	const say = (/** @type {number} */ status, /** @type {string} */ error) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ error }));
	};
	const base = go2rtcUrl();
	if (base === '') return say(404, 'No live video here.');
	if (req.method !== 'GET' && req.method !== 'HEAD') return say(405, 'Only watching.');
	const t = videoTarget(req.url ?? '');
	if (!t.ok) return say(t.status, 'Not a stream to watch.');
	if (!(await signedIn(req, core, isSecure(req)))) return say(401, 'Not signed in.');
	const { url, client } = target(base);
	const upstream = client.request(
		{
			protocol: url.protocol,
			hostname: url.hostname,
			port: url.port,
			method: req.method,
			path: t.path,
			headers: videoHeaders(req.headers, url.host)
		},
		(reply) => {
			/** @type {Record<string, string | string[] | number>} */
			const headers = {};
			for (const [name, value] of Object.entries(reply.headers)) {
				if (value !== undefined && !DROP.has(name) && !name.startsWith('access-control-'))
					headers[name] = value;
			}
			headers['cache-control'] = 'no-store';
			res.writeHead(reply.statusCode ?? 502, headers);
			reply.pipe(res);
		}
	);
	upstream.on('error', () => {
		if (!res.headersSent) say(502, 'go2rtc is not answering.');
		else res.destroy();
	});
	req.on('close', () => upstream.destroy());
	upstream.end();
}

/**
 * Live video's WebSocket (MSE, or WebRTC's signalling).
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:stream').Duplex} socket
 * @param {Buffer} head
 * @param {string} core
 */
export async function videoUpgrade(req, socket, head, core) {
	const refuse = (/** @type {number} */ status, /** @type {string} */ text) => {
		socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
	};
	const base = go2rtcUrl();
	if (base === '') return refuse(404, 'Not Found');
	// Watching a camera is as good as reading the house: the stricter rule.
	if (!originAllowed('POST', req.headers)) return refuse(403, 'Forbidden');
	const t = videoTarget(req.url ?? '');
	if (!t.ok) return refuse(t.status, t.status === 404 ? 'Not Found' : 'Bad Request');
	if (!(await signedIn(req, core, isSecure(req)))) return refuse(401, 'Unauthorized');
	const { url, client } = target(base);
	const upstream = client.request({
		protocol: url.protocol,
		hostname: url.hostname,
		port: url.port,
		method: 'GET',
		path: t.path,
		headers: {
			...videoHeaders(req.headers, url.host),
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
	upstream.on('response', (reply) => refuse(reply.statusCode ?? 502, reply.statusMessage ?? ''));
	upstream.on('error', () => refuse(502, 'Bad Gateway'));
	upstream.end();
}
