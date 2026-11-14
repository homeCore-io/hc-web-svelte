/**
 * Two things in one list with the same shown name ("Temp/Humidity Ch 1" from
 * two gateways, two "Test Door Sensor"s) can't be told apart. For each name
 * shown more than once, a short word that tells them apart: their brands when
 * those differ, else what differs in their ids ("aisle 1", "temp 1"; "44", "45").
 */
import type { CoreDevice } from '../devices.js';
import { brandOf } from './room.js';

export function apart(list: CoreDevice[], shown: (d: CoreDevice) => string): Map<string, string> {
	const out = new Map<string, string>();
	const byName = new Map<string, CoreDevice[]>();
	for (const d of list) {
		const k = shown(d).trim().toLowerCase();
		byName.set(k, [...(byName.get(k) ?? []), d]);
	}
	for (const same of byName.values()) {
		if (same.length < 2) continue;
		const brands = same.map((d) => brandOf(d.plugin_id));
		if (new Set(brands).size === same.length) {
			same.forEach((d, i) => out.set(d.device_id, brands[i]!));
			continue;
		}
		const ids = same.map((d) => d.device_id);
		let lead = 0;
		while (lead < ids[0]!.length && ids.every((id) => id[lead] === ids[0]![lead])) lead++;
		// Back to the start of the part that differs: "zwave_44" and "zwave_45" say 44 and 45.
		while (lead > 0 && /[a-z0-9]/i.test(ids[0]![lead - 1]!)) lead--;
		same.forEach((d) => out.set(d.device_id, d.device_id.slice(lead).replace(/[_-]+/g, ' ')));
	}
	return out;
}

/**
 * Each one's shown name, with what tells it apart from another of the same
 * name in `list` after it: "Outlet - Living Room AC (41)".
 */
export function namesApart(
	list: CoreDevice[],
	shown: (d: CoreDevice) => string
): (d: CoreDevice) => string {
	const by = apart(list, shown);
	return (d) => {
		const w = by.get(d.device_id);
		return w ? `${shown(d)} (${w})` : shown(d);
	};
}
