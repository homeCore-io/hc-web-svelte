/**
 * A room's media in the console's look (the FamilyRoom and Office boards):
 * its Media tab, and the room's audio along the bottom of the page.
 *
 * The Media tab lists the room's screens first (Rokus and TVs), each with
 * what it's showing, its power, a remote and its apps; then its speakers
 * (Sonos), each with what's playing, play and skip, and a volume; from four
 * speakers, as a mixer (`mixerFit`).
 *
 * Each room plays through one audio device, as a whole-house remote would
 * have it: usually the TV or sound bar, or a speaker. The household chooses it
 * (`HouseDoc.roomAudio`, by room id); a person who may not change the house
 * can choose their own (`PersonDoc.roomAudio`), which wins for them. Unset,
 * it is the room's first screen, else its first speaker. "None" is kept as
 * an empty string, so a room can have no audio though it has a player.
 *
 * What a press sends is described here as a command (`Cmd`), from what the
 * device's schema declares; the page sends it through `commands`.
 *
 * Pure: the page draws what this decides.
 */
import { kindOf } from '../card.js';
import { actionBody, actionView, withoutAction } from '../details.js';
import type { CoreDevice, Devices } from '../devices.js';
import { brandOf, shortName } from './room.js';
import type { FaderStyle } from './style.js';

// ---- which players ----

const MEDIA_KINDS = new Set(['media_player', 'tv', 'speaker', 'receiver']);

/** Whether a device plays something: a TV, a Roku, a speaker. */
export const isPlayer = (d: CoreDevice): boolean => MEDIA_KINDS.has(kindOf(d));

/** A screen (a Roku, a TV) or a speaker (a Sonos). */
export type PlayerKind = 'screen' | 'speaker';

export function playerKind(d: CoreDevice): PlayerKind {
	const k = kindOf(d);
	const plugin = d.plugin_id ?? '';
	if (k === 'speaker' || plugin.includes('sonos')) return 'speaker';
	if (k === 'tv' || plugin.includes('roku')) return 'screen';
	const a = d.attributes ?? {};
	// A player that names the app it's in, or says it's a TV, has a screen.
	if (a.is_tv === true || Array.isArray(a.available_apps) || typeof a.app_name === 'string')
		return 'screen';
	return 'speaker';
}

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
const byName = (a: CoreDevice, b: CoreDevice) =>
	nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true });

/** A room's players, screens first, each by name. */
export function orderPlayers(list: CoreDevice[]): {
	screens: CoreDevice[];
	speakers: CoreDevice[];
} {
	const players = list.filter(isPlayer).sort(byName);
	return {
		screens: players.filter((d) => playerKind(d) === 'screen'),
		speakers: players.filter((d) => playerKind(d) === 'speaker')
	};
}

/**
 * A player's name as the console shows it: without the serial number a Roku
 * puts after its model ("Roku Smart Soundbar - YL0001073725"), and without
 * the room's name in front, unless all that leaves is a number ("Office-1").
 */
export function playerName(d: CoreDevice, room = ''): string {
	const full = nameOf(d).replace(/\s+-\s+[A-Z0-9]{8,}$/, '');
	const short = shortName(full, room);
	return /^\d+$/.test(short) ? full : short;
}

// ---- the room's audio ----

/** The choices kept for each room, by room id: a device id, or `''` for none. */
export type RoomAudioChoices = Record<string, string>;

/** The room's audio when nobody chose: its first screen, else its first speaker. */
export function defaultAudio(inRoom: CoreDevice[]): CoreDevice | undefined {
	const { screens, speakers } = orderPlayers(inRoom);
	return screens[0] ?? speakers[0];
}

export interface RoomAudio {
	/** The device the room plays through, if any. */
	device?: CoreDevice;
	/** Someone chose it (or chose none); else it's the room's default. */
	chosen: boolean;
	/** Whose choice it is. */
	by?: 'house' | 'me';
}

/**
 * The device a room plays through: the person's own choice, else the
 * household's, else the room's default. A choice of a device the house no
 * longer has falls back to the default; a choice of none is kept.
 */
export function roomAudioOf(
	roomId: string,
	inRoom: CoreDevice[],
	all: Devices | CoreDevice[],
	house?: RoomAudioChoices,
	mine?: RoomAudioChoices
): RoomAudio {
	const byId = Array.isArray(all) ? new Map(all.map((d) => [d.device_id, d])) : undefined;
	const find = (id: string) => (byId ? byId.get(id) : (all as Devices)[id]);
	for (const [by, choices] of [
		['me', mine],
		['house', house]
	] as const) {
		const id = choices?.[roomId];
		if (typeof id !== 'string') continue;
		if (id === '') return { chosen: true, by };
		const d = find(id);
		if (d && isPlayer(d)) return { device: d, chosen: true, by };
	}
	return { device: defaultAudio(inRoom), chosen: false };
}

