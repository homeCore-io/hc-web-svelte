/**
 * A room's Switches tab (the LivingRoom board): its switches in columns by
 * system, a numbered set ("Holiday Lights 1" to "4") in a column of its own
 * with All on and All off, and a plug's power beside its name. Timers,
 * buttons and anything else with actions of its own sit with them.
 */
import type { CoreDevice } from '#lib/devices.js';

export interface SwitchCol {
	key: string;
	/** Its system, for the column's tag. */
	plugin: string;
	title: string;
	devices: CoreDevice[];
	/** A set switched together: All on and All off. */
	together: boolean;
}

/** At most this many to a column; more go on in the next. */
export const PER_COL = 7;

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
/** "Holiday Lights 3" → "Holiday Lights"; a name without a number has no set. */
const setOf = (name: string): string | undefined => /^(.*\S)\s+\d+$/.exec(name)?.[1];
const byName = (a: CoreDevice, b: CoreDevice) =>
	nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true });

/** Whether it's an on/off switch the person can flip. */
export const flips = (d: CoreDevice): boolean =>
	d.schema?.attributes.on?.writable === true ||
	(d.schema === undefined && typeof d.attributes.on === 'boolean');

/** What its plug draws, when it says: "3.7 W". */
export function drawOf(d: CoreDevice): string | undefined {
	const w = d.attributes.power ?? d.attributes.power_w ?? d.attributes.watts;
	if (typeof w !== 'number') return undefined;
	return `${w >= 100 ? Math.round(w) : Math.round(w * 10) / 10} W`;
}

export function switchCols(list: CoreDevice[]): SwitchCol[] {
	const cols: SwitchCol[] = [];
	const plugins = [...new Set(list.map((d) => d.plugin_id ?? ''))].sort();
	for (const plugin of plugins) {
		const mine = list.filter((d) => (d.plugin_id ?? '') === plugin).sort(byName);
		// A set: two or more flippable switches that differ only by their number.
		const sets = new Map<string, CoreDevice[]>();
		for (const d of mine) {
			const s = setOf(nameOf(d));
			if (s !== undefined && flips(d)) sets.set(s, [...(sets.get(s) ?? []), d]);
		}
		const inSet = new Set<string>();
		for (const [title, devices] of sets) {
			if (devices.length < 2) continue;
			for (const d of devices) inSet.add(d.device_id);
			cols.push(...split({ key: `${plugin}:${title}`, plugin, title, devices, together: true }));
		}
		const rest = mine.filter((d) => !inSet.has(d.device_id));
		if (rest.length === 0) continue;
		const plugs = rest.every((d) => drawOf(d) !== undefined);
		cols.push(
			...split({
				key: `${plugin}:`,
				plugin,
				title: plugs ? (rest.length > 1 ? 'Plugs' : 'Plug') : 'Switches',
				devices: rest,
				together: false
			})
		);
	}
	return cols;
}

/** A column longer than `PER_COL` goes on in the next, under the same title. */
function split(c: SwitchCol): SwitchCol[] {
	if (c.devices.length <= PER_COL) return [c];
	const out: SwitchCol[] = [];
	for (let i = 0; i < c.devices.length; i += PER_COL)
		out.push({
			...c,
			key: `${c.key}#${i}`,
			title: i === 0 ? c.title : `${c.title}, more`,
			devices: c.devices.slice(i, i + PER_COL),
			together: c.together && i === 0
		});
	return out;
}
