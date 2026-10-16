/**
 * The house's devices, kept current from the event stream (H2).
 *
 * The snapshot on connect, then state, availability, metadata, added and
 * removed events. A homeCore from before H2 sends no snapshot and no metadata
 * events, so the list is also loaded once over REST — ignored if a snapshot
 * got there first, as for rooms.
 */
import { devicesAfter, fromList, type CoreDevice, type Devices, type Schema } from './devices.js';
import { live } from './live.svelte.js';
import { commands } from './commands.svelte.js';

class DeviceStore {
	byId = $state<Devices>({});
	loaded = $state(false);
	#unfollow: (() => void) | null = null;
	#streamed = false;

	async load(): Promise<void> {
		this.#follow();
		try {
			const res = await fetch('/api/v1/devices?include_schema=true');
			const list = res.ok ? ((await res.json()) as CoreDevice[]) : undefined;
			if (list === undefined || this.#streamed) return;
			this.byId = fromList(list);
			this.loaded = true;
		} catch {
			// Nothing to show yet; the stream may still deliver a snapshot.
		}
	}

	#follow(): void {
		this.#unfollow ??= live.listen((frame) => {
			const update = devicesAfter(this.byId, frame);
			if (update === undefined) return;
			if (frame.type === 'snapshot') {
				this.#streamed = true;
				this.loaded = true;
			}
			this.byId = update.devices;
			for (const id of update.fetchSchema) void this.#fetchSchema(id);
			if (frame.type === 'device_state_changed') {
				const id = (frame as unknown as { device_id: string }).device_id;
				const d = this.byId[id];
				if (d !== undefined) commands.settle(id, d.attributes);
			}
		});
	}

	/**
	 * Read one device again, for a change homeCore doesn't announce (a
	 * helper's settings, A1). Keeps the schema the app already has.
	 */
	async refresh(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/v1/devices/${encodeURIComponent(id)}`);
			if (!res.ok) return;
			const fresh = (await res.json()) as CoreDevice;
			const had = this.byId[id];
			this.byId = { ...this.byId, [id]: { ...fresh, schema: fresh.schema ?? had?.schema } };
		} catch {
			// The next event about it will bring it up to date.
		}
	}

	async #fetchSchema(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/schema`);
			if (!res.ok) return;
			const schema = (await res.json()) as Schema;
			const d = this.byId[id];
			if (d !== undefined) this.byId = { ...this.byId, [id]: { ...d, schema } };
		} catch {
			// The card falls back to what it can say without a schema.
		}
	}
}

export const devices = new DeviceStore();
