/**
 * What a device's card shows and offers (03 — C1, C3, C6–C9).
 *
 * One function from a device to a description of its card; the components
 * only draw it. Known kinds get the presentation in 03 §3; anything else
 * falls to the generic rule (03 §4), so a new plugin's devices get sensible
 * cards on the day they appear.
 *
 * Kept free of components and stores so every rule here is tested on plain
 * data — including that no card offers a control a device doesn't declare.
 */
import { remaining } from './helpers.js';
import { isTemperature, numberText, shown, shownRange, toShown } from './units.js';
import { displayName, type AttributeSchema, type CoreDevice, type Schema } from './devices.js';
import { momentOf } from './when.js';

export type IconName =
	| 'light'
	| 'switch'
	| 'fan'
	| 'lock'
	| 'unlock'
	| 'tv'
	| 'speaker'
	| 'timer'
	| 'door'
	| 'door-open'
	| 'water'
	| 'motion'
	| 'thermometer'
	| 'weather'
	| 'rain'
	| 'lightning'
	| 'vibration'
	| 'keypad'
	| 'remote'
	| 'router'
	| 'mode'
	| 'scene'
	| 'device';

/**
 * The symbols a person can give a device (its `status_icon`), in words. The
 * ones a card draws by state — unlocked, an open door — come with their
 * pair and aren't offered on their own.
 */
export const SYMBOLS: { icon: IconName; label: string }[] = [
	{ icon: 'light', label: 'Light' },
	{ icon: 'switch', label: 'Switch' },
	{ icon: 'fan', label: 'Fan' },
	{ icon: 'lock', label: 'Lock' },
	{ icon: 'door', label: 'Door' },
	{ icon: 'tv', label: 'TV' },
	{ icon: 'speaker', label: 'Speaker' },
	{ icon: 'timer', label: 'Timer' },
	{ icon: 'water', label: 'Water' },
	{ icon: 'motion', label: 'Motion' },
	{ icon: 'thermometer', label: 'Thermometer' },
	{ icon: 'weather', label: 'Weather' },
	{ icon: 'rain', label: 'Rain' },
	{ icon: 'lightning', label: 'Lightning' },
	{ icon: 'vibration', label: 'Vibration' },
	{ icon: 'keypad', label: 'Keypad' },
	{ icon: 'remote', label: 'Remote' },
	{ icon: 'router', label: 'Network' },
	{ icon: 'mode', label: 'Mode' },
	{ icon: 'scene', label: 'Scene' },
	{ icon: 'device', label: 'Box' }
];
/** A chosen symbol, kept in step with the state it shows: open, unlocked. */
function symbolFor(chosen: string | undefined, drawn: IconName): IconName | undefined {
	if (!chosen || !SYMBOLS.some((s) => s.icon === chosen)) return undefined;
	if (chosen === 'lock' && drawn === 'unlock') return 'unlock';
	if (chosen === 'door' && drawn === 'door-open') return 'door-open';
	return chosen as IconName;
}

/** The one control on Compact and Standard cards. */
export type Control =
	| { kind: 'switch'; attr: string; on: boolean }
	| { kind: 'lock'; locked: boolean }
	| { kind: 'play'; playing: boolean; action: string }
	| { kind: 'timer'; running: boolean; durationSecs: number }
	| { kind: 'button'; label: string; action: string; confirm?: string };

/** What the Large form adds inline. */
export type Extra =
	| {
			kind: 'slider';
			attr: string;
			label: string;
			value: number;
			min: number;
			max: number;
			step: number;
			/** The unit shown — the person's, e.g. °F. */
			unit?: string;
			/** The schema's unit when the slider is in another: what it sends is turned back. */
			from?: string;
	  }
	| { kind: 'steps'; attr: string; label: string; value: string; options: string[] }
	| { kind: 'transport'; previous?: string; next?: string }
	| { kind: 'reading'; label: string; value: string };

export interface Channel {
	attr: string;
	label: string;
	on: boolean;
}

