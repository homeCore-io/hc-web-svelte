/**
 * The console's cameras (the CamerasWall and GarageCameras boards): what a
 * camera device offers, how the Cameras page and a room's Cameras tab lay
 * them out for how many there are, the day's events built from homeCore's
 * history, and the header's pills for what a camera saw lately.
 *
 * A camera (Reolink's, C6) is a `camera` device: what it sees now
 * (`person_detected`, `vehicle_detected`, `animal_detected`,
 * `package_detected`), its newest still (`snapshot`, a file the plugin keeps,
 * taken as a detection starts), and its go2rtc streams (`stream`,
 * `stream_hd`). Its spotlight (`<camera>_spotlight`) and siren
 * (`<camera>_siren`) are devices of their own.
 *
 * Pure: the pages draw what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import type { Room } from '../house.js';
import { slugOf } from '../summary.js';
import { roomSlugOf } from './room.js';

// ---- a camera ----

export type EventKind = 'person' | 'vehicle' | 'animal' | 'package';

/** What a camera tells apart, in the order it's offered. */
export const KINDS: readonly { id: EventKind; name: string; attr: string }[] = [
	{ id: 'person', name: 'Person', attr: 'person_detected' },
	{ id: 'vehicle', name: 'Vehicle', attr: 'vehicle_detected' },
	{ id: 'animal', name: 'Animal', attr: 'animal_detected' },
	{ id: 'package', name: 'Package', attr: 'package_detected' }
];

export const kindName = (k: EventKind): string => KINDS.find((x) => x.id === k)?.name ?? k;

export interface Preset {
	value: number;
	label: string;
}

export interface Cam {
	id: string;
	name: string;
	device: CoreDevice;
	model?: string;
	/** go2rtc's names for its live video: the sub stream, and the main one for HD. */
	stream?: string;
	hd?: string;
	/** Its newest still, in the plugin's files, and when it was taken. */
	snapshot?: string;
	snapshotAt?: string;
	/** What it tells apart, as it publishes them. */
	kinds: EventKind[];
	ptz: boolean;
	presets: Preset[];
	spotlight?: CoreDevice;
	siren?: CoreDevice;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const nameOf = (d: CoreDevice) => d.name_override ?? d.name;

/** Whether a device is a camera (a doorbell is one too). */
export const isCamera = (d: CoreDevice): boolean => {
	const k = kindOf(d);
	return k === 'camera' || k === 'doorbell';
};

/** A camera's spotlight or siren: a device of its own, named for it. */
export function partOf(
	cam: string,
	part: 'spotlight' | 'siren',
	all: Devices
): CoreDevice | undefined {
	return all[`${cam}_${part}`];
}

/** A camera device as the pages need it, with its spotlight and siren. */
export function camOf(d: CoreDevice, all: Devices): Cam {
	const a = d.attributes ?? {};
	const actions = d.schema?.actions ?? [];
	const go = actions.find((x) => x.id === 'goto_preset');
	const param = (go?.params ?? []).find((p) => p.name === 'preset') as
		{ options?: unknown[] } | undefined;
	const presets = (param?.options ?? [])
		.map((o) => {
			const r = (typeof o === 'object' && o !== null ? o : { value: o }) as {
				value?: unknown;
				label?: unknown;
			};
			const value = Number(r.value);
			return Number.isFinite(value)
				? { value, label: str(r.label) ?? String(r.value ?? value) }
				: undefined;
		})
		.filter((p): p is Preset => p !== undefined);
	return {
		id: d.device_id,
		name: nameOf(d),
		device: d,
		model: str(a.model),
		stream: str(a.stream),
		hd: str(a.stream_hd),
		snapshot: str(a.snapshot),
		snapshotAt: str(a.snapshot_at),
		kinds: KINDS.filter((k) => typeof a[k.attr] === 'boolean').map((k) => k.id),
		ptz: actions.some((x) => x.id === 'ptz_move'),
		presets,
		spotlight: partOf(d.device_id, 'spotlight', all),
		siren: partOf(d.device_id, 'siren', all)
	};
}

/** Every camera among these devices, by name. */
export function camerasOf(list: CoreDevice[], all: Devices): Cam[] {
	return list
		.filter(isCamera)
		.sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true }))
		.map((d) => camOf(d, all));
}

