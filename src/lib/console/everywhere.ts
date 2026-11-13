/**
 * The house's Everywhere views in the console (the Everywhere board): Lights,
 * Media, Climate, Security and Water, each across every room at once.
 *
 * Each room's devices are sorted as its own page sorts them (room.ts), so a
 * device is in the same view here as in its room's tabs, and looks and
 * behaves the same. Rooms come in Home's order; devices in no room come last,
 * under "No room".
 *
 * Lights: a row per room, a bulb for each light, with On and Off for the
 * room. Media: every player, screens before speakers in each room. Climate:
 * every thermostat and fan, and every temperature and humidity reading in
 * the house (motion sensors and weather stations too). Security: what needs
 * attention (unlocked, open, offline) first, then each room's locks and doors. Water:
 * the valves, and the leak sensors by room; leaks are only here.
 *
 * Pure: the pages draw what this decides.
 */
import { cardFor, isOpen, kindOf } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import type { Room } from '../house.js';
import { thermostatOf } from '../thermostat.js';
import { units, type Units } from '../units.js';
import { climateTab } from './climate.js';
import { isPlaying, orderPlayers } from './media.js';
import { brandOf, consoleRoom, type ConsoleRoom, type TabChoices } from './room.js';
import { roomLights } from './pictures.js';
import { isLit, lightsCount as countLights, whereLit, type LightsCount } from '../lights.js';
import { readingOf, type Reading } from './sensors.js';
import { valveOpen, waterTab, wet } from './water.js';

export type ViewId = 'lights' | 'media' | 'climate' | 'security' | 'water';

export const VIEWS: readonly { id: ViewId; name: string }[] = [
	{ id: 'lights', name: 'Lights' },
	{ id: 'media', name: 'Media' },
	{ id: 'climate', name: 'Climate' },
	{ id: 'security', name: 'Security' },
	{ id: 'water', name: 'Water' }
];

export const viewOf = (id: string | undefined): ViewId | undefined =>
	VIEWS.find((v) => v.id === id)?.id;

/** Commands on their way, by device: what each was asked to become. */
export type Wants = Record<string, { want?: Record<string, unknown> } | undefined>;

// ---- the house, room by room ----

/** A room and what's in it, sorted into its tabs; `room` is missing for devices in no room. */
export interface Place {
	key: string;
	name: string;
	room?: Room;
	model: ConsoleRoom;
	/** Its lights, as every place counts them (lights.ts, `roomLights`). */
	lights: CoreDevice[];
}

/**
 * Every room in `order`, then what's in no room. `grouped` is the devices by
 * room id, those in no room under `''` (summary.ts's `byRoom`); `chosen`,
 * the household's choices of tab, so each view has what the rooms' tabs have;
 * `linksOf`, a room's drawing's spots the household fixed (layout.ts).
 */
export function placesOf(
	grouped: Map<string, CoreDevice[]>,
	order: Room[],
	chosen: TabChoices = {},
	linksOf: (roomId: string) => Record<string, string> | undefined = () => undefined
): Place[] {
	const house = [...grouped.values()].flat();
	const place = (key: string, name: string, list: CoreDevice[], room?: Room): Place => {
		const lights = roomLights(room ? name : '', list, house, {
			links: room ? linksOf(room.id) : undefined,
			chosen
		});
		const set = new Set(lights);
		return {
			key,
			name,
			room,
			model: consoleRoom(list, undefined, chosen, undefined, house, (d) => set.has(d)),
			lights
		};
	};
	const places: Place[] = order.map((r) => place(r.id, r.name, grouped.get(r.id) ?? [], r));
	const loose = grouped.get('') ?? [];
	if (loose.length > 0) places.push(place('', 'No room', loose));
	return places;
}

/** The rooms Home shows, in its order, then the ones a person hid, so none is missed. */
export const everyRoom = <T>(shown: T[], all: T[]): T[] => [
	...shown,
	...all.filter((r) => !shown.includes(r))
];

// ---- Lights ----

export interface LightRow {
	place: Place;
	/** The lights the room's Lights tab draws, in its order. */
	lights: CoreDevice[];
}

/**
 * A row for each room with lights, and one for the lights in no room: its
 * Lights tab's faders, then its other lights (switches named as lights, a
 * Garage's "Zone 03"), as Home counts them. Its camera spotlights stay with
 * its cameras.
 */