export type Tone = 'on' | 'off' | 'alert' | 'neutral';

export interface CardView {
	id: string;
	kind: string;
	name: string;
	icon: IconName;
	stateLine: string;
	tone: Tone;
	control: Control | null;
	extras: Extra[];
	/**
	 * What's playing, as a picture: homeCore fetches the player's artwork
	 * and hands it back same-origin. Changes with the track.
	 */
	art?: string;
	/**
	 * The artwork is a radio station's logo rather than a cover — no artist,
	 * no album — so it is shown whole, not cropped to fill.
	 */
	artLogo?: boolean;
	/** Multi-channel devices: a switch per channel, and no single control (C7). */
	channels: Channel[];
	available: boolean;
	/** A built-in alarming state (C9): wet, smoke, offline, jammed, low battery. */
	alarm?: string;
}

/** How long a device may stay silent before its card says so. */
const STALE_MS = 24 * 3600_000;
/** How long a change made elsewhere is mentioned on the card. */
const ELSEWHERE_MS = 30 * 60_000;

/** The kind a card is drawn as: a person's hint wins over the plugin's type. */
export function kindOf(d: CoreDevice): string {
	if (d.ui_hint) return d.ui_hint;
	const t = d.device_type ?? '';
	if (t === 'virtual_switch') return 'switch';
	return t;
}

/**
 * Which kinds are rooms' infrastructure rather than things to use. Shown like
 * any device (C6); grouped last on a room page.
 */
export const INFRASTRUCTURE = new Set(['gateway', 'bridge', 'pico_remote', 'keypad', 'vcrx']);
export const SENSORS = new Set([
	'contact_sensor',
	'door',
	'window',
	'garage',
	'gate',
	'water_sensor',
	'motion_sensor',
	'occupancy_sensor',
	'temperature_sensor',
	'weather_station',
	'rain_sensor',
	'lightning_sensor',
	'vibration_sensor',
	'sensor',
	'binary_sensor'
]);

export function cardFor(d: CoreDevice, now = Date.now()): CardView {
	const kind = kindOf(d);
	const a = d.attributes;
	const s: Schema = d.schema ?? { attributes: {} };
	const base: CardView = {
		id: d.device_id,
		kind,
		name: displayName(d),
		icon: 'device',
		stateLine: '',
		tone: 'neutral',
		control: null,
		extras: [],
		channels: [],
		available: d.available
	};

	const view = describe(kind, d, a, s, base, now);
	view.icon = symbolFor(d.status_icon, view.icon) ?? view.icon;
	view.alarm = alarmOf(d, kind);
	if (view.alarm !== undefined) view.tone = 'alert';

	if (!d.available) {
		view.stateLine = `Offline${since(d.last_seen, now)}`;
		view.tone = 'alert';
		view.alarm ??= 'offline';
		return view;
	}
	view.stateLine = withNotes(view.stateLine, d, kind, now);
	return view;
}