/** What a camera sees right now, the first of its kinds that's on. */
export function seesNow(cam: Cam): EventKind | undefined {
	const a = cam.device.attributes ?? {};
	return cam.kinds.find((k) => a[KINDS.find((x) => x.id === k)!.attr] === true);
}

/** A file the plugin keeps, at the app's address for it. */
export function fileUrl(plugin: string | undefined, path: string): string {
	return `/api/v1/plugins/${encodeURIComponent(plugin ?? '')}/files/${path
		.replace(/^\/+/, '')
		.split('/')
		.map(encodeURIComponent)
		.join('/')}`;
}

/** A still of a stream now, from go2rtc through the app's `/video`. */
export const frameUrl = (stream: string): string =>
	`/video/api/frame.jpeg?src=${encodeURIComponent(stream)}`;

// ---- the Cameras page ----

/**
 * The rail of snapshots beside the big view: one column up to four cameras,
 * two across from five to eight, and from nine a row of area chips to pick
 * which show.
 */
export function railOf(n: number): { cols: 1 | 2; chips: boolean } {
	return { cols: n > 4 ? 2 : 1, chips: n >= 9 };
}

/** Grid view: every camera as an equal tile, in a square-ish grid. */
export function gridOf(n: number): { cols: number; rows: number } {
	const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
	return { cols, rows: Math.max(1, Math.ceil(n / cols)) };
}

/**
 * How wide the rail is for the height it has: its snapshots 16:9, as large
 * as fit down it (`rows` of them, `gap` apart, after `above` for the chips and
 * the note), and no wider than `most`.
 */
export function railWidth(
	height: number,
	shown: number,
	cols: 1 | 2,
	{ gap = 8, above = 0, most = 250, least = 150 } = {}
): number {
	const rows = Math.max(1, Math.ceil(shown / cols));
	const tall = (height - above - gap * (rows - 1)) / rows;
	const wide = cols * ((tall * 16) / 9) + gap * (cols - 1);
	return Math.round(Math.max(least, Math.min(most, wide)));
}

/**
 * The Cameras page across: the large view as wide as its height allows
 * (16:9, `viewH` tall at most), the rail as wide as its snapshots fit down
 * `railH`, and neither past `width` together. What's left over is margin.
 */
export function wallSplit(
	width: number,
	viewH: number,
	railH: number,
	shown: number,
	cols: 1 | 2,
	{ gap = 16, railGap = 8, above = 0, least = 150 } = {}
): { viewer: number; rail: number } {
	const most = cols === 2 ? 480 : 320;
	const byHeight = railWidth(railH, shown, cols, { gap: railGap, above, most, least });
	const viewer = Math.max(0, Math.min(width - least - gap, (viewH * 16) / 9));
	const rail = Math.max(least, Math.min(byHeight, width - viewer - gap));
	return { viewer: Math.floor(viewer), rail: Math.floor(rail) };
}

/** The area chips: All, then each room with cameras, by name; cameras in no room, "Elsewhere". */
export function areasOf(
	cams: Cam[],
	rooms: Room[]
): { id: string; name: string; n: number; cams: string[] }[] {
	const by = new Map<string, { id: string; name: string; n: number; cams: string[] }>();
	for (const c of cams) {
		const r = roomOf(c.device, rooms);
		const id = r?.id ?? '';
		const name = r?.name ?? 'Elsewhere';
		const a = by.get(id) ?? { id, name, n: 0, cams: [] };
		a.n += 1;
		a.cams.push(c.id);
		by.set(id, a);
	}
	const list = [...by.values()].sort(
		(a, b) => Number(a.id === '') - Number(b.id === '') || a.name.localeCompare(b.name)
	);
	return [{ id: 'all', name: 'All', n: cams.length, cams: cams.map((c) => c.id) }, ...list];
}

/** The room a device is in, among the house's. */
export function roomOf(d: CoreDevice, rooms: Room[]): Room | undefined {
	const slug = roomSlugOf(d);
	if (slug === undefined) return undefined;
	const s = slugOf(slug);
	return rooms.find((r) => r.slug === s || r.aliases.includes(s));
}

// ---- a room's Cameras tab ----

/** One camera fills the tab; from two, the one picked is large and the rest a roll below. */
export const roomLayoutOf = (n: number): 'none' | 'one' | 'roll' =>
	n <= 0 ? 'none' : n === 1 ? 'one' : 'roll';

