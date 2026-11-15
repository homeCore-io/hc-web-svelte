/**
 * Settings › Scenes: every scene in the house as an admin's list, the way
 * Devices lists devices. homeCore's own scenes and plugins' together, each
 * saying who provides it and, in that plugin's words, where it lives (a
 * Lutron phantom button's number, a Hue room or zone). Pure; the page reads
 * the live stores.
 *
 * Hue brings the same scene to many rooms ("Tropical twilight" in the Office
 * and the Family Room, each its own device): those share one row here, which
 * opens to list each room's copy. Pickers list every copy on its own.
 */
import { kindOf } from './card.js';
import { displayName, type CoreDevice, type Devices } from './devices.js';
import { pluginLabel } from './inventory.js';
import { roomOf } from './summary.js';
import { agoOf, momentOf } from './when.js';
import { isHueScene, sceneActive, sceneTells } from './homeScenes.js';
import { ref } from './layers.js';
import type { Room } from './house.js';
import type { CoreScene } from './scenes.svelte.js';

/** The From filter's key for homeCore's own scenes. */
export const CORE = 'core';

export interface SceneRow {
	/** Its ref, or `hue:{name}` for a Hue scene in several rooms. */
	key: string;
	/** What it stands for: its own ref, or every copy's. */
	refs: string[];
	name: string;
	/** Its room; a Hue scene in several rooms, the first copy's. */
	room: Room | undefined;
	/** The Room column: the room, "No room", or "4 rooms". */
	roomText: string;
	/** In no room, or one of its copies is. */
	noRoom: boolean;
	/** `core`, or the plugin's id. */
	plugin: string;
	/** "homeCore", "Lutron", "Hue". */
	from: string;
	/** In the provider's words: "Phantom button 80", "Office (room)", "2 devices". */
	detail: string;
	/** It says when it's active, and is (one copy is). */
	active: boolean;
	now: 'Active' | 'Off' | 'n/a';
	/** When it last ran, as far as anyone can tell (ms). */
	lastRun?: number;
	/** On the house's Home row (one copy is). */
	onHome: boolean;
	/** Where tapping it goes: its editor, or its device page. */
	href: string;
	core: boolean;
	/** A Hue scene in several rooms: each room's copy. */
	copies?: SceneRow[];
}

/** "Phantom button 80", "Keypad scene", "Office (room)"; blank where a plugin says nothing. */
export function sceneDetail(d: CoreDevice): string {
	const a = d.attributes;
	const bare = d.plugin_id?.split('.').pop();
	if (bare === 'lutron')
		return typeof a.phantom_button === 'number'
			? `Phantom button ${a.phantom_button}`
			: 'Keypad scene';
	if (bare === 'hue' && typeof a.group_name === 'string' && a.group_name !== '')
		return typeof a.group_kind === 'string' && a.group_kind !== ''
			? `${a.group_name} (${a.group_kind})`
			: a.group_name;
	return '';
}

/**
 * When a plugin's scene last ran: its last change, where homeCore knows what
 * made it. A change of unknown kind is the plugin reporting what it has (at
 * its start, say), so it says nothing about a run.
 */
export function lastRunOf(d: CoreDevice): number | undefined {
	const c = d.last_change;
	if (!c?.changed_at || c.kind === undefined || c.kind === 'unknown') return undefined;
	const t = Date.parse(c.changed_at);
	return Number.isFinite(t) ? t : undefined;
}

/** "Today, 6:02 PM", "Yesterday, 9:15 AM", "4 d ago"; blank when nobody knows. */
export function lastRunText(t: number | undefined, now: number): string {
	if (t === undefined) return '';
	return now - t < 2 * 86_400_000 ? momentOf(t, now) : agoOf(t, now);
}

/** A plugin's scene as a row. */
export function deviceSceneRow(d: CoreDevice, rooms: Room[], home: Set<string>): SceneRow {
	const room = roomOf(d, rooms);
	const tells = sceneTells(d);
	const active = tells && sceneActive(d);
	const r = ref.device(d.device_id);
	return {
		key: r,
		refs: [r],
		name: displayName(d),
		room,
		roomText: room?.name ?? 'No room',
		noRoom: room === undefined,
		plugin: d.plugin_id ?? '',
		from: pluginLabel(d.plugin_id),
		detail: sceneDetail(d),
		active,
		now: active ? 'Active' : 'Off',
		lastRun: lastRunOf(d),
		onHome: home.has(r),
		href: `/settings/devices/${encodeURIComponent(d.device_id)}`,
		core: false
	};
}