function describe(
	kind: string,
	d: CoreDevice,
	a: Record<string, unknown>,
	s: Schema,
	v: CardView,
	now: number
): CardView {
	const channels = channelsOf(d, s);
	if (channels.length > 1) {
		const on = channels.filter((c) => c.on).length;
		return {
			...v,
			icon: kind === 'light' ? 'light' : 'switch',
			channels,
			stateLine:
				on === 0 ? 'Off' : on === channels.length ? 'All on' : `${on} of ${channels.length} on`,
			tone: on > 0 ? 'on' : 'off'
		};
	}

	switch (kind) {
		case 'light': {
			const on = a.on === true;
			const pct = num(a.brightness_pct);
			v.icon = 'light';
			v.tone = on ? 'on' : 'off';
			v.stateLine = on ? (pct !== undefined ? `On · ${Math.round(pct)}%` : 'On') : 'Off';
			v.control = switchFor(s, 'on', on);
			pushSlider(v, s, a, 'brightness_pct', 'Brightness');
			pushSlider(v, s, a, 'color_temp', 'Warmth');
			return v;
		}
		case 'switch':
		case 'outlet': {
			const on = a.on === true;
			const watts = num(a.power_w);
			v.icon = 'switch';
			v.tone = on ? 'on' : 'off';
			v.stateLine =
				(on ? 'On' : 'Off') + (watts !== undefined && watts > 0 ? ` · ${fmt(watts)} W` : '');
			v.control = switchFor(s, 'on', on);
			if (watts !== undefined)
				v.extras.push({ kind: 'reading', label: 'Power', value: `${fmt(watts)} W` });
			return v;
		}
		case 'fan': {
			const on = a.on === true;
			const speed = typeof a.speed === 'string' ? a.speed : undefined;
			v.icon = 'fan';
			v.tone = on ? 'on' : 'off';
			v.stateLine = on ? (speed && speed !== 'off' ? `On · ${words(speed)}` : 'On') : 'Off';
			v.control = switchFor(s, 'on', on);
			const options = optionsOf(s.attributes.speed).filter((o) => o !== 'off');
			if (s.attributes.speed?.writable && options.length > 0) {
				v.extras.push({
					kind: 'steps',
					attr: 'speed',
					label: 'Speed',
					value: speed ?? '',
					options
				});
			}
			return v;
		}
		case 'lock': {
			const locked = a.locked === true;
			v.icon = locked ? 'lock' : 'unlock';
			v.tone = locked ? 'off' : 'on';
			v.stateLine = locked ? 'Locked' : 'Unlocked';
			if (a.door_open === true) v.stateLine += ' · door open';
			if (s.attributes.locked?.writable) v.control = { kind: 'lock', locked };
			return v;
		}
		case 'media_player':
		case 'tv':
		case 'speaker':
			return media(d, a, s, v);
		case 'mode': {
			const on = a.on === true;
			v.icon = 'mode';
			v.tone = on ? 'on' : 'off';
			v.stateLine = on ? 'On' : 'Off';
			v.control = switchFor(s, 'on', on);
			return v;
		}
		case 'timer': {
			const state = typeof a.state === 'string' ? a.state : 'idle';
			// Counted from when it started, so a card keeps time between events.
			const left = remaining(a, now) ?? num(a.remaining_secs) ?? 0;
			const running = state === 'running';
			v.icon = 'timer';
			v.tone = running ? 'on' : 'off';
			v.stateLine =
				state === 'running'
					? `Running · ${clock(left)} left`
					: state === 'paused'
						? `Paused · ${clock(left)} left`
						: words(state);
			// homeCore's own timers take commands rather than declaring actions.
			if (d.plugin_id === 'core.glue') {
				// Its own length (`default_secs`, core 0.1.84); `duration_secs` is
				// the current run's, which a rule may have made longer.
				v.control = {
					kind: 'timer',
					running,
					durationSecs: num(a.default_secs) ?? num(a.duration_secs) ?? 300
				};
			}
			return v;
		}
		case 'contact_sensor':
		case 'door':
		case 'window':
		case 'garage':
		case 'gate': {
			const attr = 'open' in a ? 'open' : 'contact_open' in a ? 'contact_open' : 'contact';
			// A `contact` reading is true when the contact is made — closed.
			const open = attr === 'contact' ? a.contact === false : a[attr] === true;
			v.icon = open ? 'door-open' : 'door';
			v.tone = open ? 'on' : 'off';
			v.stateLine = open ? `Open${forHowLong(d, attr, now)}` : 'Closed';
			return v;
		}
		case 'water_sensor': {
			const wet = a.water_detected === true;
			v.icon = 'water';
			v.stateLine = wet ? 'Wet' : 'Dry';
			v.tone = wet ? 'alert' : 'off';
			return v;
		}
		case 'motion_sensor':
		case 'occupancy_sensor': {
			const attr = ['motion', 'occupied', 'occupancy'].find((k) => k in a);
			const active = attr !== undefined && a[attr] === true;
			const said = attr !== undefined ? s.attributes[attr]?.states : undefined;
			v.icon = 'motion';
			v.tone = active ? 'on' : 'off';
			const word = cap(
				active ? (said?.when_true.label ?? 'Motion') : (said?.when_false.label ?? 'Clear')
			);
			v.stateLine =
				active || attr === undefined ? word : `${word}${forHowLong(d, attr, now, ' for ')}`;
			return v;
		}
		case 'temperature_sensor':
		case 'weather_station': {
			v.icon = kind === 'weather_station' ? 'weather' : 'thermometer';
			const parts = [reading(a, s, 'temperature'), reading(a, s, 'humidity')].filter(
				(p): p is string => p !== undefined
			);
			v.stateLine = parts.join(' · ') || primaryLine(a, s);
			return v;
		}
		case 'rain_sensor':
		case 'lightning_sensor':
		case 'vibration_sensor': {
			v.icon =
				kind === 'rain_sensor' ? 'rain' : kind === 'lightning_sensor' ? 'lightning' : 'vibration';
			v.stateLine = primaryLine(a, s);
			return v;
		}
		case 'keypad':
		case 'vcrx':
		case 'pico_remote': {
			v.icon = kind === 'pico_remote' ? 'remote' : 'keypad';
			const last = buttonName(d, a);
			v.stateLine = last !== undefined ? `Last: ${last}` : 'No presses yet';
			return v;
		}
		case 'gateway':
		case 'bridge': {
			v.icon = 'router';
			const online = a.online !== false;
			v.stateLine = online ? 'Online' : 'Offline';
			v.tone = online ? 'off' : 'alert';
			return v;
		}
		default:
			return generic(d, a, s, v);
	}
}

