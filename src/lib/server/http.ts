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
