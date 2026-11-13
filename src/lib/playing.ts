/**
 * What a player is doing, as every place says it: Home's line and its dock,
 * a room's tile, header and box, Classic's chips, the sidebar and Everywhere ›
 * Media. One rule, so a count never disagrees with the rows under it.
 *
 * A player is playing when it says so (`state: playing`), is on and answers.
 * A speaker in a group that follows another (its `group_coordinator`) plays
 * as part of that group: it is "Grouped", counted once by its leader. A
 * Sonos playing its line-in or a TV gives its own id ("RINCON_542A…", an
 * "x-rincon-stream:" address) as the title: it is playing "TV or line-in",
 * never "Nothing queued".
 *
 * Pure.
 */
import { idLike, kindOf, lineInTitle, streamAddress } from './card.js';
import type { CoreDevice, Devices } from './devices.js';

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

/** Whether a player says it's playing, with a command on its way. */
export const isPlaying = (d: CoreDevice, want?: Record<string, unknown>): boolean =>
	({ ...d.attributes, ...want }).state === 'playing' ||
	{ ...d.attributes, ...want }.player_state === 'play';

/** The leader a speaker follows in a group, when it follows one in the house. */
export function leaderOf(d: CoreDevice, all: Devices | readonly CoreDevice[]): string | undefined {
	const lead = d.attributes?.group_coordinator;
	if (typeof lead !== 'string' || lead === d.device_id) return undefined;
	const found = Array.isArray(all)
		? (all as readonly CoreDevice[]).some((x) => x.device_id === lead)
		: lead in (all as Devices);
	return found ? lead : undefined;
}

/** A speaker's title, as it reports one: the track, else what it plays from. */
const titleOf = (d: CoreDevice): string | undefined =>
	str(d.attributes?.media_title) ?? str(d.attributes?.title) ?? str(d.attributes?.track);

export type PlayState = 'playing' | 'paused' | 'open' | 'idle' | 'grouped' | 'off' | 'offline';

export interface PlayNow {
	state: PlayState;
	/** What it has on, in words: a track, an app, "TV or line-in"; missing when nothing is. */
	what?: string;
	screen: boolean;
	/** The speaker it follows, when it is grouped. */
	lead?: string;
}

/**
 * What a player is doing now, with a command on its way (`want`). `all` is
 * the house, for a group's leader.
 */
export function playNow(
	d: CoreDevice,
	all: Devices | readonly CoreDevice[],
	want?: Record<string, unknown>
): PlayNow {
	const screen = playerKind(d) === 'screen';
	if (!d.available) return { state: 'offline', screen };
	const live = { ...d, attributes: { ...d.attributes, ...want } };
	if (!isOn(live)) return { state: 'off', screen };
	const playing = isPlaying(d, want);
	if (screen) {
		const app = currentApp(d);
		return { state: playing ? 'playing' : app ? 'open' : 'idle', what: app, screen };
	}
	const lead = leaderOf(d, all);
	if (lead) return { state: 'grouped', screen, lead };
	// As its card says it: the track, else the app or input it plays from.
	const raw = titleOf(d);
	const title = raw && !streamAddress(raw) && !lineInTitle(raw) ? raw : undefined;
	const a = d.attributes ?? {};
	const source = str(a.app_name) ?? (a.source !== 'Home' ? str(a.source) : undefined);
	const app = source && !idLike(source) ? source : undefined;
	const what = title ?? app;
	if (playing)
		return {
			state: 'playing',
			what: what ?? (raw && lineInTitle(raw) ? 'TV or line-in' : 'Untitled'),
			screen
		};
	if (live.attributes.state === 'paused' && what) return { state: 'paused', what, screen };
	return { state: 'idle', screen };
}

/** Whether a player is playing now, as every count counts it. */
export const playingNow = (
	d: CoreDevice,
	all: Devices | readonly CoreDevice[],
	want?: Record<string, unknown>
): boolean => isPlayer(d) && playNow(d, all, want).state === 'playing';

/** The ids of every player playing now in `all`, the house. */
export function playingIds(
	all: Devices,
	wants: Record<string, { want?: Record<string, unknown> } | undefined> = {}
): Set<string> {
	return new Set(
		Object.values(all)
			.filter((d) => playingNow(d, all, wants[d.device_id]?.want))
			.map((d) => d.device_id)
	);
}