/** A choice in the "Plays through" picker. */
export interface AudioChoice {
	id: string;
	/** "Office-1 · Sonos". */
	label: string;
	/** In this room, rather than elsewhere in the house. */
	here: boolean;
}

/** What a room can play through: its own players first, then the rest of the house's. */
export function audioChoices(inRoom: CoreDevice[], all: Devices | CoreDevice[]): AudioChoice[] {
	const list = Array.isArray(all) ? all : Object.values(all);
	const here = new Set(inRoom.map((d) => d.device_id));
	const mine = orderPlayers(inRoom);
	const rest = orderPlayers(list.filter((d) => !here.has(d.device_id)));
	const label = (d: CoreDevice) => `${playerName(d)} · ${brandOf(d.plugin_id)}`;
	return [
		...[...mine.screens, ...mine.speakers].map((d) => ({
			id: d.device_id,
			label: label(d),
			here: true
		})),
		...[...rest.screens, ...rest.speakers].map((d) => ({
			id: d.device_id,
			label: label(d),
			here: false
		}))
	];
}

/**
 * A document with a room's audio choice changed: a device id, `''` for none,
 * or `undefined` to go back to the room's default.
 */
export function withRoomAudio<D extends { roomAudio?: RoomAudioChoices }>(
	doc: D,
	roomId: string,
	choice: string | undefined
): D {
	const { roomAudio: was, ...rest } = doc;
	const next: RoomAudioChoices = { ...was };
	if (choice === undefined) delete next[roomId];
	else next[roomId] = choice;
	return (Object.keys(next).length > 0 ? { ...rest, roomAudio: next } : rest) as D;
}

// ---- what a player is doing ----

const str = (v: unknown): string | undefined =>
	typeof v === 'string' && v.trim() !== '' ? v : undefined;

/** Whether a player is on: a Roku in standby is off. */
export function isOn(d: CoreDevice): boolean {
	const a = d.attributes ?? {};
	if (a.on === false) return false;
	if (typeof a.power_mode === 'string' && a.power_mode !== 'PowerOn') return false;
	return true;
}

/** The app a screen is in, by name; the home screen and ids aren't apps. */
export function currentApp(d: CoreDevice): string | undefined {
	const a = d.attributes ?? {};
	const name = str(a.app_name) ?? str(a.source);
	if (!name || name === 'Home' || /^[A-Z0-9_:.-]{12,}$/.test(name)) return undefined;
	return name;
}

/** Whether a player says it's playing. */
export const isPlaying = (d: CoreDevice, want?: Record<string, unknown>): boolean =>
	({ ...d.attributes, ...want }).state === 'playing' ||
	{ ...d.attributes, ...want }.player_state === 'play';

/** A speaker's artist, as it reports one. */
export const artistOf = (d: CoreDevice): string | undefined =>
	str(d.attributes?.media_artist) ?? str(d.attributes?.artist);

/**
 * Who a speaker plays with: the names of the others in its group, its
 * leader first. Empty when it plays on its own.
 */
export function groupOf(d: CoreDevice, all: Devices | CoreDevice[]): string[] {
	const list = Array.isArray(all) ? all : Object.values(all);
	const members = d.attributes?.group_members;
	if (!Array.isArray(members) || members.length < 2) return [];
	const lead = d.attributes?.group_coordinator;
	return members
		.filter((m): m is string => typeof m === 'string' && m !== d.device_id)
		.sort((x, y) => Number(y === lead) - Number(x === lead))
		.map((id) => {
			const m = list.find((x) => x.device_id === id);
			return m ? nameOf(m) : id;
		});
}

// ---- commands ----

/** What a press sends: attributes to set, or an action (waiting for `want`, when it reports one). */
export type Cmd =
	| { set: Record<string, unknown> }
	| { act: string; params: Record<string, unknown>; want?: Record<string, unknown> };

const has = (d: CoreDevice, action: string) =>
	(d.schema?.actions ?? []).some((a) => a.id === action);
const writable = (d: CoreDevice, attr: string) => d.schema?.attributes?.[attr]?.writable === true;

/** The keys a device's `key` action takes: Up, Select, Rev. */
function keyNames(d: CoreDevice): Set<string> {
	const key = d.schema?.actions?.find((a) => a.id === 'key');
	const p = key?.params?.find((x) => x.name === 'key');
	return new Set((p?.options ?? []).map((o) => o.value));
}

