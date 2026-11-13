/**
 * A room in the console's look (the FamilyRoom, Office and LivingRoom
 * boards): its devices sorted into tabs, and the Lights tab into columns.
 *
 * Each device goes in one tab only. Doors holds locks, door and window
 * contacts, covers and openers; Cameras, cameras and doorbells with their
 * spotlights and sirens; Lights, lights, keypads and lighting scenes; Media, players;
 * Climate, what you set (thermostats, fans, humidifiers); Water, leak
 * sensors and valves; Sensors, every reading; Timers, timers with their
 * clocks. A switch a thermostat in the
 * room runs goes with it, in Climate. Plain on/off switches sit in Lights as
 * a column of their own, and get a tab of their own only when Lights would be
 * too crowded for them. homeCore's own switches (virtual switches, groups,
 * timers) are what they are: never placed by their names.
 *
 * The household may put any device on any tab of its room (`TabChoices`):
 * that tab takes it over where it would go, and draws what it has no
 * drawing of its own for as a switch, a timer's clock or a row.
 *
 * The Lights tab is a row of columns, one per lighting system's group: a Hue
 * room or zone (a group device that lists its `light_ids`, or the lights and
 * scenes its bridge says share a room), then each other brand's lights.
 *
 * Pure: the page draws what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import { isCamera, isCameraLight } from '../cameraLights.js';
import type { Room } from '../house.js';
import { isHelper } from '../helpers.js';
import { isLamp, lightLevel } from '../lights.js';
import { slugOf } from '../summary.js';

export type TabId =
	| 'doors'
	| 'lights'
	| 'switches'
	| 'timers'
	| 'media'
	| 'climate'
	| 'water'
	| 'sensors'
	| 'cameras';

/** Every tab, in the order shown when something in the room opens; else Lights comes first. */
export const TABS: readonly { id: TabId; name: string }[] = [
	{ id: 'doors', name: 'Doors' },
	{ id: 'lights', name: 'Lights' },
	{ id: 'switches', name: 'Switches' },
	{ id: 'timers', name: 'Timers' },
	{ id: 'media', name: 'Media' },
	{ id: 'climate', name: 'Climate' },
	{ id: 'water', name: 'Water' },
	{ id: 'sensors', name: 'Sensors' },
	{ id: 'cameras', name: 'Cameras' }
];

// ---- which room ----

/**
 * The room a device is in, as a slug: homeCore's `room` (v0.1.103 and on),
 * else the person's choice, else the bridge's, as the rest of the app reads it.
 */
export function roomSlugOf(d: CoreDevice): string | undefined {
	const r = (d as CoreDevice & { room?: unknown }).room;
	return typeof r === 'string' && r !== '' ? r : (d.area_override ?? d.area);
}

/** The devices in a room, matched by its slug or any of its aliases. */
export function devicesIn(all: Devices | CoreDevice[], room: Room): CoreDevice[] {
	const list = Array.isArray(all) ? all : Object.values(all);
	return list.filter((d) => {
		const slug = roomSlugOf(d);
		if (slug === undefined) return false;
		const s = slugOf(slug);
		return s === room.slug || room.aliases.includes(s);
	});
}

// ---- which tab ----

const LIGHT_KINDS = new Set(['light', 'dimmer']);
const SWITCH_KINDS = new Set(['switch', 'outlet', 'virtual_switch', 'plug']);
const KEYPAD_KINDS = new Set(['keypad', 'vcrx']);
const OPENER_KINDS = new Set(['cover', 'garage', 'garage_door', 'gate', 'shade', 'blind']);
const OPENING_KINDS = new Set(['contact_sensor', 'door', 'window', ...OPENER_KINDS]);
const DOOR_KINDS = new Set(['lock', ...OPENING_KINDS]);
const SECURITY_KINDS = new Set(['camera', 'siren', 'doorbell']);
const MEDIA_KINDS = new Set(['media_player', 'tv', 'speaker', 'receiver']);
const CLIMATE_KINDS = new Set([
	'thermostat',
	'fan',
	'humidifier',
	'dehumidifier',
	'hvac',
	'climate',
	'air_purifier',
	'heater'
]);
const WATER_KINDS = new Set(['water_sensor', 'leak_sensor', 'valve', 'water_valve', 'sprinkler']);
const SENSOR_KINDS = new Set([
	'temperature_sensor',
	'humidity_sensor',
	'motion_sensor',
	'occupancy_sensor',
	'vibration_sensor',
	'illuminance_sensor',
	'air_quality_sensor',
	'smoke_sensor',
	'co_sensor',
	'weather_station',
	'weather',
	'rain_sensor',
	'lightning_sensor',
	'sensor',
	'binary_sensor',
	'energy_meter',
	'power_meter'
]);
/** Hubs and remotes: nothing to use in a room. */
const LEFT_OUT = new Set(['gateway', 'bridge', 'pico_remote', 'remote', 'mode']);