function media(d: CoreDevice, a: Record<string, unknown>, s: Schema, v: CardView): CardView {
	const state = typeof a.state === 'string' ? a.state : undefined;
	const on = a.on !== false;
	const raw = str(a.media_title) ?? str(a.title) ?? str(a.track);
	// On a radio stream the "track" is the stream's own file, and its title
	// can be its address (`hls.m3u8?rj-ttl=5&…`). Never say that; the station
	// shows in its logo, and the line just says it's playing.
	const title = raw && !streamAddress(raw) ? raw : undefined;
	const app = str(a.app_name) ?? (a.source !== 'Home' ? str(a.source) : undefined);
	const isSpeaker = (d.plugin_id ?? '').includes('sonos') || d.ui_hint === 'speaker';
	v.icon = isSpeaker ? 'speaker' : 'tv';
	const playing = state === 'playing';
	v.tone = !on ? 'off' : playing ? 'on' : 'neutral';
	v.stateLine = !on
		? 'Off'
		: playing
			? `Playing${title ? ` — ${title}` : app ? ` — ${app}` : ''}`
			: state === 'paused'
				? `Paused${title ? ` — ${title}` : ''}`
				: app
					? `On · ${app}`
					: 'On';
	const ids = new Set((s.actions ?? []).map((x) => x.id));
	const toggle = ids.has('play_pause') ? 'play_pause' : playing ? 'pause' : 'play';
	if (on && ids.has(toggle)) v.control = { kind: 'play', playing, action: toggle };
	else if (!on && s.attributes.on?.writable) v.control = { kind: 'switch', attr: 'on', on: false };
	if (ids.has('previous') || ids.has('next')) {
		v.extras.push({
			kind: 'transport',
			previous: ids.has('previous') ? 'previous' : undefined,
			next: ids.has('next') ? 'next' : undefined
		});
	}
	pushSlider(v, s, a, 'volume', 'Volume');
	const art = str(a.art_url) ?? str(a.media_image_url);
	if (on && art) {
		v.art = artUrl(d.device_id, art);
		// A station has a logo and nothing else; a track has an artist or album.
		const credited = [a.artist, a.media_artist, a.album, a.media_album].some((x) => !!str(x));
		if (!credited) v.artLogo = true;
	}
	return v;
}