/** An action the device declares, with the params its fields hold (as the details sheet sends it). */
function actionCmd(
	d: CoreDevice,
	id: string,
	values: Record<string, unknown> = {}
): Cmd | undefined {
	const view = actionView(d, id);
	if (!view) return undefined;
	return { act: id, params: withoutAction(actionBody(view, values)) };
}

// ---- the remote ----

export type KeyId =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'ok'
	| 'back'
	| 'home'
	| 'info'
	| 'replay'
	| 'rev'
	| 'play'
	| 'fwd'
	| 'voldown'
	| 'mute'
	| 'volup';

export interface RemoteKey {
	id: KeyId;
	label: string;
	cmd: Cmd;
}

/** Each key: its own action, else the Roku key it presses. */
const KEYS: readonly { id: KeyId; label: string; action?: string; key?: string }[] = [
	{ id: 'up', label: 'Up', action: 'up', key: 'Up' },
	{ id: 'down', label: 'Down', action: 'down', key: 'Down' },
	{ id: 'left', label: 'Left', action: 'left', key: 'Left' },
	{ id: 'right', label: 'Right', action: 'right', key: 'Right' },
	{ id: 'ok', label: 'OK', action: 'select', key: 'Select' },
	{ id: 'back', label: 'Back', action: 'back', key: 'Back' },
	{ id: 'home', label: 'Home', action: 'home', key: 'Home' },
	{ id: 'info', label: 'Options', action: 'info', key: 'Info' },
	{ id: 'replay', label: 'Instant replay', action: 'instant_replay', key: 'InstantReplay' },
	{ id: 'rev', label: 'Rewind', key: 'Rev' },
	{ id: 'play', label: 'Play or pause', action: 'play_pause', key: 'Play' },
	{ id: 'fwd', label: 'Fast forward', key: 'Fwd' },
	{ id: 'voldown', label: 'Volume down', action: 'volume_down', key: 'VolumeDown' },
	{ id: 'mute', label: 'Mute', action: 'mute', key: 'VolumeMute' },
	{ id: 'volup', label: 'Volume up', action: 'volume_up', key: 'VolumeUp' }
];

/** The remote's keys a device has, from the actions its schema declares. */
export function remoteKeys(d: CoreDevice): Partial<Record<KeyId, RemoteKey>> {
	const out: Partial<Record<KeyId, RemoteKey>> = {};
	const keys = keyNames(d);
	for (const k of KEYS) {
		const cmd =
			(k.action && has(d, k.action) ? actionCmd(d, k.action) : undefined) ??
			(k.key && keys.has(k.key) ? actionCmd(d, 'key', { key: k.key }) : undefined);
		if (cmd) out[k.id] = { id: k.id, label: k.label, cmd };
	}
	return out;
}

/** Turning a player on or off: its `on`, else its power actions. */
export function powerCmd(d: CoreDevice, on: boolean): Cmd | undefined {
	if (writable(d, 'on')) return { set: { on } };
	return actionCmd(d, on ? 'power_on' : 'power_off') ?? actionCmd(d, 'power_toggle');
}

// ---- a screen's apps ----

export interface AppTile {
	id: string;
	name: string;
	/** The icon's address, when the plugin keeps one. */
	icon?: string;
	/** The tile's letter, when there's no icon. */
	letter: string;
	/** How often it was opened from homeCore. */
	launches?: number;
	/** A TV's input (HDMI 1), rather than an app. */
	input: boolean;
}

/** A plugin's file, as the app serves it: `/api/v1/plugins/{plugin}/files/{path}`. */
export function pluginFile(plugin: string, path: string): string {
	const parts = path.replace(/^\/+/, '').split('/').map(encodeURIComponent);
	return `/api/v1/plugins/${encodeURIComponent(plugin)}/files/${parts.join('/')}`;
}

function tilesFrom(list: unknown, plugin: string, input: boolean): AppTile[] {
	if (!Array.isArray(list)) return [];
	const out: AppTile[] = [];
	for (const x of list) {
		if (typeof x !== 'object' || x === null) continue;
		const r = x as Record<string, unknown>;
		const id = typeof r.id === 'string' || typeof r.id === 'number' ? String(r.id) : undefined;
		const name = str(r.name);
		if (id === undefined || name === undefined) continue;
		const icon = str(r.icon);
		out.push({
			id,
			name,
			...(icon && plugin ? { icon: pluginFile(plugin, icon) } : {}),
			letter:
				name
					.replace(/[^\p{L}\p{N}]/gu, '')
					.charAt(0)
					.toUpperCase() || '?',
			...(typeof r.launches === 'number' ? { launches: r.launches } : {}),
			input
		});
	}
	return out;
}

