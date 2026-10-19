/**
 * A WLED controller's effect and palette catalogue, kept as a copy here — for
 * a controller whose catalogue is kept "in the app" (hc-wled's
 * `catalog_storage`), so its pickers work while it is offline.
 *
 * `GET ?firmware=16.0.1` answers with the copy when it was taken from that
 * firmware, else asks homeCore for it now (as the person asking — anyone who
 * can see devices may: it is a read-only plugin query), keeps it, and answers
 * with that. A firmware update changes the effects, so it is copied again.
 */
import type { RequestHandler } from './$types';
import { json, secure } from '#lib/server/http.js';
import { whoIs } from '#lib/server/identity.js';
import { docs } from '#lib/server/docs.js';
import { coreUrl } from '#server/config.js';
import { resolveSession } from '#server/session.js';

const KIND = 'wled-catalog';
const DEVICE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export const GET: RequestHandler = async (event) => {
	const who = await whoIs(event);
	if (!who.ok) return json({ error: who.error }, who.status, who.setCookies);
	if (!who.person.scopes.includes('devices:read'))
		return json({ error: 'Not allowed.' }, 403, who.setCookies);
	const device = event.params.device;
	if (!DEVICE.test(device)) return json({ error: 'No such controller.' }, 400, who.setCookies);
	const firmware = event.url.searchParams.get('firmware') ?? '';
	const fresh = event.url.searchParams.get('refresh') === '1';

	const kept = await docs()
		.read(KIND, device)
		.catch(() => undefined);
	if (kept && !fresh && (firmware === '' || kept.firmware === firmware)) {
		const { version: _v, updated_at: _u, ...catalog } = kept;
		return json({ ...catalog, kept: true }, 200, who.setCookies);
	}

	const session = await resolveSession(event.request.headers.get('cookie'), {
		core: coreUrl(),
		secure: secure(event)
	});
	let catalog: Record<string, unknown>;
	try {
		const res = await fetch(`${coreUrl()}/api/v1/plugins/plugin.wled/query`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${session?.token ?? ''}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ action: 'get_catalog', device_id: device })
		});
		catalog = (await res.json()) as Record<string, unknown>;
		if (!res.ok || catalog.status === 'error')
			throw new Error(typeof catalog.error === 'string' ? catalog.error : String(res.status));
	} catch (e) {
		// Offline: the copy from another firmware beats nothing.
		if (kept) {
			const { version: _v, updated_at: _u, ...old } = kept;
			return json({ ...old, kept: true, stale: true }, 200, who.setCookies);
		}
		return json(
			{ error: `The controller isn't answering: ${(e as Error).message}` },
			502,
			who.setCookies
		);
	}
	const { status: _s, request_id: _r, ...body } = catalog;
	for (let attempt = 0; attempt < 3; attempt++) {
		const current = await docs()
			.read(KIND, device)
			.catch(() => undefined);
		const w = await docs().write(KIND, device, body, current?.version ?? 0);
		if (w.ok) break;
	}
	return json({ ...body, kept: false }, 200, who.setCookies);
};