/** A switch or scene that opens something, by its name: "Garage Door", "Gate". */
const OPENS = /\b(garage door|oh door|overhead door|gate)\b/i;
/** A switch that runs a valve. */
const VALVE = /\bvalve\b/i;
/** A plugin's switch named for the valve it runs: shown as the valve. */
export const runsValve = (d: CoreDevice): boolean =>
	SWITCH_KINDS.has(kindOf(d)) && !isHelper(d) && VALVE.test(d.name_override ?? d.name);
/** A switch that powers something you'd set the room's air with. */
const AIR = /\b(humidifier|dehumidifier|heater|space heater)\b/i;

const isScene = (d: CoreDevice) => kindOf(d) === 'scene';
/** A lighting system's scene: it names the room or zone it belongs to. */
const isLightScene = (d: CoreDevice) => isScene(d) && typeof d.attributes?.group_rid === 'string';
/** A group of lights its system keeps, listing them. */
const isLightGroup = (d: CoreDevice) =>
	kindOf(d) === 'group' && Array.isArray(d.attributes?.light_ids);
/** A keypad with buttons and lights of its own (Lutron's). */
const isKeypad = (d: CoreDevice) =>
	KEYPAD_KINDS.has(kindOf(d)) && Array.isArray(d.attributes?.available_buttons);

/** Where a device goes in the room: its tab, or for Lights, which part of it. */
export type Place =
	| { tab: Exclude<TabId, 'lights'> }
	| { tab: 'lights'; as: 'light' | 'group' | 'scene' | 'keypad' }
	| { tab: 'switch' }
	| null;

/** Where one device goes; `null` for hubs and remotes, which a room page leaves out. */
export function placeOf(d: CoreDevice): Place {
	const k = kindOf(d);
	const name = d.name_override ?? d.name;
	if (LEFT_OUT.has(k)) return null;
	if (isLightGroup(d)) return { tab: 'lights', as: 'group' };
	if (isLightScene(d)) return { tab: 'lights', as: 'scene' };
	if (isScene(d))
		return OPENS.test(name) && !isHelper(d) ? { tab: 'doors' } : { tab: 'lights', as: 'scene' };
	if (LIGHT_KINDS.has(k)) return { tab: 'lights', as: 'light' };
	if (k === 'group')
		return typeof d.attributes?.brightness_pct === 'number'
			? { tab: 'lights', as: 'light' }
			: { tab: 'switch' };
	if (isKeypad(d)) return { tab: 'lights', as: 'keypad' };
	if (KEYPAD_KINDS.has(k)) return null;
	if (SWITCH_KINDS.has(k)) {
		// A virtual switch named "Garage Door" opens nothing; it's a switch.
		if (isHelper(d)) return { tab: 'switch' };
		if (OPENS.test(name)) return { tab: 'doors' };
		if (VALVE.test(name)) return { tab: 'water' };
		if (AIR.test(name)) return { tab: 'climate' };
		return { tab: 'switch' };
	}
	if (SECURITY_KINDS.has(k)) return { tab: 'cameras' };
	if (DOOR_KINDS.has(k)) return { tab: 'doors' };
	if (MEDIA_KINDS.has(k)) return { tab: 'media' };
	if (CLIMATE_KINDS.has(k)) return { tab: 'climate' };
	if (WATER_KINDS.has(k)) return { tab: 'water' };
	if (SENSOR_KINDS.has(k)) return { tab: 'sensors' };
	// Timers have a tab of their own, with their clocks.
	if (k === 'timer') return { tab: 'timers' };
	// Anything else that does something (a button) goes with the switches' tab.
	if (d.schema?.actions?.length || k === 'button') return { tab: 'switches' };
	return { tab: 'sensors' };
}

