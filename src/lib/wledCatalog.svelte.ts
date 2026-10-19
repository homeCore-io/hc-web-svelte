/**
 * A WLED controller's catalogue — each effect's controls, each palette's
 * colours — for the screens that need it, fetched once per controller and
 * firmware while the app is open.
 *
 * Where it comes from is the controller's own setting (`catalog_storage`):
 * read from the controller (hc-wled's read-only `get_catalog`, through
 * homeCore), or a copy the UI server keeps (`/ui/wled/catalog/…`), which
 * works while the controller is offline.
 */
import type { CoreDevice } from './devices.js';
import { catalogStorage, WLED, type Catalog } from './wled.js';

interface Entry {
	catalog?: Catalog;
	loading: boolean;
	error?: string;
	/** The firmware it was read from: a new one means new effects. */
	firmware: string;
}

const firmwareOf = (d: CoreDevice) => String(d.sw_version ?? '');

class WledCatalogs {
	byId = $state<Record<string, Entry>>({});

	/** The catalogue for `d` as far as it has loaded. Read it in markup;
	 * call `ensure` from an effect to have it loaded. */
	of(d: CoreDevice): Entry {
		return this.byId[d.device_id] ?? { loading: true, firmware: firmwareOf(d) };
	}

	/** Load it, unless it is loaded (from this firmware) or loading. */
	ensure(d: CoreDevice): void {
		const firmware = firmwareOf(d);
		const e = this.byId[d.device_id];
		// A failure stays until someone asks again (`load`), or the loop of
		// effect → load → state → effect would never end.
		if (e && (e.loading || (e.firmware === firmware && (e.catalog || e.error)))) return;
		void this.load(d, firmware);
	}

	async load(d: CoreDevice, firmware: string, refresh = false): Promise<void> {
		const id = d.device_id;
		this.byId = { ...this.byId, [id]: { ...this.byId[id], loading: true, firmware } };
		let entry: Entry;
		try {
			const res =
				catalogStorage(d) === 'app'
					? await fetch(
							`/ui/wled/catalog/${encodeURIComponent(id)}?firmware=${encodeURIComponent(firmware)}${refresh ? '&refresh=1' : ''}`
						)
					: await fetch(`/api/v1/plugins/${WLED}/query`, {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify({ action: 'get_catalog', device_id: id })
						});
			const body = (await res.json()) as Catalog & { status?: string; error?: string };
			if (!res.ok || body.status === 'error')
				throw new Error(body.error ?? `homeCore said ${res.status}`);
			entry = { catalog: body, loading: false, firmware };
		} catch (e) {
			entry = { loading: false, firmware, error: (e as Error).message };
		}
		this.byId = { ...this.byId, [id]: entry };
	}
}

export const wledCatalogs = new WledCatalogs();