/**
 * A screen's tiles: its inputs (a TV's HDMI ports), then its apps, the most
 * opened first where the plugin counts them, else in the device's own order.
 */
export function appTiles(d: CoreDevice): AppTile[] {
	const plugin = d.plugin_id ?? '';
	const inputs = tilesFrom(d.attributes?.available_inputs, plugin, true);
	const apps = tilesFrom(d.attributes?.available_apps, plugin, false);
	// Stable: equal counts keep the device's order.
	const ranked = apps
		.map((a, i) => ({ a, i }))
		.sort((x, y) => (y.a.launches ?? 0) - (x.a.launches ?? 0) || x.i - y.i)
		.map((x) => x.a);
	return [...inputs, ...ranked];
}

/** Opening an app or input on a screen, through its `launch_app` action. */
export function launchCmd(d: CoreDevice, app: AppTile): Cmd | undefined {
	return actionCmd(d, 'launch_app', { app: app.id });
}

/** Whether a tile is what the screen is showing now. */
export const isCurrent = (d: CoreDevice, app: AppTile): boolean =>
	isOn(d) && (String(d.attributes?.app_id ?? '') === app.id || currentApp(d) === app.name);

// ---- play and skip ----

export interface Transport {
	playing: boolean;
	toggle?: Cmd;
	previous?: Cmd;
	next?: Cmd;
}

/** A player's play, pause and skip, as its schema has them. */
export function transportOf(d: CoreDevice, want?: Record<string, unknown>): Transport {
	const playing = isPlaying(d, want);
	const toggle =
		actionCmd(d, 'toggle_play_pause') ??
		actionCmd(d, 'play_pause') ??
		actionCmd(d, playing ? 'pause' : 'play');
	return {
		playing,
		...(toggle ? { toggle } : {}),
		...(has(d, 'previous') ? { previous: actionCmd(d, 'previous') } : {}),
		...(has(d, 'next') ? { next: actionCmd(d, 'next') } : {})
	};
}

// ---- volume ----

export interface Volume {
	/** The level, where the device reports one and it can be set. */
	level?: { value: number; min: number; max: number };
	/** It steps up and down (a Roku, which reports no level). */
	steps: boolean;
	/** Muted, where the device says. */
	muted?: boolean;
	canMute: boolean;
}

const num = (v: unknown): number | undefined =>
	typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/** How a player's volume is set: a level, or steps; and whether it mutes. */
export function volumeOf(d: CoreDevice, want?: Record<string, unknown>): Volume {
	const a = { ...d.attributes, ...want };
	const value = num(a.volume);
	const spec = d.schema?.attributes?.volume;
	const setVol = d.schema?.actions?.find((x) => x.id === 'set_volume');
	const p = setVol?.params?.find((x) => x.name === 'volume');
	const settable = writable(d, 'volume') || p !== undefined;
	const keys = remoteKeys(d);
	const muted = typeof a.muted === 'boolean' ? a.muted : undefined;
	return {
		...(value !== undefined && settable
			? {
					level: {
						value,
						min: spec?.min ?? p?.min ?? 0,
						max: spec?.max ?? p?.max ?? 100
					}
				}
			: {}),
		steps: keys.volup !== undefined && keys.voldown !== undefined,
		...(muted !== undefined ? { muted } : {}),
		canMute: writable(d, 'muted') || has(d, 'set_mute') || keys.mute !== undefined
	};
}

/** Setting a player's volume to `v`. */
export function volumeCmd(d: CoreDevice, v: number): Cmd | undefined {
	const value = Math.round(v);
	if (writable(d, 'volume')) return { set: { volume: value } };
	const cmd = actionCmd(d, 'set_volume', { volume: value });
	return cmd && 'act' in cmd ? { ...cmd, want: { volume: value } } : undefined;
}

/** A step of a player's volume: its own level up or down, else its remote's key. */
export function stepCmd(
	d: CoreDevice,
	by: 1 | -1,
	want?: Record<string, unknown>
): Cmd | undefined {
	const keys = remoteKeys(d);
	const key = by > 0 ? keys.volup : keys.voldown;
	if (key) return key.cmd;
	const v = volumeOf(d, want).level;
	if (!v) return undefined;
	const next = Math.max(v.min, Math.min(v.max, v.value + by * 2));
	return volumeCmd(d, next);
}

