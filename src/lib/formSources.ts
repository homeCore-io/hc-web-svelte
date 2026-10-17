/**
 * A descriptor field's live options (A4): `source: core_resource` names
 * something of the house's — `all_devices` (narrowed by `capability`),
 * `devices` (the plugin's own), `areas` (rooms) — that the client lists, so a
 * plugin's settings choose a sensor by name rather than taking a typed id.
 */
import { displayName, type CoreDevice } from './devices.js';
import type { Opt, Source } from './descriptor.js';
import type { Room } from './house.js';

/** Whether a device offers what a field asks for: "temperature", "switch". */
export function offers(d: CoreDevice, capability: string | undefined): boolean {
	if (!capability) return true;
	const attrs = d.schema?.attributes ?? {};
	if (capability === 'switch') return attrs.on?.kind === 'bool' && attrs.on.writable !== false;
	if (capability in attrs || capability in (d.attributes ?? {})) return true;
	return (
		Object.keys(attrs).some((a) => a.startsWith(`${capability}_`)) ||
		(d.device_type ?? '').includes(capability)
	);
}

/** The options a source stands for, or undefined when it isn't one this app knows. */
export function sourceOptions(
	source: Source | undefined,
	all: CoreDevice[],
	rooms: Room[],
	pluginId?: string
): Opt[] | undefined {
	if (!source || source.kind !== 'core_resource') return undefined;
	const room = (d: CoreDevice) => {
		const slug = d.area_override ?? d.area;
		return rooms.find((r) => r.slug === slug || r.aliases.includes(slug ?? ''))?.name;
	};
	const label = (d: CoreDevice) => {
		const r = room(d);
		return r ? `${displayName(d)} — ${r}` : displayName(d);
	};
	switch (source.ref) {
		case 'all_devices':
		case 'devices':
			return all
				.filter((d) => source.ref === 'all_devices' || !pluginId || d.plugin_id === pluginId)
				.filter((d) => offers(d, source.capability))
				.sort((a, b) => label(a).localeCompare(label(b)))
				.map((d) => ({ value: d.device_id, label: label(d) }));
		case 'areas':
			return [...rooms]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((r) => ({ value: r.slug, label: r.name }));
		default:
			return undefined;
	}
}
