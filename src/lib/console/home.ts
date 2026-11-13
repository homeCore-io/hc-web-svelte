/**
 * Home in the console's look (the HomeConsole board): a greeting with the
 * time and the weather outside; what needs attention, each with its fix;
 * the house's favorites; every room as a tile, its drawing lit by its
 * lights, with its temperature and what's going on; and what's playing in
 * the house, along the bottom.
 *
 * What needs attention is what the house's state says now (a lock left
 * unlocked, a door open, either one offline) and what homeCore raised as an
 * alert (a leak, smoke, a jammed lock, a rule's). The rest of homeCore's
 * alerts (other things offline, low batteries) are counted in one pill that
 * opens Alerts.
 *
 * Pure: the page draws what this decides.
 */
import { isOpen, kindOf, type CardView } from '../card.js';
import type { CoreDevice } from '../devices.js';
import type { CoreScene } from '../scenes.svelte.js';
import type { Alert } from '../alerts.js';
import type { Room } from '../house.js';
import type { Box } from '../roomBox.js';
import {
	artistOf,
	currentApp,
	groupOf,
	isOn,
	isPlayer,
	isPlaying,
	playerKind,
	playerName
} from './media.js';
import { roomOf } from './cameras.js';
import { guards, levelOf, shortName } from './room.js';
import { isLamp, type Wants } from './pictures.js';
import { whereLit, type LightsCount } from '../lights.js';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const join = (xs: (string | undefined | false)[]) => xs.filter(Boolean).join(' · ');

// ---- the greeting ----

