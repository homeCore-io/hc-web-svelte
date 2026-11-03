/**
 * Small helpers for the UI server's own routes (`/ui/…`).
 */
import type { RequestEvent } from '@sveltejs/kit';

/** Whether cookies set for this request should be `Secure`. */
export function secure(event: RequestEvent): boolean {
	// Not `event.url.protocol`: adapter-node calls every request https unless
	// ORIGIN says otherwise, and this server speaks plain HTTP itself. Secure
	// cookies over plain HTTP are dropped by the browser, so nobody could sign
	// in. Secure only when a TLS proxy in front says so, or ORIGIN names https.
	if (event.request.headers.get('x-forwarded-proto') === 'https') return true;
	return (process.env.ORIGIN ?? '').startsWith('https:');
}

/** A JSON response, with any cookies a refresh or sign-in produced. */
export function json(body: unknown, status = 200, setCookies: readonly string[] = []): Response {
	const headers = new Headers({ 'content-type': 'application/json' });
	for (const c of setCookies) headers.append('set-cookie', c);
	return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Bytes as a response, answering a `Range` request with just that part (206),
 * as Safari asks before it plays a video. Anything it can't read gets the whole.
 */
export function bytesResponse(
	request: Request,
	bytes: Uint8Array<ArrayBuffer>,
	headers: Headers
): Response {
	headers.set('accept-ranges', 'bytes');
	const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (m && (m[1] || m[2])) {
		const size = bytes.length;
		let start = m[1] ? Number(m[1]) : size - Number(m[2]);
		let end = m[1] && m[2] ? Number(m[2]) : size - 1;
		start = Math.max(0, start);
		end = Math.min(end, size - 1);
		if (start > end || start >= size) {
			headers.set('content-range', `bytes */${size}`);
			return new Response(null, { status: 416, headers });
		}
		headers.set('content-range', `bytes ${start}-${end}/${size}`);
		return new Response(bytes.slice(start, end + 1), { status: 206, headers });
	}
	return new Response(bytes, { status: 200, headers });
}