/** The camera shown large: the one picked, while it's still here, else the first. */
export function pickedOf(cams: Cam[], picked: string | undefined): Cam | undefined {
	return cams.find((c) => c.id === picked) ?? cams[0];
}

// ---- the day's events ----

/** A value as homeCore's history keeps it. */
export interface HistoryRow {
	at: string;
	value: unknown;
}

/** One camera's history for the day: each kind's values, and its stills. */
export interface CamHistory {
	kinds: Partial<Record<EventKind, HistoryRow[]>>;
	snapshots: HistoryRow[];
}

export interface CamEvent {
	/** Stable across reloads: the camera, the kind and when it started. */
	key: string;
	cam: string;
	kind: EventKind;
	/** When it started and, once it has, ended (ms). */
	at: number;
	end?: number;
	/** The still taken as it started, in the plugin's files. */
	snapshot?: string;
}

/** Sightings of the same kind closer together than this are one event. */
export const MERGE_MS = 60_000;
/** A still taken up to this long after an event started is its own. */
const SNAP_AFTER_MS = 20_000;
/** Or this long before (clocks and publishing order). */
const SNAP_BEFORE_MS = 3_000;

const ms = (iso: string) => Date.parse(iso);

/**
 * A camera's events from its history: each time a kind turned on, with
 * sightings of the same kind less than `merge` apart joined into one, and the
 * still the plugin took as it started.
 */
export function eventsOf(cam: string, h: CamHistory, merge = MERGE_MS): CamEvent[] {
	const snaps = h.snapshots
		.filter((r) => typeof r.value === 'string' && Number.isFinite(ms(r.at)))
		.map((r) => ({ at: ms(r.at), path: r.value as string }))
		.sort((a, b) => a.at - b.at);
	const out: CamEvent[] = [];
	for (const k of KINDS) {
		const rows = (h.kinds[k.id] ?? [])
			.filter((r) => Number.isFinite(ms(r.at)))
			.sort((a, b) => ms(a.at) - ms(b.at));
		let open: CamEvent | undefined;
		let last: CamEvent | undefined;
		for (const r of rows) {
			const t = ms(r.at);
			if (r.value === true) {
				if (open) continue;
				if (last && last.end !== undefined && t - last.end < merge) {
					open = last;
					open.end = undefined;
					continue;
				}
				open = { key: `${cam}:${k.id}:${t}`, cam, kind: k.id, at: t };
				out.push(open);
				last = open;
			} else if (r.value === false && open) {
				open.end = t;
				open = undefined;
			}
		}
	}
	const near = (e: CamEvent, t: number) => t >= e.at - SNAP_BEFORE_MS && t <= e.at + SNAP_AFTER_MS;
	for (const e of out) {
		const s = snaps.find((x) => near(e, x.at));
		if (s) e.snapshot = s.path;
	}
	return out.sort((a, b) => b.at - a.at);
}

/** Every camera's events, newest first, kept to `kinds` when given. */
export function allEvents(
	byCam: Record<string, CamEvent[]>,
	cams?: string[],
	kinds?: EventKind[]
): CamEvent[] {
	const ids = cams ?? Object.keys(byCam);
	return ids
		.flatMap((id) => byCam[id] ?? [])
		.filter((e) => !kinds || kinds.includes(e.kind))
		.sort((a, b) => b.at - a.at);
}