/** A "title" that is really a stream's address (as hc-web-flutter judged it too). */
export const streamAddress = (t: string) =>
	t.includes('://') || t.includes('.m3u8') || (t.includes('?') && t.includes('&')) || t.length > 60;

/** homeCore's artwork for a player, keyed by the track's own art address. */
export function artUrl(deviceId: string, published: string): string {
	let h = 5381;
	for (let i = 0; i < published.length; i++) h = ((h << 5) + h + published.charCodeAt(i)) | 0;
	return `/api/v1/devices/${encodeURIComponent(deviceId)}/media/art?t=${(h >>> 0).toString(36)}`;
}

/** 03 §4: a device of a kind nobody has tuned. */
function generic(d: CoreDevice, a: Record<string, unknown>, s: Schema, v: CardView): CardView {
	v.stateLine = primaryLine(a, s);
	if (s.attributes.on?.kind === 'bool' && s.attributes.on.writable) {
		const on = a.on === true;
		v.control = { kind: 'switch', attr: 'on', on };
		v.tone = on ? 'on' : 'off';
		v.icon = 'switch';
	} else {
		const simple = (s.actions ?? []).filter((x) => (x.params ?? []).length === 0);
		if ((s.actions ?? []).length === 1 && simple.length === 1) {
			const only = simple[0]!;
			v.control = { kind: 'button', label: only.label, action: only.id, confirm: only.confirm };
		}
	}
	// Large adds the next writable attribute of a simple kind.
	for (const name of ordered(s)) {
		if (name === 'on') continue;
		const attr = s.attributes[name];
		if (!attr?.writable) continue;
		if (
			(attr.kind === 'integer' || attr.kind === 'float') &&
			attr.min !== undefined &&
			attr.max !== undefined
		) {
			pushSlider(v, s, a, name, label(name, attr));
			break;
		}
		if (attr.kind === 'enum' && optionsOf(attr).length > 0) {
			v.extras.push({
				kind: 'steps',
				attr: name,
				label: label(name, attr),
				value: String(a[name] ?? ''),
				options: optionsOf(attr)
			});
			break;
		}
	}
	return v;
}

/**
 * Z-Wave multi-channel devices report `ep1_on`, `ep2_on`… — one card with a
 * switch per channel (C7). Labelled from the person's button names where set.
 */
function channelsOf(d: CoreDevice, s: Schema): Channel[] {
	return Object.keys(s.attributes)
		.map((name) => /^ep(\d+)_on$/.exec(name))
		.filter((m): m is RegExpExecArray => m !== null && s.attributes[m[0]]?.writable === true)
		.sort((x, y) => Number(x[1]) - Number(y[1]))
		.map((m) => ({
			attr: m[0],
			label: d.button_names?.[m[1]!] ?? `Channel ${m[1]}`,
			on: d.attributes[m[0]] === true
		}));
}

/**
 * Whether a device's battery is low, as homeCore says: its alerts apply its
 * threshold, its recovery band and what's been ignored. Set by the alerts
 * store; `undefined` from it (or no judge) means homeCore isn't saying, and
 * the reading is judged against homeCore's default line.
 */
let batteryJudge: ((deviceId: string) => boolean | undefined) | null = null;
export const judgeBatteriesBy = (judge: typeof batteryJudge) => (batteryJudge = judge);
/** homeCore's `[battery] threshold_pct` unless changed. */
const BATTERY_LINE = 20;

/** C9's built-in set; offline is added by `cardFor`. */
function alarmOf(d: CoreDevice, kind: string): string | undefined {
	const a = d.attributes;
	if (a.water_detected === true) return 'wet';
	if (a.smoke === true || a.smoke_detected === true) return 'smoke';
	if (kind === 'lock' && typeof a.last_alert === 'string' && /jam/i.test(a.last_alert))
		return 'jammed';
	const judged = batteryJudge?.(d.device_id);
	if (judged !== undefined) return judged ? 'low battery' : undefined;
	const battery = num(a.battery) ?? num(a.battery_pct);
	if (a.battery_low === true || (battery !== undefined && battery <= BATTERY_LINE))
		return 'low battery';
	return undefined;
}