// ---- the household's choice of tab ----

/**
 * The tab the household chose for a device, by device id, in its room
 * (`HouseDoc.console.tabs`): `{ "switch_auto_garage_door": "doors" }`.
 */
export type TabChoices = Record<string, TabId>;

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

/** The choices as they stand, from a document anyone could have written. */
export function tabChoicesOf(v: unknown): TabChoices {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
	return Object.fromEntries(
		Object.entries(v).filter(([id, t]) => id !== '' && typeof t === 'string' && TAB_IDS.has(t))
	) as TabChoices;
}

/**
 * The household's console choices with a device's tab set, or with
 * `undefined` back to where it goes by itself; nothing left is none.
 */
export function withDeviceTab<C extends { tabs?: TabChoices }>(
	c: C | undefined,
	id: string,
	tab: TabId | undefined
): C | undefined {
	const { tabs, ...rest } = (c ?? {}) as C;
	const next = { ...tabChoicesOf(tabs) };
	if (tab && TAB_IDS.has(tab)) next[id] = tab;
	else delete next[id];
	const out = (Object.keys(next).length > 0 ? { ...rest, tabs: next } : rest) as C;
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Where a device the household put on a tab goes: that tab. On Lights, a
 * light where it would go, anything that dims as a light, and anything else
 * with the room's switches.
 */
function chosenPlace(d: CoreDevice, tab: TabId): Exclude<Place, null> {
	if (tab !== 'lights') return { tab };
	const own = placeOf(d);
	if (own?.tab === 'lights') return own;
	return dims(d) ? { tab: 'lights', as: 'light' } : { tab: 'switch' };
}

/** Whether a device opens and closes something: a cover, a garage door opener, a gate. */
export function opens(d: CoreDevice): boolean {
	const k = kindOf(d);
	if (OPENER_KINDS.has(k)) return true;
	if (isHelper(d)) return false;
	return (SWITCH_KINDS.has(k) || isScene(d)) && OPENS.test(d.name_override ?? d.name);
}

/**
 * Whether a kind of device keeps the house shut, as a header's pills show
 * it: a lock, or a door, window or cover that opens.
 */
export function guards(kind: string): 'lock' | 'door' | undefined {
	if (kind === 'lock') return 'lock';
	return OPENING_KINDS.has(kind) ? 'door' : undefined;
}

// ---- the Lights tab ----

/** A column of the Lights tab: one group of one lighting system. */
export interface LightColumn {
	key: string;
	/** The system, as its plugin is called: Hue, Lutron. */
	brand: string;
	plugin: string;
	/** The room or zone's name, else the one light's, else "Lights". */
	title: string;
	/** The system's own group, for the "All" fader; else "All" sets each light. */
	group?: CoreDevice;
	lights: CoreDevice[];
	/** The group's scenes, as small chips under it. */
	scenes: CoreDevice[];
	/** The bridge's room or zone these belong to, when it says. */
	rid?: string;
}

export interface LightsTab {
	columns: LightColumn[];
	/** Plain on/off switches, as a column, unless they have a tab of their own. */
	switches: CoreDevice[];
	keypads: CoreDevice[];
	/** Scenes that belong to no lighting group (a house's own). */
	scenes: CoreDevice[];
	/** Narrower pills, so a crowded room fits across. */
	tight: boolean;
}

export interface ConsoleRoom {
	/** The tabs with something in them, in the order shown. */
	tabs: { id: TabId; name: string; count: number }[];
	lights: LightsTab;
	/** Each tab's devices (Lights' too: every light, switch, keypad and scene in it). */
	byTab: Record<TabId, CoreDevice[]>;
	/** For the header: locks, and what opens and closes (doors, windows, covers), on any tab. */
	locks: CoreDevice[];
	openings: CoreDevice[];
	/** The tab shown when none was chosen. */
	first: TabId | undefined;
}

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
const byName = (a: CoreDevice, b: CoreDevice) =>
	nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true });

