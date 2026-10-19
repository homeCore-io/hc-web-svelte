/**
 * Install a WLED firmware file someone chose (hc-wled's "Install from a
 * file"). The image is a megabyte or two, and homeCore's MQTT carries a
 * quarter of one, so it goes from here to the controller directly — with the
 * plugin either side of it: `firmware_file_begin` backs the controller up and
 * says an install is under way; `firmware_file_end` waits for it to come
 * back and says what it runs.
 *
 * `POST ?name=WLED_16.0.1_ESP32.bin` with the file as the body. Admins only
 * (`plugins:write`, which both plugin actions need too).
 */
import type { RequestHandler } from './$types';
import { json, secure } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';

const DEVICE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const NAME = /^[A-Za-z0-9._-]{1,120}\.bin$/;
/** The version a WLED release file says it is: WLED_<version>_<build>.bin */
const VERSION = /^WLED_(.+)_[^_]+\.bin$/;

export const POST: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('plugins:write'))
		return json({ error: 'Only an admin can install firmware.' }, 403, who.setCookies);
	const device = event.params.device;
	const name = event.url.searchParams.get('name') ?? '';
	if (!DEVICE.test(device) || !NAME.test(name))
		return json({ error: 'Choose a .bin firmware file.' }, 400, who.setCookies);
	const image = new Uint8Array(await event.request.arrayBuffer());
	if (image.length < 100_000 || image.length > 8 * 1024 * 1024)
		return json({ error: "That file isn't a firmware image." }, 400, who.setCookies);
	const version = VERSION.exec(name)?.[1];

	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	const plugin = async (action: string, params: Record<string, unknown>) => {
		const res = await fetch(`${coreUrl()}/api/v1/plugins/plugin.wled/command`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${session?.token ?? ''}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ action, device_id: device, ...params })
		});
		const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		if (!res.ok || body.status === 'error')
			throw new Error(typeof body.error === 'string' ? body.error : `homeCore said ${res.status}`);
		return body;
	};

	let host: string;
	try {
		const begun = await plugin('firmware_file_begin', version ? { version } : {});
		host = String(begun.host ?? '');
		if (!host) throw new Error("the plugin didn't say where the controller is");
	} catch (e) {
		return json({ error: (e as Error).message }, 502, who.setCookies);
	}

	let sent: { ok: true } | { ok: false; error: string };
	try {
		const form = new FormData();
		form.append('update', new Blob([image], { type: 'application/octet-stream' }), name);
		const res = await fetch(`http://${host}/update`, { method: 'POST', body: form });
		const text = await res.text().catch(() => '');
		sent = res.ok
			? { ok: true }
			: {
					ok: false,
					error: /subnet/i.test(text)
						? 'the controller only takes updates from its own subnet'
						: /pin/i.test(text)
							? "the controller's settings are locked with a PIN"
							: `the controller said ${res.status}`
				};
	} catch (e) {
		sent = { ok: false, error: `couldn't reach the controller: ${(e as Error).message}` };
	}

	try {
		const end = await plugin('firmware_file_end', {
			ok: sent.ok,
			...(sent.ok ? {} : { error: sent.error }),
			...(version ? { version } : {})
		});
		return json({ running: end.running }, 200, who.setCookies);
	} catch (e) {
		return json({ error: (e as Error).message }, 502, who.setCookies);
	}
};