export function lightRows(places: Place[]): LightRow[] {
	return places
		.map((place) => {
			const faders = place.model.lights.columns
				.flatMap((c) => c.lights)
				.filter((d) => place.lights.includes(d));
			const others = place.lights.filter((d) => !faders.includes(d));
			return { place, lights: [...faders, ...others] };
		})
		.filter((r) => r.lights.length > 0);
}

/** Whether a light is on, as its fader would show it, with a command on its way. */
export const lit = isLit;

/** The house's lights on, of how many, in how many rooms; no room is not one (lights.ts). */
export const lightsCount = (rows: LightRow[], wants: Wants = {}): LightsCount =>
	countLights(
		rows.map((r) => ({ room: r.place.room, lights: r.lights })),
		wants
	);

/** Under a room's name: "2 of 5 on", "All off". */
export function onWord(lights: CoreDevice[], wants: Wants = {}): string {
	const on = lights.filter((d) => lit(d, wants)).length;
	if (on === 0) return 'All off';
	if (on === lights.length) return lights.length === 1 ? 'On' : `All ${on} on`;
	return `${on} of ${lights.length} on`;
}

// ---- Media ----

export interface PlayerRow {
	device: CoreDevice;
	place: Place;
}

/** Every player, room by room, screens before speakers, as each room's Media tab has them. */
export function playerRows(places: Place[]): PlayerRow[] {
	return places.flatMap((place) => {
		const { screens, speakers } = orderPlayers(place.model.byTab.media);
		return [...screens, ...speakers].map((device) => ({ device, place }));
	});
}

/** The rooms with nothing to play. */
export const silentRooms = (places: Place[]): Place[] =>
	places.filter((p) => p.room && p.model.byTab.media.length === 0);

export const playingNow = (rows: PlayerRow[], wants: Wants = {}): PlayerRow[] =>
	rows.filter((r) => r.device.available && isPlaying(r.device, wants[r.device.device_id]?.want));

// ---- Climate ----

export interface StatRow {
	device: CoreDevice;
	/** The switch it runs, when it says. */
	runs?: CoreDevice;
	place: Place;
}

export interface FanRow {
	device: CoreDevice;
	place: Place;
}

export interface ReadingRow {
	reading: Reading;
	place: Place;
	/** The room it's listed under: its room's, else "Outside" for a weather station, else none. */
	where?: string;
	/** What reads it: "YoLink", "Hue motion", "Ecowitt". */
	from: string;
}

export interface ClimateView {
	thermostats: StatRow[];
	fans: FanRow[];
	readings: ReadingRow[];
}

const OUTSIDE = new Set(['weather_station']);

/** Where a reading comes from, for the line under its name. */
export function fromWord(d: CoreDevice): string {
	const brand = brandOf(d.plugin_id);
	return kindOf(d) === 'motion_sensor' ? `${brand} motion` : brand;
}

/**
 * Every thermostat and fan, as each room's Climate tab has them, and every
 * reading of temperature or humidity from the room's sensors: motion
 * sensors and weather stations included, thermostats and leak sensors left
 * to their own views. Readings with a room come in Home's order, then a
 * weather station as Outside, then those in no room.
 */
export function climateView(places: Place[], byId: Devices = {}, u: Units = units()): ClimateView {
	const thermostats: StatRow[] = [];
	const fans: FanRow[] = [];
	const withRoom: ReadingRow[] = [];
	const outside: ReadingRow[] = [];
	const loose: ReadingRow[] = [];
	for (const place of places) {
		const tab = climateTab(place.model.byTab.climate, byId);
		for (const t of tab.thermostats) thermostats.push({ ...t, place });
		for (const f of tab.fans) fans.push({ device: f, place });
		for (const d of place.model.byTab.sensors) {
			const reading = readingOf(d, u);
			if (!reading) continue;
			const row = { reading, place, from: fromWord(d) };
			if (place.room) withRoom.push({ ...row, where: place.name });
			else if (OUTSIDE.has(kindOf(d))) outside.push({ ...row, where: 'Outside' });
			else loose.push(row);
		}
	}
	const byName = (a: ReadingRow, b: ReadingRow) =>
		(a.reading.device.name_override ?? a.reading.device.name).localeCompare(
			b.reading.device.name_override ?? b.reading.device.name,
			undefined,
			{ numeric: true }
		);
	return {
		thermostats,
		fans,
		readings: [...withRoom, ...outside.sort(byName), ...loose.sort(byName)]
	};
}

/** Whether a thermostat is heating or cooling now. */
export function working(d: CoreDevice): boolean {
	const doing = thermostatOf(d).doing;
	return d.available && (doing === 'heating' || doing === 'cooling');
}

// ---- Security ----

