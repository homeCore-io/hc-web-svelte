/**
 * The UI server's own change stream (M1): server-sent events naming each
 * document that changed, for the screens it concerns — a person's own
 * document only to that person, the household's to everyone. The screen then
 * reads the document.
 *
 * House facts are not here; they come on homeCore's stream (H2).
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';

/** A comment line now and then keeps proxies from closing a quiet stream. */
const KEEPALIVE_MS = 25_000;

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	const me = who.person.id.toLowerCase();

	const encoder = new TextEncoder();
	let stop = () => {};
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					stop();
				}
			};
			send(': connected\n\n');
			const unlisten = docs().listen((change) => {
				const mine = change.kind === 'person' && change.id === me;
				const everyone = change.kind === 'house';
				if (mine || everyone) send(`event: change\ndata: ${JSON.stringify(change)}\n\n`);
			});
			const timer = setInterval(() => send(': keepalive\n\n'), KEEPALIVE_MS);
			stop = () => {
				clearInterval(timer);
				unlisten();
			};
			event.request.signal.addEventListener('abort', () => {
				stop();
				try {
					controller.close();
				} catch {
					// Already closed.
				}
			});
		},
		cancel() {
			stop();
		}
	});

	const headers = new Headers({
		'content-type': 'text/event-stream',
		'cache-control': 'no-cache, no-transform',
		connection: 'keep-alive'
	});
	for (const c of who.setCookies) headers.append('set-cookie', c);
	return new Response(stream, { headers });
};