/** "Turned on at the wall", "by Night rule", and "2 d ago" for a quiet sensor. */
function withNotes(line: string, d: CoreDevice, kind: string, now: number): string {
	const c = d.last_change;
	const at = c?.changed_at ? Date.parse(c.changed_at) : NaN;
	if (c && now - at < ELSEWHERE_MS && !SENSORS.has(kind)) {
		if (c.kind === 'physical') return `${line} · at the wall`;
		if (c.source === 'rule' && c.actor_name) return `${line} · by ${c.actor_name}`;
	}
	if (SENSORS.has(kind) && d.last_seen) {
		const quiet = now - Date.parse(d.last_seen);
		if (quiet > STALE_MS) return `${line} · ${ago(quiet)} ago`;
	}
	return line;
}

// ---- helpers ----

function switchFor(s: Schema, attr: string, on: boolean): Control | null {
	return s.attributes[attr]?.writable ? { kind: 'switch', attr, on } : null;
}

function pushSlider(
	v: CardView,
	s: Schema,
	a: Record<string, unknown>,
	attr: string,
	name: string
): void {
	const spec = s.attributes[attr];
	if (!spec?.writable) return;
	// In the person's units: a setpoint in °F, sent back in °C.
	const r = shownRange(
		{
			min: spec.min ?? 0,
			max: spec.max ?? 100,
			step: spec.step ?? (spec.kind === 'color_temp' ? 50 : 1)
		},
		spec.unit
	);
	const at = shown(0, spec.unit);
	const value = num(a[attr]);
	v.extras.push({
		kind: 'slider',
		attr,
		label: name,
		value: value === undefined ? r.min! : toShown(value, spec.unit),
		min: r.min!,
		max: r.max!,
		step: r.step!,
		unit: at.unit,
		...(at.converted ? { from: spec.unit } : {})
	});
}

function optionsOf(spec: AttributeSchema | undefined): string[] {
	return (spec?.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));
}

/** Attribute names, `primary` first, then the rest alphabetically. */
function ordered(s: Schema): string[] {
	const primary = s.primary ?? [];
	const rest = Object.keys(s.attributes)
		.filter((n) => !primary.includes(n))
		.sort();
	return [...primary.filter((n) => n in s.attributes), ...rest];
}

/** The device's leading readings, as words. */
function primaryLine(a: Record<string, unknown>, s: Schema): string {
	const names = ordered(s).filter((n) => {
		const spec = s.attributes[n];
		return (
			spec !== undefined &&
			spec.category === undefined &&
			spec.kind !== 'json' &&
			a[n] !== undefined &&
			a[n] !== null
		);
	});
	const parts = names
		.slice(0, 2)
		.map((n) => reading(a, s, n))
		.filter((p): p is string => p !== undefined);
	return parts.length > 0 ? parts.join(' · ') : '—';
}

/** One reading in words: its unit, or the device's own words for a boolean. */
export function reading(a: Record<string, unknown>, s: Schema, name: string): string | undefined {
	const value = a[name];
	if (value === undefined || value === null) return undefined;
	const spec = s.attributes[name];
	const moment = epochOf(name, value) ?? isoMoment(value);
	if (moment !== undefined) return momentText(moment);
	// A number or word the plugin names in its schema: WLED's effect 51.
	const named = spec?.options
		?.map((o) => (typeof o === 'string' ? { value: o, label: undefined } : o))
		.find((o) => o.value === String(value));
	if (named?.label) return named.label;
	if (typeof value === 'boolean') {
		const said = value ? spec?.states?.when_true.label : spec?.states?.when_false.label;
		return cap(said ?? (value ? words(name) : `Not ${words(name).toLowerCase()}`));
	}
	if (typeof value === 'number') {
		// In the person's units: °F or °C, inHg or hPa.
		const r = shown(value, spec?.unit ?? str(a[`${name}_unit`]));
		const n = numberText(r, fmt);
		if (name === 'temperature' || name.endsWith('_temperature') || isTemperature(r.unit))
			return `${n}°${unitLetter(r.unit)}`;
		if (r.unit === '%') return `${Math.round(r.value)}%`;
		return r.unit ? `${n} ${r.unit}` : n;
	}
	if (typeof value === 'string')
		// An address is said as it is, never capitalised or split into words.
		return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : cap(words(uncamel(value)));
	return undefined;
}