/** homeCore's own scene as a row: in no room, and it can't say when it's active. */
export function coreSceneRow(s: CoreScene, home: Set<string>): SceneRow {
	const n = Object.keys(s.states ?? {}).length;
	const r = ref.scene(s.id);
	return {
		key: r,
		refs: [r],
		name: s.name,
		room: undefined,
		roomText: 'No room',
		noRoom: true,
		plugin: CORE,
		from: 'homeCore',
		detail: n === 1 ? 'One device' : `${n} devices`,
		active: false,
		now: 'n/a',
		onHome: home.has(r),
		href: `/settings/scenes/${encodeURIComponent(s.id)}`,
		core: true
	};
}

const byRoomThenName = (a: SceneRow, b: SceneRow) =>
	(a.room ? 0 : 1) - (b.room ? 0 : 1) ||
	(a.room?.name ?? '').localeCompare(b.room?.name ?? '') ||
	a.name.localeCompare(b.name);

/** Hue copies of one scene as one row; a name in one room alone stays as it is. */
export function groupOf(copies: SceneRow[]): SceneRow {
	if (copies.length === 1) return copies[0]!;
	const list = [...copies].sort(byRoomThenName);
	const first = list[0]!;
	const places = list.map((c) => c.room?.name ?? c.detail.replace(/ \((room|zone)\)$/, ''));
	const named = places.filter(Boolean);
	const active = list.some((c) => c.active);
	const runs = list.map((c) => c.lastRun).filter((t): t is number => t !== undefined);
	return {
		...first,
		key: `hue:${first.name}`,
		refs: list.map((c) => c.key),
		roomText: `${list.length} rooms`,
		noRoom: list.some((c) => c.noRoom),
		detail:
			named.length > 2 ? `${named.slice(0, 2).join(', ')} +${named.length - 2}` : named.join(', '),
		active,
		now: active ? 'Active' : 'Off',
		lastRun: runs.length > 0 ? Math.max(...runs) : undefined,
		onHome: list.some((c) => c.onHome),
		copies: list
	};
}

