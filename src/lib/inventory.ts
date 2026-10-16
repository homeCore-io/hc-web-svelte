/**
 * Settings → Devices (A1): every device the house has, as an admin's list —
 * filters, a row per device, and what's wrong with it. Pure; the page reads
 * the live device store.
 */
import { cardFor, kindOf, ago } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import { roomOf } from './summary.js';
import type { Room } from './house.js';

export type Filter = 'all' | 'noroom' | 'battery' | 'offline';

export interface Row {
	id: string;
	name: string;
	kind: string;
	kindLabel: string;
	room: Room | undefined;
	plugin: string;
	pluginLabel: string;
	/** How it is now, or what's wrong. */
	now: string;
	warn: boolean;
	offline: boolean;
	batteryLow: boolean;
	/** "now", "3 min ago", or "never". */
	seen: string;
	/** A plugin's scene: a device in homeCore's model, but not a thing in a room. */
	scene: boolean;
}

const PLUGIN_NAMES: Record<string, string> = {
	hue: 'Hue',
	lutron: 'Lutron',
	caseta: 'Caséta',
	yolink: 'YoLink',
	ecowitt: 'Ecowitt',
	zwave: 'Z-Wave',
	sonos: 'Sonos',
	roku: 'Roku',
	wled: 'WLED',
	matter: 'Matter'
};

/** "plugin.zwave" → "Z-Wave"; homeCore's own (core.*) → "homeCore". */
export function pluginLabel(id: string | undefined): string {
	if (!id) return 'Unknown';
	if (id === 'core.mode') return 'homeCore modes';
	if (id.startsWith('core.')) return 'homeCore helpers';
	const bare = id.replace(/^plugin\./, '');
	return PLUGIN_NAMES[bare] ?? bare.replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** "temperature_sensor" → "Temperature sensor". */
export const kindLabel = (k: string) =>
	k === '' ? 'Device' : (k[0]!.toUpperCase() + k.slice(1)).replace(/_/g, ' ');

export function seenText(d: CoreDevice, now: number): string {
	if (!d.last_seen) return 'never';
	const ms = now - Date.parse(d.last_seen);
	if (!Number.isFinite(ms)) return 'never';
	return ms < 60_000 ? 'now' : `${ago(ms)} ago`;
}

export function rowOf(d: CoreDevice, rooms: Room[], now = Date.now()): Row {
	const card = cardFor(d, now);
	const kind = kindOf(d);
	const batteryLow = card.alarm === 'low battery';
	const offline = !d.available;
	const warn = card.alarm !== undefined;
	return {
		id: d.device_id,
		name: displayName(d),
		kind,
		kindLabel: kindLabel(kind),
		room: roomOf(d, rooms),
		plugin: d.plugin_id ?? '',
		pluginLabel: pluginLabel(d.plugin_id),
		now: offline
			? 'Offline'
			: [card.stateLine, batteryLow ? 'battery low' : ''].filter(Boolean).join(' · '),
		warn,
		offline,
		batteryLow,
		seen: seenText(d, now),
		scene: kind === 'scene'
	};
}

export function rowsOf(devices: Devices, rooms: Room[], now = Date.now()): Row[] {
	return Object.values(devices)
		.map((d) => rowOf(d, rooms, now))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export interface Shown {
	filter: Filter;
	plugin: string;
	scenes: boolean;
	query: string;
}

const passes = (r: Row, f: Filter) =>
	f === 'all' ||
	(f === 'noroom' && r.room === undefined) ||
	(f === 'battery' && r.batteryLow) ||
	(f === 'offline' && r.offline);

/** Rows that pass everything but the chip — what the chips count over. */
function base(rows: Row[], s: Omit<Shown, 'filter'>): Row[] {
	const q = s.query.trim().toLowerCase();
	return rows.filter(
		(r) =>
			(s.scenes || !r.scene) &&
			(s.plugin === '' || r.plugin === s.plugin) &&
			(q === '' ||
				q
					.split(/\s+/)
					.every((w) =>
						`${r.name} ${r.room?.name ?? 'no room'} ${r.kindLabel} ${r.id} ${r.pluginLabel}`
							.toLowerCase()
							.includes(w)
					))
	);
}

export const shownRows = (rows: Row[], s: Shown) =>
	base(rows, s).filter((r) => passes(r, s.filter));

export function counts(rows: Row[], s: Omit<Shown, 'filter'>): Record<Filter, number> {
	const b = base(rows, s);
	return {
		all: b.length,
		noroom: b.filter((r) => passes(r, 'noroom')).length,
		battery: b.filter((r) => passes(r, 'battery')).length,
		offline: b.filter((r) => passes(r, 'offline')).length
	};
}

/** Plugins with devices, most first, for the plugin filter. */
export function plugins(
	rows: Row[],
	scenes: boolean
): { id: string; label: string; count: number }[] {
	const by = new Map<string, number>();
	for (const r of rows) if (scenes || !r.scene) by.set(r.plugin, (by.get(r.plugin) ?? 0) + 1);
	return [...by]
		.map(([id, count]) => ({ id, label: pluginLabel(id), count }))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