/** Brands spelled their own way. */
const BRANDS: Record<string, string> = {
	yolink: 'YoLink',
	nuheat: 'NuHeat',
	zwave: 'Z-Wave',
	glue: 'homeCore'
};

/** "plugin.hue" → "Hue"; "sbx.standin" → "Standin"; "plugin.yolink" → "YoLink". */
export function brandOf(plugin: string | undefined): string {
	const last = (plugin ?? '').split('.').pop() ?? '';
	if (last === '') return 'Other';
	if (BRANDS[last]) return BRANDS[last];
	return last.charAt(0).toUpperCase() + last.slice(1);
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/**
 * The Lights tab's columns. A system's group device takes its lights; the
 * rest of a bridge's lights make a column by the room the bridge puts them
 * in (`room_rid`), else one per bridge; each scene joins the column of the
 * room or zone it names (`group_rid`). Other brands get a column each.
 */
export function lightColumns(lights: CoreDevice[], groups: CoreDevice[], scenes: CoreDevice[]) {
	const columns: LightColumn[] = [];
	const byId = new Map(lights.map((l) => [l.device_id, l]));
	const claimed = new Set<string>();
	for (const g of [...groups].sort(byName)) {
		const ids = (g.attributes.light_ids as unknown[]).filter((x) => typeof x === 'string');
		const members = ids.map((id) => byId.get(id)).filter((l): l is CoreDevice => !!l);
		for (const m of members) claimed.add(m.device_id);
		columns.push({
			key: `group:${g.device_id}`,
			brand: brandOf(g.plugin_id),
			plugin: g.plugin_id ?? '',
			title: nameOf(g),
			group: g,
			lights: members.sort(byName),
			scenes: [],
			rid: str(g.attributes.group_rid)
		});
	}
	const bridged = new Set(scenes.filter(isLightScene).map((s) => s.plugin_id ?? ''));
	for (const l of lights) {
		if (claimed.has(l.device_id)) continue;
		const a = l.attributes;
		const plugin = l.plugin_id ?? '';
		const rid = str(a.room_rid);
		const key = rid
			? `rid:${rid}`
			: bridged.has(plugin)
				? `bridge:${plugin}:${str(a.bridge_id) ?? ''}`
				: `plugin:${plugin}`;
		let col = columns.find((c) => c.key === key);
		if (!col) {
			col = {
				key,
				brand: brandOf(plugin),
				plugin,
				title: str(a.room_name) ?? '',
				lights: [],
				scenes: [],
				rid
			};
			columns.push(col);
		}
		col.lights.push(l);
	}
	const loose: CoreDevice[] = [];
	for (const s of [...scenes].sort(byName)) {
		const rid = str(s.attributes.group_rid);
		if (!rid) {
			loose.push(s);
			continue;
		}
		const bridge = `bridge:${s.plugin_id ?? ''}:${str(s.attributes.bridge_id) ?? ''}`;
		let col =
			columns.find((c) => c.rid === rid) ??
			columns.find((c) => c.key === bridge && c.rid === undefined);
		if (col) col.rid ??= rid;
		else {
			col = {
				key: `rid:${rid}`,
				brand: brandOf(s.plugin_id),
				plugin: s.plugin_id ?? '',
				title: '',
				lights: [],
				scenes: [],
				rid
			};
			columns.push(col);
		}
		if (col.title === '') col.title = str(s.attributes.group_name) ?? '';
		col.scenes.push(s);
	}
	for (const c of columns) {
		c.lights.sort(byName);
		if (c.title === '') c.title = c.lights.length === 1 ? nameOf(c.lights[0]!) : 'Lights';
	}
	// Columns with scenes first (a lighting system's rooms), then by brand and name.
	columns.sort(
		(a, b) =>
			Number(b.scenes.length > 0) - Number(a.scenes.length > 0) ||
			a.brand.localeCompare(b.brand) ||
			a.title.localeCompare(b.title)
	);
	return { columns: columns.filter((c) => c.lights.length > 0 || c.scenes.length > 0), loose };
}

/** How many faders a column draws: one per light, and "All" over two or more. */
export const fadersIn = (c: LightColumn): number =>
	c.lights.length + (c.group || c.lights.length > 1 ? 1 : 0);

/** The width the Lights tab has, in pixels, on a laptop's screen. */
export const LIGHTS_WIDTH = 1120;
/** At most this many switches sit in the Lights tab as a column. */
export const SWITCHES_IN_LIGHTS = 7;

/** A fader's place across, with the gap after it: its pill, wide or tight. */
const FADER = { wide: 116, tight: 104 };
/** A column's padding and rule; the narrowest a group's scenes are laid in; a keypad's column. */
const COLUMN = 41;
export const SCENES_MIN = 260;
const KEYPAD = 211;
/** The switches' column, at its narrowest. */
const SWITCHES = 230;

/** How wide the Lights tab's columns are, side by side, without the switches. */
export function widthOf(t: Omit<LightsTab, 'switches' | 'tight'>, tight: boolean): number {
	const step = tight ? FADER.tight : FADER.wide;
	const cols = t.columns.reduce(
		(n, c) => n + Math.max(fadersIn(c) * step - 12, c.scenes.length > 0 ? SCENES_MIN : 0) + COLUMN,
		0
	);
	return cols + t.keypads.length * KEYPAD + (t.scenes.length > 0 ? SCENES_MIN + COLUMN : 0);
}

/**
 * How the Lights tab is laid across `width`: tight when that is what makes
 * it fit, and whether the switches would crowd it (more than fit down a
 * column, or more than fit across even tight), so they get a tab of their own.
 */
export function layOut(
	t: Omit<LightsTab, 'switches' | 'tight'>,
	switches: number,
	width = LIGHTS_WIDTH
): { tight: boolean; crowd: boolean } {
	const extra = switches > 0 && switches <= SWITCHES_IN_LIGHTS ? SWITCHES : 0;
	if (widthOf(t, false) + extra <= width)
		return { tight: false, crowd: switches > SWITCHES_IN_LIGHTS };
	if (widthOf(t, true) + extra <= width)
		return { tight: true, crowd: switches > SWITCHES_IN_LIGHTS };
	// Too wide even tight: the switches go to their own tab, and the lights wrap.
	return { tight: true, crowd: switches > 0 };
}

/** The switches the room's thermostats run (`actuator_device_id`). */
export function runByThermostats(devices: CoreDevice[]): Set<string> {
	const ids = devices
		.filter((d) => kindOf(d) === 'thermostat')
		.map((d) => str(d.attributes?.actuator_device_id))
		.filter((id): id is string => id !== undefined);
	return new Set(ids);
}

/**
 * Sort a room's devices into the console's tabs, for a Lights tab `width`
 * pixels across, with the household's choices of tab (`chosen`). Lights
 * and switches in `off` were hidden from the room (layout.ts): left out.
 * `all` is the house, so a camera's spotlight goes with Cameras even when
 * its camera is in another room. `isLight` says which of the room's switches
 * are lights, for the Lights tab's count (lights.ts; `roomLights` knows the
 * room's drawing too); by itself, a switch named as a light.
 */
export function consoleRoom(
	devices: CoreDevice[],
	width = LIGHTS_WIDTH,
	chosen: TabChoices = {},
	off: ReadonlySet<string> = new Set(),
	all: Devices | readonly CoreDevice[] = devices,
	isLight: (d: CoreDevice) => boolean = isLamp
): ConsoleRoom {
	const byTab: Record<TabId, CoreDevice[]> = {
		doors: [],
		lights: [],
		switches: [],
		timers: [],
		media: [],
		climate: [],
		water: [],
		sensors: [],
		cameras: []
	};
	const lights: CoreDevice[] = [];
	const groups: CoreDevice[] = [];
	const scenes: CoreDevice[] = [];
	const keypads: CoreDevice[] = [];
	const switches: CoreDevice[] = [];
	const run = runByThermostats(devices);
	// A camera's spotlight goes with it, in Cameras.
	const cameras = new Set(devices.filter(isCamera).map((d) => d.device_id));
	const placed: CoreDevice[] = [];
	for (const d of [...devices].sort(byName)) {
		const choice = chosen[d.device_id];
		const p = choice ? chosenPlace(d, choice) : placeOf(d);
		if (p === null) continue;
		if (off.has(d.device_id) && (p.tab === 'switch' || (p.tab === 'lights' && p.as === 'light')))
			continue;
		placed.push(d);
		if (!choice && p.tab === 'lights' && p.as === 'light' && isCameraLight(d, all)) {
			byTab.cameras.push(d);
			continue;
		}
		if (!choice && p.tab === 'switch' && run.has(d.device_id)) byTab.climate.push(d);
		else if (p.tab === 'switch') switches.push(d);
		else if (p.tab === 'lights') {
			({ light: lights, group: groups, scene: scenes, keypad: keypads })[p.as].push(d);
		} else byTab[p.tab].push(d);
	}
	const { columns, loose } = lightColumns(lights, groups, scenes);
	const base = { columns, keypads, scenes: loose };
	const { tight, crowd } = layOut(base, switches.length, width);
	if (crowd) byTab.switches.unshift(...switches);
	const tab: LightsTab = { ...base, switches: crowd ? [] : switches, tight };
	byTab.lights = [
		...columns.flatMap((c) => [...(c.group ? [c.group] : []), ...c.lights, ...c.scenes]),
		...tab.switches,
		...keypads,
		...loose
	];
	const counted: Record<TabId, number> = {
		...(Object.fromEntries(Object.entries(byTab).map(([k, v]) => [k, v.length])) as Record<
			TabId,
			number
		>),
		// The Lights tab counts the room's lights on it, not its scenes, groups or
		// the switches that power something else (an AC outlet, a fan); with
		// nothing that lights it (a keypad alone), what is on it.
		lights:
			columns.reduce((n, c) => n + c.lights.length, 0) +
				tab.switches.filter((d) => chosen[d.device_id] === 'lights' || isLight(d)).length ||
			byTab.lights.length,
		// The Cameras tab counts its cameras, not their spotlights and sirens.
		cameras: byTab.cameras.filter((d) => cameras.has(d.device_id)).length || byTab.cameras.length
	};
	const doorsFirst = byTab.doors.some(opens);
	const present = TABS.filter((t) => byTab[t.id].length > 0);
	// Doors first when something here opens; else Lights first, the rest in order.
	const order = doorsFirst
		? present
		: [...present.filter((t) => t.id === 'lights'), ...present.filter((t) => t.id !== 'lights')];
	const tabs = order.map((t) => ({ ...t, count: counted[t.id] }));
	return {
		tabs,
		lights: tab,
		byTab,
		// Its locks and doors, on whichever tab they are.
		locks: placed.filter((d) => guards(kindOf(d)) === 'lock'),
		openings: placed.filter((d) => guards(kindOf(d)) === 'door'),
		first: tabs[0]?.id
	};
}

/** The tab to show: the one asked for in the address when the room has it, else its first. */
export function tabOf(room: ConsoleRoom, asked: string | null | undefined): TabId | undefined {
	return room.tabs.find((t) => t.id === asked)?.id ?? room.first;
}

// ---- a light's level ----

/** Whether a light dims, rather than only switching. */
export const dims = (d: CoreDevice): boolean =>
	typeof d.attributes?.brightness_pct === 'number' || d.attributes?.supports_dimming === true;

/** A light's level, 0 to 100: its brightness when on, else 0. `want` is a command on its way. */
export const levelOf = lightLevel;

/** What to send for a fader set to `v`: off at 0, else on at that brightness. */
export const levelWant = (v: number): Record<string, unknown> =>
	v <= 0 ? { on: false } : { on: true, brightness_pct: v };

/**
 * A device's name without the room's in front, where the room is plain from
 * the page: "Family Room Floor Lamp" in the Family Room is "Floor Lamp". A
 * name that is only the room's, or another room's numbered after it, is kept whole.
 */
export function shortName(name: string, room: string): string {
	const r = room.trim().toLowerCase();
	if (r === '' || !name.toLowerCase().startsWith(r)) return name;
	const rest = name.slice(r.length);
	if (!/^[\s\-–:]/.test(rest)) return name;
	const left = rest.replace(/^[\s\-–:]+/, '');
	// "Bathroom 2 Leak Sensor" in the Bathroom is another room's: kept whole.
	if (left === '' || /^\d/.test(left)) return name;
	return left.charAt(0).toUpperCase() + left.slice(1);
}