/** Every scene in the house as the page lists it, by name. */
export function sceneRows(
	devices: Devices,
	scenes: CoreScene[],
	rooms: Room[],
	homeRefs: string[] = []
): SceneRow[] {
	const home = new Set(homeRefs);
	const out: SceneRow[] = scenes.map((s) => coreSceneRow(s, home));
	const hue = new Map<string, SceneRow[]>();
	for (const d of Object.values(devices)) {
		if (kindOf(d) !== 'scene') continue;
		const row = deviceSceneRow(d, rooms, home);
		if (!isHueScene(d)) {
			out.push(row);
			continue;
		}
		const key = `${d.plugin_id}\u0000${row.name}`;
		hue.set(key, [...(hue.get(key) ?? []), row]);
	}
	for (const copies of hue.values()) out.push(groupOf(copies));
	return out.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

// ---- filters ----

export type Chip = 'all' | 'home' | 'active' | 'noroom';

export interface Shown {
	chip: Chip;
	/** `''` for any; `core`, or a plugin's id. */
	from: string;
	query: string;
}

const passes = (r: SceneRow, c: Chip) =>
	c === 'all' ||
	(c === 'home' && r.onHome) ||
	(c === 'active' && r.active) ||
	(c === 'noroom' && r.noRoom);

const words = (r: SceneRow): string =>
	[r.name, r.roomText, r.from, r.detail, ...(r.copies ?? []).flatMap((c) => [c.roomText, c.detail])]
		.join(' ')
		.toLowerCase();

/** Rows that pass everything but the chip: what the chips count over. */
function base(rows: SceneRow[], s: Omit<Shown, 'chip'>): SceneRow[] {
	const q = s.query.trim().toLowerCase();
	return rows.filter(
		(r) =>
			(s.from === '' || r.plugin === s.from) &&
			(q === '' || q.split(/\s+/).every((w) => words(r).includes(w)))
	);
}

export const shownScenes = (rows: SceneRow[], s: Shown): SceneRow[] =>
	base(rows, s).filter((r) => passes(r, s.chip));

/** The chips' counts, in rows as shown. */
export function sceneCounts(rows: SceneRow[], s: Omit<Shown, 'chip'>): Record<Chip, number> {
	const b = base(rows, s);
	return {
		all: b.length,
		home: b.filter((r) => passes(r, 'home')).length,
		active: b.filter((r) => passes(r, 'active')).length,
		noroom: b.filter((r) => passes(r, 'noroom')).length
	};
}

/** Who provides the house's scenes, for the From filter: homeCore first, then most first. */
export function providers(rows: SceneRow[]): { id: string; label: string; count: number }[] {
	const by = new Map<string, { label: string; count: number }>();
	for (const r of rows) {
		const p = by.get(r.plugin) ?? { label: r.from, count: 0 };
		p.count += 1;
		by.set(r.plugin, p);
	}
	return [...by]
		.map(([id, p]) => ({ id, ...p }))
		.sort(
			(a, b) =>
				(a.id === CORE ? -1 : b.id === CORE ? 1 : 0) ||
				b.count - a.count ||
				a.label.localeCompare(b.label)
		);
}

// ---- sorting ----

export type SortKey = 'name' | 'room' | 'from' | 'now' | 'run' | 'home';

const NOW_ORDER = { Active: 0, Off: 1, 'n/a': 2 } as const;

/** Rows sorted by a column; ties by name. Rooms sort by name, no room last. */
export function sortScenes(rows: SceneRow[], key: SortKey, desc = false): SceneRow[] {
	const cmp = (a: SceneRow, b: SceneRow): number => {
		switch (key) {
			case 'name':
				return a.name.localeCompare(b.name);
			case 'room':
				return (
					(a.room ? 0 : 1) - (b.room ? 0 : 1) ||
					(a.room?.name ?? '').localeCompare(b.room?.name ?? '')
				);
			case 'from':
				return (
					a.from.localeCompare(b.from) ||
					a.detail.localeCompare(b.detail, undefined, { numeric: true })
				);
			case 'now':
				return NOW_ORDER[a.now] - NOW_ORDER[b.now];
			case 'run':
				// The latest first, never last.
				return (b.lastRun ?? -Infinity) - (a.lastRun ?? -Infinity) || 0;
			case 'home':
				return (a.onHome ? 0 : 1) - (b.onHome ? 0 : 1);
		}
	};
	const dir = desc ? -1 : 1;
	return [...rows].sort((a, b) => dir * cmp(a, b) || a.name.localeCompare(b.name));
}

// ---- the house's row, from here ----

/** The house's row with refs added (to the end, in order) or taken away. */
export function withRefs(list: string[], refs: string[], on: boolean): string[] {
	return on
		? [...list, ...refs.filter((r) => !list.includes(r))]
		: list.filter((r) => !refs.includes(r));
}

// ---- the picker ----

export interface Pick {
	ref: string;
	name: string;
	/** "Hue · Office", "Lutron · Phantom button 77", "homeCore · 2 devices". */
	label: string;
}

/** Every scene to choose from, each Hue room's copy on its own, by name. */
export function pickable(devices: Devices, scenes: CoreScene[], rooms: Room[]): Pick[] {
	const none = new Set<string>();
	const rows = [
		...scenes.map((s) => coreSceneRow(s, none)),
		...Object.values(devices)
			.filter((d) => kindOf(d) === 'scene')
			.map((d) => deviceSceneRow(d, rooms, none))
	];
	return rows
		.map((r) => ({
			ref: r.key,
			name: r.name,
			label: [r.from, r.room?.name ?? r.detail].filter(Boolean).join(' · ')
		}))
		.sort((a, b) => a.name.localeCompare(b.name) || a.label.localeCompare(b.label));
}

/** Picks matching every word of a search. */
export function findPicks(picks: Pick[], query: string): Pick[] {
	const q = query.trim().toLowerCase();
	if (q === '') return picks;
	return picks.filter((p) =>
		q.split(/\s+/).every((w) => `${p.name} ${p.label}`.toLowerCase().includes(w))
	);
}