/** Muting a player, or unmuting it: `muted` set, else its mute action. */
export function muteCmd(d: CoreDevice, want?: Record<string, unknown>): Cmd | undefined {
	const was = volumeOf(d, want).muted;
	if (writable(d, 'muted')) return { set: { muted: !was } };
	if (has(d, 'set_mute')) {
		const cmd = actionCmd(d, 'set_mute', { muted: !was });
		return cmd && 'act' in cmd ? { ...cmd, want: { muted: !was } } : undefined;
	}
	// A Roku's mute key flips it, and nothing says which way.
	return remoteKeys(d).mute?.cmd;
}

// ---- a room of many speakers ----

/**
 * From this many speakers, the Media tab draws them as a mixer: a channel for
 * each, side by side as the Lights tab's faders are, and the chosen one's
 * artwork beside them. Fewer sit side by side as cards.
 */
export const MIXER_FROM = 4;

export const asMixer = (speakers: number): boolean => speakers >= MIXER_FROM;

/**
 * The speaker the mixer shows: the one chosen, while the room still has it;
 * else the first one playing; else the first.
 */
export function mixerPick(
	speakers: CoreDevice[],
	chosen?: string,
	want: (d: CoreDevice) => Record<string, unknown> | undefined = () => undefined
): CoreDevice | undefined {
	return (
		speakers.find((d) => d.device_id === chosen) ??
		speakers.find((d) => d.available && isPlaying(d, want(d))) ??
		speakers[0]
	);
}

/** How the mixer is laid out in the space it has. */
export interface MixerFit {
	/** The chosen speaker's stage: its width, and its artwork's side. */
	hero: number;
	art: number;
	/** Rows of channels: one, unless they don't fit across even tight. */
	rows: number;
	/** Channels in each row. */
	perRow: number;
	/** Narrower pills (92 rather than 104). */
	tight: boolean;
	/** Each fader's height, for its `height`. */
	fader: number;
}

/** A channel's place across, with the gap after it: its pill, wide or tight. */
const CHANNEL = { wide: 116, tight: 104, gap: 12 };
/** A channel's height besides its fader: play and level, the pill, and the gaps. */
const CHANNEL_CHROME = 84;
const ROW_GAP = 14;
const FADER = { min: 64, max: 200 };
/** The stage: its padding and the gap by its artwork; the artwork; the words beside it. */
const STAGE = { edge: 48, art: { min: 110, max: 232 }, words: { min: 220, max: 330 } };
/** Between the stage and the channels. */
const SPLIT = 22;

/**
 * The mixer laid out in `width` by `height` pixels. The stage keeps its
 * artwork as large as the height allows, and its full width while the
 * channels fit beside it: wide pills, else tight ones. Then the stage gives
 * up width down to its least, and then the channels take more rows, so it
 * never scrolls across. Faders take the height that's left; a Glass pill
 * stands 22 taller than its height.
 */
export function mixerFit(
	count: number,
	width: number,
	height: number,
	style: FaderStyle = 'machined'
): MixerFit {
	const n = Math.max(1, count);
	const room = width - SPLIT;
	const side = Math.max(STAGE.art.min, Math.min(STAGE.art.max, height - 28));
	const most = side + STAGE.edge + STAGE.words.max;
	const least = Math.min(side, 120) + STAGE.edge + STAGE.words.min;
	const need = (step: number) => n * step - CHANNEL.gap;
	let hero = most;
	let tight = false;
	if (room - most < need(CHANNEL.wide)) {
		tight = true;
		if (room - most < need(CHANNEL.tight))
			hero = Math.max(least, Math.min(most, room - need(CHANNEL.tight)));
	}
	const across = Math.max(1, Math.floor((room - hero + CHANNEL.gap) / CHANNEL.tight));
	const rows = tight ? Math.ceil(n / across) : 1;
	const each = (height - (rows - 1) * ROW_GAP) / rows;
	const fader = Math.floor(each - CHANNEL_CHROME - (style === 'glass' ? 22 : 0));
	return {
		hero,
		art: Math.min(side, hero - STAGE.edge - STAGE.words.min),
		rows,
		perRow: Math.ceil(n / rows),
		tight,
		fader: Math.max(FADER.min, Math.min(FADER.max, fader))
	};
}

/** Hues that make a good backdrop: blues, violets, pinks, teals and a coral. */
const HUES = [212, 262, 292, 328, 188, 16, 158, 236, 342, 200];

/** A speaker's own hue where there's no artwork, the same each time (FNV-1a of its id). */
export function hueOf(id: string): number {
	let h = 0x811c9dc5;
	for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
	return HUES[h % HUES.length]!;
}