/** A moment as the app says one in a reading: "Oct 21, 1:20 PM". */
export const momentText = (ms: number): string => momentOf(ms);

/** An ISO 8601 time — "2026-10-21T17:20:56Z" — in ms; never anything else. */
export function isoMoment(value: unknown): number | undefined {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
	const t = Date.parse(value);
	return Number.isFinite(t) ? t : undefined;
}

/** A word run together the way some devices send them — "LockFailed" — as
 *  "Lock failed". Only words in that shape: "HDMI1" and "TV Input" stay. */
export function uncamel(s: string): string {
	return /^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(s)
		? s.replace(/(?<=[a-z])(?=[A-Z])/g, ' ').replace(/ [A-Z]/g, (m) => m.toLowerCase())
		: s;
}

/**
 * A moment sent as Unix seconds — Ecowitt's `last_strike: "1792109048"` —
 * in ms, so it reads as a time rather than a ten-digit number. Only for
 * attributes named like a time, so a big count is never taken for one.
 */
export function epochOf(name: string, value: unknown): number | undefined {
	if (!/(^last_|_at$|_time$|^time$|timestamp)/.test(name)) return undefined;
	const n =
		typeof value === 'number'
			? value
			: typeof value === 'string' && /^\d{9,11}$/.test(value)
				? Number(value)
				: NaN;
	return n >= 1e9 && n < 1e11 ? n * 1000 : undefined;
}

function unitLetter(unit: string | undefined): string {
	if (!unit) return '';
	const u = unit.replace('°', '').trim().toUpperCase();
	return u === 'C' || u === 'F' ? u : '';
}

function label(name: string, spec: AttributeSchema): string {
	return spec.display_name ?? cap(words(name));
}

function buttonName(d: CoreDevice, a: Record<string, unknown>): string | undefined {
	const number = num(a.last_button);
	if (number !== undefined && d.button_names?.[String(number)])
		return d.button_names[String(number)];
	return str(a.last_button_name) ?? (number !== undefined ? `Button ${number}` : undefined);
}

function forHowLong(d: CoreDevice, attr: string, now: number, joiner = ' · '): string {
	const at = d.attributes_changed_at?.[attr];
	if (at === undefined) return '';
	const ms = now - Date.parse(at);
	return Number.isFinite(ms) && ms >= 60_000 ? `${joiner}${ago(ms)}` : '';
}

function since(at: string | undefined, now: number): string {
	if (at === undefined) return '';
	const ms = now - Date.parse(at);
	return Number.isFinite(ms) && ms >= 60_000 ? ` · ${ago(ms)}` : '';
}

/** 40 min, 3 h, 2 d. */
export function ago(ms: number): string {
	const min = Math.floor(ms / 60_000);
	if (min < 60) return `${Math.max(1, min)} min`;
	const h = Math.floor(min / 60);
	if (h < 48) return `${h} h`;
	return `${Math.floor(h / 24)} d`;
}

function clock(secs: number): string {
	const s = Math.max(0, Math.round(secs));
	const m = Math.floor(s / 60);
	return m >= 60
		? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
		: `${m}:${String(s % 60).padStart(2, '0')}`;
}

function num(v: unknown): number | undefined {
	return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
	return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function fmt(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function words(s: string): string {
	return s.replace(/[_-]+/g, ' ').trim();
}

export function cap(s: string): string {
	return s === '' ? s : s[0]!.toUpperCase() + s.slice(1);
}
