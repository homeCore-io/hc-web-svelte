import type { Handle } from '@sveltejs/kit/hooks';
import { originAllowed } from '#server/proxy.js';

/**
 * The UI server's own routes take the same cross-site rule as the pass-through
 * to homeCore (`server/proxy.js`): a request that changes something must come
 * from this origin.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/ui/')) {
		const headers = Object.fromEntries(event.request.headers);
		if (!originAllowed(event.request.method, headers)) {
			return new Response(JSON.stringify({ error: 'cross-site request refused' }), {
				status: 403,
				headers: { 'content-type': 'application/json' }
			});
		}
	}
	return resolve(event);
};
