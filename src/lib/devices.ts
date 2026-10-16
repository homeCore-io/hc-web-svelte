/**
 * Devices as homeCore sends them, and how the app's copy follows the stream.
 *
 * Pure functions over plain data, like `house.ts`; `devices.svelte.ts` holds
 * the result. Shapes follow homeCore's own types (`hc-types` `DeviceState`,
 * `DeviceSchema`) — only the fields the app reads.
 */

export interface StateLabel {
	label: string;
	verb?: string;
}

export interface AttributeSchema {
	kind:
		| 'bool'
		| 'integer'
		| 'float'
		| 'string'
		| 'enum'
		| 'color_xy'
		| 'color_rgb'
		| 'color_temp'
		| 'json';
	writable?: boolean;
	display_name?: string;
	unit?: string;
	min?: number;
	max?: number;
	step?: number;
	options?: (string | { value: string; label?: string })[];
	category?: 'diagnostic' | 'config';
	states?: { when_true: StateLabel; when_false: StateLabel };
}

export interface ParamSpec {
	name: string;
	kind: string;
	label?: string;
	required?: boolean;
	default?: unknown;
	unit?: string;
	min?: number;
	max?: number;
	options?: { value: string; label?: string }[];
	options_from?: {
		attribute?: { attribute: string; label_key?: string; value_key?: string };
		devices?: { device_type?: string; facet?: string; plugin_id?: string; exclude_self?: boolean };
	};
}

export interface DeviceAction {
	id: string;
	label: string;
	category?: string;
	confirm?: string;
	/** The attribute this action stands in for (a Roku's `select_source` for `source`). */
	writes?: string;
	params?: ParamSpec[];
}

export interface Schema {
	attributes: Record<string, AttributeSchema>;
	actions?: DeviceAction[];
	primary?: string[];
}

export interface Change {
	changed_at?: string;
	kind?: 'homecore' | 'physical' | 'external' | 'unknown';
	source?: string;
	actor_name?: string;
	correlation_id?: string;
}

/** A device as homeCore sends it. */
export interface CoreDevice {
	device_id: string;
	name: string;
	name_override?: string;
	/** homeCore's rule-facing name: set once, so renaming never breaks a rule. */
	canonical_name?: string;
	plugin_id?: string;
	area?: string;
	area_override?: string;
	device_type?: string;
	ui_hint?: string;
	status_icon?: string;
	available: boolean;
	attributes: Record<string, unknown>;
	last_seen?: string;
	last_change?: Change;
	attributes_changed_at?: Record<string, string>;
	button_names?: Record<string, string>;
	/** Inline in a snapshot and in `GET /devices?include_schema=true`. */
	schema?: Schema | null;
}

/** One frame from the event stream, as far as devices are concerned. */
export type DeviceFrame =
	| { type: 'snapshot'; devices?: CoreDevice[] }
	| {
			type: 'device_state_changed';
			timestamp: string;
			device_id: string;
			current: Record<string, unknown>;
			changed: string[];
			change?: Change;
	  }
	| {
			type: 'device_availability_changed';
			timestamp: string;
			device_id: string;
			available: boolean;
	  }
	| { type: 'device_added' | 'device_metadata_changed'; device: CoreDevice }
	| { type: 'device_removed'; device_id: string }
	| { type: 'device_name_changed'; device_id: string; current_name: string }
	| { type: string };

export type Devices = Record<string, CoreDevice>;

/** What a frame did to the devices, and which schemas now need fetching. */
export interface DevicesUpdate {
	devices: Devices;
	/** Devices whose schema the app doesn't have, or that just changed. */
	fetchSchema: string[];
}

export function fromList(list: CoreDevice[]): Devices {
	const out: Devices = {};
	for (const d of list) out[d.device_id] = d;
	return out;
}

/**
 * The devices after a frame, or `undefined` if the frame is not about
 * devices. Only the device a frame names is replaced, so a card for any other
 * device keeps the object it had and does not redraw.
 */
export function devicesAfter(devices: Devices, frame: DeviceFrame): DevicesUpdate | undefined {
	const f = frame as Record<string, unknown> & { type: string };
	switch (f.type) {
		case 'snapshot': {
			const list = f.devices as CoreDevice[] | undefined;
			return list === undefined ? undefined : { devices: fromList(list), fetchSchema: [] };
		}
		case 'device_state_changed': {
			const e = frame as Extract<DeviceFrame, { type: 'device_state_changed' }>;
			const d = devices[e.device_id];
			if (d === undefined) return undefined;
			const changedAt = { ...d.attributes_changed_at };
			for (const key of e.changed) changedAt[key] = e.timestamp;
			return replace(devices, {
				...d,
				attributes: e.current,
				attributes_changed_at: changedAt,
				last_seen: e.timestamp,
				last_change: e.change ?? d.last_change
			});
		}
		case 'device_availability_changed': {
			const e = frame as Extract<DeviceFrame, { type: 'device_availability_changed' }>;
			const d = devices[e.device_id];
			return d === undefined ? undefined : replace(devices, { ...d, available: e.available });
		}
		case 'device_added':
		case 'device_metadata_changed': {
			const next = (frame as { device: CoreDevice }).device;
			const known = devices[next.device_id];
			// The record carries no schema; the one already held still applies.
			const schema = next.schema ?? known?.schema;
			const update = replace(devices, { ...next, schema });
			if (schema === undefined || schema === null) update.fetchSchema = [next.device_id];
			return update;
		}
		case 'device_removed': {
			const id = f.device_id as string;
			if (!(id in devices)) return undefined;
			const rest = { ...devices };
			delete rest[id];
			return { devices: rest, fetchSchema: [] };
		}
		case 'device_schema_changed': {
			const id = f.device_id as string;
			return id in devices ? { devices, fetchSchema: [id] } : undefined;
		}
		case 'device_name_changed': {
			// From a homeCore before H2, which says nothing else about renames.
			const e = frame as Extract<DeviceFrame, { type: 'device_name_changed' }>;
			const d = devices[e.device_id];
			return d === undefined ? undefined : replace(devices, { ...d, name: e.current_name });
		}
		default:
			return undefined;
	}
}

function replace(devices: Devices, device: CoreDevice): DevicesUpdate {
	return { devices: { ...devices, [device.device_id]: device }, fetchSchema: [] };
}

/** The name a person sees: their override, else what the bridge calls it. */
export function displayName(d: CoreDevice): string {
	return d.name_override ?? d.name;
}

/** The slug of the room a device is in: the person's choice, else the bridge's. */
export function roomSlug(d: CoreDevice): string | undefined {
	return d.area_override ?? d.area;
}