export interface SecItem {
	device: CoreDevice;
	kind: 'lock' | 'door';
	/** Locked, or closed. */
	ok: boolean;
	/** "Locked", "Unlocked", "Open", "Closed", "Offline". */
	word: string;
}

export interface SecRow {
	place: Place;
	items: SecItem[];
}

/** Whether a lock is locked, with a command on its way. */
export const locked = (d: CoreDevice, wants: Wants = {}): boolean =>
	({ ...d.attributes, ...wants[d.device_id]?.want }).locked === true;

export function secItem(d: CoreDevice, kind: SecItem['kind'], wants: Wants = {}): SecItem {
	if (!d.available) return { device: d, kind, ok: false, word: 'Offline' };
	if (kind === 'lock') {
		const ok = locked(d, wants);
		return { device: d, kind, ok, word: ok ? 'Locked' : 'Unlocked' };
	}
	const open = isOpen(cardFor(d, 0));
	return { device: d, kind, ok: !open, word: open ? 'Open' : 'Closed' };
}

/** Each room's locks, then its doors and windows, as its header's pills show them. */
export const secRows = (places: Place[], wants: Wants = {}): SecRow[] =>
	places
		.map((place) => ({
			place,
			items: [
				...place.model.locks.map((d) => secItem(d, 'lock', wants)),
				...place.model.openings.map((d) => secItem(d, 'door', wants))
			]
		}))
		.filter((r) => r.items.length > 0);

/** What needs attention: a lock unlocked, a door open, either one offline. */
export const issuesOf = (rows: SecRow[]): { place: Place; item: SecItem }[] =>
	rows.flatMap((r) => r.items.filter((i) => !i.ok).map((item) => ({ place: r.place, item })));

/** The sidebar's word for what needs attention: "2 open", "1 offline", "3 to check". */
export function issuesWord(issues: { item: SecItem }[]): string {
	const offline = issues.filter((i) => !i.item.device.available).length;
	if (offline === 0) return `${issues.length} open`;
	if (offline === issues.length) return `${offline} offline`;
	return `${issues.length} to check`;
}

// ---- Water ----

export interface WaterView {
	valves: { device: CoreDevice; place: Place }[];
	/** Leak sensors, by room. */
	leaks: { place: Place; sensors: CoreDevice[] }[];
	/** The sensors finding water now. */
	wet: { device: CoreDevice; place: Place }[];
}

export function waterView(places: Place[]): WaterView {
	const view: WaterView = { valves: [], leaks: [], wet: [] };
	for (const place of places) {
		const tab = waterTab(place.model.byTab.water);
		for (const v of tab.valves) view.valves.push({ device: v, place });
		if (tab.leaks.length > 0) view.leaks.push({ place, sensors: tab.leaks });
		for (const d of tab.leaks) if (d.available && wet(d)) view.wet.push({ device: d, place });
	}
	return view;
}

/** The valves letting water through now. */
export const openValves = (view: WaterView, wants: Wants = {}) =>
	view.valves.filter(
		(v) => v.device.available && valveOpen(v.device, wants[v.device.device_id]?.want)
	);

// ---- the sidebar ----

/** Each view's line in the sidebar, and its light: lit, playing, wrong, wet or fine. */
export interface ViewStatus {
	word: string;
	/** The word in full, for its title: "27 on in 10 rooms and 1 with no room". */
	full?: string;
	tone?: 'on' | 'media' | 'warn' | 'wet' | 'ok';
}

export function statusOf(places: Place[], wants: Wants = {}): Record<ViewId, ViewStatus> {
	const lights = lightsCount(lightRows(places), wants);
	const playing = playingNow(playerRows(places), wants).length;
	const climate = climateView(places);
	const busy = climate.thermostats.filter((t) => working(t.device)).length;
	const issues = issuesOf(secRows(places, wants));
	const water = waterView(places);
	return {
		lights: lights.on
			? { word: `${lights.on} on`, full: `${lights.on} on ${whereLit(lights)}`, tone: 'on' }
			: { word: 'all off' },
		media: playing ? { word: `${playing} playing`, tone: 'media' } : { word: '' },
		climate: { word: busy ? `${busy} working` : '' },
		security: issues.length
			? { word: issuesWord(issues), tone: 'warn' }
			: { word: secRows(places).length ? 'secure' : '', tone: 'ok' },
		water: water.wet.length
			? { word: `${water.wet.length} leaking`, tone: 'wet' }
			: { word: water.leaks.length ? 'all dry' : '', tone: 'ok' }
	};
}