/** Midnight this morning, here. */
export function startOfDay(now: number): number {
	const d = new Date(now);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** The newest event of each camera within `within`, for its snapshot's badge. */
export function latestOf(
	events: CamEvent[],
	cam: string,
	now: number,
	within = PILL_MS
): CamEvent | undefined {
	return events.find((e) => e.cam === cam && now - e.at <= within);
}

/** "now", "4 min ago", "2 h ago". */
export function agoWord(t: number, now: number): string {
	const m = Math.floor((now - t) / 60_000);
	if (m < 1) return 'now';
	if (m < 60) return `${m} min ago`;
	return `${Math.floor(m / 60)} h ago`;
}

/** "Person 4m" on a snapshot. */
export function badgeOf(e: CamEvent, now: number): string {
	const m = Math.max(0, Math.floor((now - e.at) / 60_000));
	return `${kindName(e.kind)} ${m < 1 ? 'now' : `${m}m`}`;
}

// ---- the header's pills ----

/** A pill shows this long after its event. */
export const PILL_MS = 30 * 60_000;

/** The household's choices for camera pills (`HouseDoc.console.pills`). */
export interface PillPrefs {
	/** What makes a pill; unset, a person, a vehicle or a package. */
	kinds?: EventKind[];
	/** On Home, with the house's other news. */
	home?: boolean;
	/** Rooms (by id) whose header shows none. */
	off?: string[];
}

export const DEFAULT_PILL_KINDS: readonly EventKind[] = ['person', 'vehicle', 'package'];

/** The choices as they stand, from a document anyone could have written. */
export function pillPrefsOf(p: PillPrefs | undefined): {
	kinds: EventKind[];
	home: boolean;
	off: string[];
} {
	const ids = new Set(KINDS.map((k) => k.id));
	const kinds = Array.isArray(p?.kinds)
		? p.kinds.filter((k): k is EventKind => ids.has(k))
		: [...DEFAULT_PILL_KINDS];
	const off = Array.isArray(p?.off) ? p.off.filter((x): x is string => typeof x === 'string') : [];
	return { kinds, home: p?.home === true, off };
}

/** The choices with `patch` made; what's back to its default is left out. */
export function withPillPrefs(
	p: PillPrefs | undefined,
	patch: Partial<{ kinds: EventKind[]; home: boolean; off: string[] }>
): PillPrefs | undefined {
	const all = { ...pillPrefsOf(p), ...patch };
	const next: PillPrefs = {};
	const order = KINDS.map((k) => k.id).filter((k) => all.kinds.includes(k));
	if (order.join() !== DEFAULT_PILL_KINDS.join()) next.kinds = order;
	if (all.home) next.home = true;
	const off = [...new Set(all.off)].sort();
	if (off.length > 0) next.off = off;
	return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * The pills for these events: those of the chosen kinds in the last
 * `within`, the newest of each kind at each camera, newest first, at most `most`.
 */
export function pillsOf(
	events: CamEvent[],
	now: number,
	kinds: readonly EventKind[],
	{ within = PILL_MS, most = 3 } = {}
): CamEvent[] {
	const seen = new Set<string>();
	const out: CamEvent[] = [];
	for (const e of [...events].sort((a, b) => b.at - a.at)) {
		if (!kinds.includes(e.kind) || now - e.at > within || e.at > now + 60_000) continue;
		const k = `${e.cam}:${e.kind}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(e);
		if (out.length >= most) break;
	}
	return out;
}

/** A pill's words: "Person · 4 min ago", with the camera's name where there are several. */
export function pillWord(e: CamEvent, now: number, camName?: string): string {
	return [kindName(e.kind), camName, agoWord(e.at, now)].filter(Boolean).join(' · ');
}

/** The household's console choices with the pills' changed by `patch`; nothing left is none. */
export function withHousePills<C extends { pills?: PillPrefs }>(
	c: C | undefined,
	patch: Partial<{ kinds: EventKind[]; home: boolean; off: string[] }>
): C | undefined {
	const { pills, ...rest } = (c ?? {}) as C;
	const next = withPillPrefs(pills, patch);
	const out = (next ? { ...rest, pills: next } : rest) as C;
	return Object.keys(out).length > 0 ? out : undefined;
}

// ---- paging an events list ----

export interface EventPage {
	/** The first shown, and one past the last. */
	first: number;
	last: number;
	/** Where ‹ and › go; undefined at either end. */
	prev?: number;
	next?: number;
	/** "1 to 7 of 110", or empty when everything fits. */
	word: string;
}

/**
 * The page of `total` events that `fits` cards show, from `first`: pages
 * start at whole multiples of `fits`, so the same events stay together as
 * the list grows, and a page past the end comes back to the last.
 */
export function pageOf(total: number, fits: number, first: number): EventPage {
	const n = Math.max(1, Math.floor(fits));
	const lastPage = Math.max(0, Math.ceil(total / n) - 1);
	const at = Math.min(Math.max(0, Math.floor(first / n)), lastPage) * n;
	const last = Math.min(total, at + n);
	return {
		first: at,
		last,
		prev: at > 0 ? at - n : undefined,
		next: last < total ? last : undefined,
		word: total > n ? `${at + 1} to ${last} of ${total}` : ''
	};
}

/** How many cards `width` wide, `gap` apart, fit across `room`; at least one. */
export function cardsAcross(room: number, width: number, gap: number): number {
	return Math.max(1, Math.floor((room + gap) / (width + gap)));
}
