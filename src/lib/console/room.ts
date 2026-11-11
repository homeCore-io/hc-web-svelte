/**
 * A room in the console's look (the FamilyRoom, Office and LivingRoom
 * boards): its devices sorted into tabs, and the Lights tab into columns.
 *
 * Each device goes in one tab only. Doors holds locks, door and window
 * contacts, covers and openers (and cameras and sirens, until there is a
 * Security tab); Lights, lights, keypads and lighting scenes; Media, players;
 * Climate, what you set (thermostats, fans, humidifiers); Water, leak
 * sensors and valves; Sensors, every reading. Plain on/off switches sit in
 * Lights as a column of their own, and get a tab of their own only when
 * Lights would be too crowded for them.
 *
 * The Lights tab is a row of columns, one per lighting system's group: a Hue
 * room or zone (a group device that lists its `light_ids`, or the lights and
 * scenes its bridge says share a room), then each other brand's lights.
 *
 * Pure: the page draws what this decides.
 */
import { kindOf } from '../card.js';
import type { CoreDevice, Devices } from '../devices.js';
import type { Room } from '../house.js';
import { slugOf } from '../summary.js';

export type TabId = 'doors' | 'lights' | 'switches' | 'media' | 'climate' | 'water' | 'sensors';

/** Every tab, in the order shown when something in the room opens; else Lights comes first. */
export const TABS: readonly { id: TabId; name: string }[] = [
	{ id: 'doors', name: 'Doors' },
	{ id: 'lights', name: 'Lights' },
	{ id: 'switches', name: 'Switches' },
	{ id: 'media', name: 'Media' },
	{ id: 'climate', name: 'Climate' },
	{ id: 'water', name: 'Water' },
	{ id: 'sensors', name: 'Sensors' }
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
const DOOR_KINDS = new Set(['lock', 'contact_sensor', 'door', 'window', ...OPENER_KINDS]);
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
	if (isScene(d)) return OPENS.test(name) ? { tab: 'doors' } : { tab: 'lights', as: 'scene' };
	if (LIGHT_KINDS.has(k)) return { tab: 'lights', as: 'light' };
	if (k === 'group')
		return typeof d.attributes?.brightness_pct === 'number'
			? { tab: 'lights', as: 'light' }
			: { tab: 'switch' };
	if (isKeypad(d)) return { tab: 'lights', as: 'keypad' };
	if (KEYPAD_KINDS.has(k)) return null;
	if (SWITCH_KINDS.has(k)) {
		if (OPENS.test(name)) return { tab: 'doors' };
		if (VALVE.test(name)) return { tab: 'water' };
		if (AIR.test(name)) return { tab: 'climate' };
		return { tab: 'switch' };
	}
	if (DOOR_KINDS.has(k) || SECURITY_KINDS.has(k)) return { tab: 'doors' };
	if (MEDIA_KINDS.has(k)) return { tab: 'media' };
	if (CLIMATE_KINDS.has(k)) return { tab: 'climate' };
	if (WATER_KINDS.has(k)) return { tab: 'water' };
	if (SENSOR_KINDS.has(k)) return { tab: 'sensors' };
	// Anything else that does something (a timer, a button) goes with the switches' tab.
	if (d.schema?.actions?.length || k === 'timer' || k === 'button') return { tab: 'switches' };
	return { tab: 'sensors' };
}

/** Whether a device opens and closes something: a cover, a garage door opener, a gate. */
export function opens(d: CoreDevice): boolean {
	const k = kindOf(d);
	if (OPENER_KINDS.has(k)) return true;
	return (SWITCH_KINDS.has(k) || isScene(d)) && OPENS.test(d.name_override ?? d.name);
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
	/** For the header: locks, and what opens and closes (doors, windows, covers). */
	locks: CoreDevice[];
	openings: CoreDevice[];
	/** The tab shown when none was chosen. */
	first: TabId | undefined;
}

const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
const byName = (a: CoreDevice, b: CoreDevice) =>
	nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true });

/** "plugin.hue" → "Hue"; "sbx.standin" → "Standin". */
export function brandOf(plugin: string | undefined): string {
	const last = (plugin ?? '').split('.').pop() ?? '';
	if (last === '') return 'Other';
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

/** Sort a room's devices into the console's tabs, for a Lights tab `width` pixels across. */
export function consoleRoom(devices: CoreDevice[], width = LIGHTS_WIDTH): ConsoleRoom {
	const byTab: Record<TabId, CoreDevice[]> = {
		doors: [],
		lights: [],
		switches: [],
		media: [],
		climate: [],
		water: [],
		sensors: []
	};
	const lights: CoreDevice[] = [];
	const groups: CoreDevice[] = [];
	const scenes: CoreDevice[] = [];
	const keypads: CoreDevice[] = [];
	const switches: CoreDevice[] = [];
	for (const d of [...devices].sort(byName)) {
		const p = placeOf(d);
		if (p === null) continue;
		if (p.tab === 'switch') switches.push(d);
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
		// The Lights tab counts what lights the room, not its scenes or groups.
		lights: columns.reduce((n, c) => n + c.lights.length, 0) + tab.switches.length
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
		locks: byTab.doors.filter((d) => kindOf(d) === 'lock'),
		openings: byTab.doors.filter((d) => {
			const k = kindOf(d);
			return k === 'contact_sensor' || k === 'door' || k === 'window' || OPENER_KINDS.has(k);
		}),
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
export function levelOf(d: CoreDevice, want?: Record<string, unknown>): number {
	const a = { ...d.attributes, ...want };
	if (a.on !== true) return 0;
	return typeof a.brightness_pct === 'number' ? Math.round(a.brightness_pct) : 100;
}

/** What to send for a fader set to `v`: off at 0, else on at that brightness. */
export const levelWant = (v: number): Record<string, unknown> =>
	v <= 0 ? { on: false } : { on: true, brightness_pct: v };

/**
 * A device's name without the room's in front, where the room is plain from
 * the page: "Family Room Floor Lamp" in the Family Room is "Floor Lamp". A
 * name that is only the room's is kept whole.
 */
export function shortName(name: string, room: string): string {
	const r = room.trim().toLowerCase();
	if (r === '' || !name.toLowerCase().startsWith(r)) return name;
	const rest = name.slice(r.length);
	if (!/^[\s\-–:]/.test(rest)) return name;
	const left = rest.replace(/^[\s\-–:]+/, '');
	return left === '' ? name : left.charAt(0).toUpperCase() + left.slice(1);
}
