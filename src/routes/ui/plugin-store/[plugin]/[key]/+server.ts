/**
 * A plugin's own screens' store (`host.store`): JSON documents the UI server
 * keeps for one plugin — a copy of a catalogue, a remembered choice. UI data
 * lives here, never in homeCore.
 *
 * `GET` reads one (404 when there is none); `PUT` writes it whole (the body is
 * the value); `DELETE` removes it. For anyone who can see devices: a plugin's
 * panel is shown to whoever opens one of its devices.
 */
import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';

const PLUGIN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** A catalogue with every effect's controls runs to a few hundred KB. */
const MAX_BYTES = 2 * 1024 * 1024;
const KIND = 'plugin-store';
/** One kind, the plugin in the name: `plugin_wled--catalog-wled_6ace04`. */
const name = (plugin: string, key: string) => `${plugin.replace(/[^a-z0-9_-]/g, '_')}--${key}`;

async function allowed(event: Parameters<RequestHandler>[0]) {
	const who = await whoIs(event);
	if (!who.ok) return { fail: json({ error: who.error }, who.status, who.setCookies) };
	if (!who.person.scopes.includes('devices:read'))
		return { fail: json({ error: 'Not allowed.' }, 403, who.setCookies) };
	const { plugin, key } = event.params;
	if (!PLUGIN.test(plugin) || !KEY.test(key))
		return { fail: json({ error: 'No such entry.' }, 400, who.setCookies) };
	return { who, plugin, key };
}

export const GET: RequestHandler = async (event) => {
	const a = await allowed(event);
	if ('fail' in a) return a.fail!;
	const doc = await docs()
		.read(KIND, name(a.plugin, a.key))
		.catch(() => undefined);
	if (!doc) return json({ error: 'Nothing kept.' }, 404, a.who.setCookies);
	return json({ value: doc.value, updated_at: doc.updated_at }, 200, a.who.setCookies);
};

export const PUT: RequestHandler = async (event) => {
	const a = await allowed(event);
	if ('fail' in a) return a.fail!;
	const text = await event.request.text();
	if (text.length > MAX_BYTES) return json({ error: 'Too large.' }, 413, a.who.setCookies);
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return json({ error: 'Not JSON.' }, 400, a.who.setCookies);
	}
	// Last write wins: a plugin's store holds what it last put there.
	for (let attempt = 0; attempt < 3; attempt++) {
		const current = await docs()
			.read(KIND, name(a.plugin, a.key))
			.catch(() => undefined);
		const w = await docs().write(KIND, name(a.plugin, a.key), { value }, current?.version ?? 0);
		if (w.ok) return json({ ok: true }, 200, a.who.setCookies);
	}
	return json({ error: 'It changed while saving; try again.' }, 409, a.who.setCookies);
};

export const DELETE: RequestHandler = async (event) => {
	const a = await allowed(event);
	if ('fail' in a) return a.fail!;
	await docs().remove(KIND, name(a.plugin, a.key));
	return json({ ok: true }, 200, a.who.setCookies);
};