/** "Good morning", by the hour. */
export function greetingOf(hour: number): string {
	if (hour < 5) return 'Good night';
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

/** What a thermostat is doing, when it's doing something: "Heating", "Cooling". */
export function working(d: CoreDevice): string | undefined {
	if (!d.available || kindOf(d) !== 'thermostat') return undefined;
	const a = d.attributes.hvac_action;
	return a === 'heating' ? 'Heating' : a === 'cooling' ? 'Cooling' : undefined;
}

/**
 * The house in one line, under the greeting: "8 lights on in 5 rooms · 2
 * playing · 3 thermostats working · all secure".
 */
export function houseLine(h: {
	lights: LightsCount;
	playing: number;
	working: number;
	issues: number;
}): string {
	return join([
		h.lights.on === 0
			? 'Every light off'
			: `${plural(h.lights.on, 'light', 'lights')} on ${whereLit(h.lights)}`,
		h.playing > 0 && `${h.playing} playing`,
		h.working > 0 && `${plural(h.working, 'thermostat', 'thermostats')} working`,
		h.issues === 0
			? 'all secure'
			: `${h.issues} ${h.issues === 1 ? 'thing needs' : 'things need'} attention`
	]);
}

// ---- a room's tile ----

export interface Tile {
	/** What the tile says under the room's name: "3 lights on · Roku playing", else "Quiet". */
	status: string;
	/** Something is wrong in the room: the tile is ringed in red. */
	alarm: boolean;
	/** Its temperature, as its header shows it. */
	temp?: string;
	/** Its lights on: its lights and the switches named as lights, with commands on their way. */
	lightsOn: number;
}

/**
 * A room's tile from its devices, their cards and its box (`roomBox`, with
 * the settings its box on Home has): its lights, what's wrong, a lock left
 * unlocked, what's playing, a thermostat working, a fan on. Its lights are
 * counted as its drawing shows them (`roomPicture`), switches named as lights too.
 */
export function tileOf(
	room: Room,
	devices: CoreDevice[],
	cards: CardView[],
	box: Box,
	lamps: CoreDevice[] = devices.filter(isLamp),
	wants: Wants = () => undefined
): Tile {
	const short = (name: string) => shortName(name.replace(/\s+sensor$/i, ''), room.name);
	const on = lamps.filter((d) => d.available && levelOf(d, wants(d.device_id)) > 0).length;
	const lightsWord =
		lamps.length === 0 ? undefined : on === 0 ? 'Lights off' : plural(on, 'light on', 'lights on');
	// The box names a device in full ("Bathroom Door Sensor open"); the tile is the room's.
	const tidy = (text: string) => {
		const c = cards
			.filter((x) => text.startsWith(`${x.name} `))
			.sort((a, b) => b.name.length - a.name.length)[0];
		return c ? short(c.name) + text.slice(c.name.length) : text;
	};
	const wrong = box.lines.filter((l) => l.alert).map((l) => tidy(l.text));
	const unlocked = cards.filter((c) => c.available && c.icon === 'unlock');
	const playing = devices.filter((d) => d.available && isPlayer(d) && isPlaying(d));
	const work = devices.flatMap((d) => working(d) ?? []);
	const fans = cards.filter((c) => c.available && c.kind === 'fan' && c.tone === 'on');
	const words = [
		lightsWord,
		...wrong,
		...unlocked.map((c) => `${short(c.name)} unlocked`),
		playing.length === 1
			? `${playerName(playing[0]!, room.name)} playing`
			: playing.length > 1 && `${playing.length} playing`,
		work[0],
		fans.length > 0 && (fans.length === 1 ? 'Fan on' : `${fans.length} fans on`)
	].filter((w): w is string => typeof w === 'string' && w !== '');
	return {
		status: words.slice(0, 3).join(' · ') || 'Quiet',
		alarm: wrong.length > 0 || unlocked.length > 0,
		temp: box.bigIs === 'lights' ? undefined : box.big,
		lightsOn: on
	};
}

// ---- what needs attention ----

export type Fix = { lock: string } | { href: string };

export interface Issue {
	key: string;
	text: string;
	/** The fix's word: "Lock it", "Show", "See all". */
	act: string;
	fix: Fix;
}

/** As many problems as Home shows one by one; the rest are counted in one pill. */
export const ISSUES_SHOWN = 4;

/** Alerts that need someone now, each shown on its own. */
const URGENT = new Set(['wet', 'smoke', 'jammed', 'rule']);
const TAB_FOR: Record<string, string> = { wet: 'water', smoke: 'sensors', jammed: 'doors' };

/**
 * What needs attention in the house: each room's locks left unlocked (fixed
 * by locking them), doors open, and locks and doors offline (shown), then
 * homeCore's urgent alerts, then one pill counting the rest of its alerts.
 * An offline lock or door shown here isn't counted again with them.
 */
export function issuesOf(
	rooms: { room: Room; cards: CardView[] }[],
	alerts: Alert[],
	all: CoreDevice[],
	roomList: Room[]
): Issue[] {
	const out: Issue[] = [];
	for (const { room, cards } of rooms) {
		const short = (name: string) => shortName(name.replace(/\s+sensor$/i, ''), room.name);
		for (const c of cards) {
			if (!c.available) {
				if (guards(c.kind))
					out.push({
						key: `offline:${c.id}`,
						text: `${room.name} ${short(c.name)}: Offline`,
						act: 'Show',
						fix: { href: `/rooms/${room.id}?tab=doors` }
					});
				continue;
			}
			if (c.icon === 'unlock')
				out.push({
					key: `unlocked:${c.id}`,
					text: `${room.name}: ${short(c.name)} unlocked`,
					act: c.control?.kind === 'lock' ? 'Lock it' : 'Show',
					fix: c.control?.kind === 'lock' ? { lock: c.id } : { href: `/rooms/${room.id}?tab=doors` }
				});
			else if (isOpen(c))
				out.push({
					key: `open:${c.id}`,
					text: `${room.name}: ${short(c.name)} open`,
					act: 'Show',
					fix: { href: `/rooms/${room.id}?tab=doors` }
				});
		}
	}
	const shownOffline = new Set(
		out.filter((i) => i.key.startsWith('offline:')).map((i) => i.key.slice('offline:'.length))
	);
	const left = alerts.filter((a) => !(a.kind === 'offline' && shownOffline.has(a.device_id)));
	const urgent = left.filter((a) => URGENT.has(a.kind) || a.severity === 'critical');
	for (const a of urgent) {
		const d = all.find((x) => x.device_id === a.device_id);
		const r = d ? roomOf(d, roomList) : undefined;
		const tab = TAB_FOR[a.kind];
		out.push({
			key: `alert:${a.id}`,
			text: a.message,
			act: 'Show',
			fix: { href: r ? `/rooms/${r.id}${tab ? `?tab=${tab}` : ''}` : '/alerts' }
		});
	}
	const rest = left.length - urgent.length + Math.max(0, out.length - ISSUES_SHOWN);
	const shown = out.slice(0, ISSUES_SHOWN);
	if (rest > 0)
		shown.push({
			key: 'rest',
			text:
				out.length > ISSUES_SHOWN
					? plural(rest, 'more thing', 'more things')
					: plural(rest, 'other alert', 'other alerts'),
			act: 'See all',
			fix: { href: '/alerts' }
		});
	return shown;
}

// ---- favorites ----

export type Favorite = { key: string; device: CoreDevice } | { key: string; scene: CoreScene };

/**
 * The favorites on Home: the person's own devices and scenes, in their
 * order. The house's other scenes wait for Customize.
 */
export function favoritesOf(
	refs: string[],
	byId: Record<string, CoreDevice>,
	scenes: CoreScene[]
): Favorite[] {
	const out: Favorite[] = [];
	for (const r of refs) {
		const [kind, id] = [r.slice(0, r.indexOf(':')), r.slice(r.indexOf(':') + 1)];
		const device = kind === 'device' ? byId[id] : undefined;
		const scene = kind === 'scene' ? scenes.find((s) => s.id === id) : undefined;
		if (device) out.push({ key: r, device });
		else if (scene) out.push({ key: r, scene });
	}
	return out;
}

// ---- what's playing ----

export interface Playing {
	id: string;
	/** What's on: the track, else the app. */
	title: string;
	/** Where: "Office-1 + Office-2 · Office · paused". */
	sub: string;
	screen: boolean;
	playing: boolean;
	/** The room's Media tab, where it can be changed. */
	href?: string;
}

/**
 * What's playing in the house, playing first: each screen in an app, each
 * speaker with something on, a group of speakers once (by its leader).
 * `now` gives a player's card's words: its title and artwork.
 */
export function playingOf(
	all: CoreDevice[],
	rooms: Room[],
	nowOf: (d: CoreDevice) => string | undefined
): Playing[] {
	const out: Playing[] = [];
	for (const d of all) {
		if (!d.available || !isPlayer(d) || !isOn(d)) continue;
		const lead = d.attributes.group_coordinator;
		if (typeof lead === 'string' && lead !== d.device_id && all.some((x) => x.device_id === lead))
			continue;
		const screen = playerKind(d) === 'screen';
		const playing = isPlaying(d);
		const title = screen ? currentApp(d) : nowOf(d);
		if (!title) continue;
		const r = roomOf(d, rooms);
		const names = [playerName(d, r?.name), ...groupOf(d, all)].join(' + ');
		out.push({
			id: d.device_id,
			title,
			sub: join([
				screen ? undefined : artistOf(d),
				r && r.name !== names ? r.name : undefined,
				names,
				playing ? 'playing' : screen ? 'on' : 'paused'
			]),
			screen,
			playing,
			href: r ? `/rooms/${r.id}?tab=media` : undefined
		});
	}
	return out.sort((a, b) => Number(b.playing) - Number(a.playing));
}
