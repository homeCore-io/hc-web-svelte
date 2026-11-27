/**
 * Devices over MQTT (homeCore 0.1.126): the ecosystem profiles that take in
 * Tasmota, Shelly, Zigbee2MQTT and other devices with no plugin, and what the
 * app says about them. homeCore keeps the profiles; these are its calls and
 * the words for what it answers.
 */

export interface ProfileStatus {
	file: string;
	name: string | null;
	description: string | null;
	prefix: string | null;
	/** homeCore ships a profile of this name (this is a copy of it). */
	shipped: boolean;
	/** Why it didn't load, with the line. */
	error: string | null;
	devices?: number;
	untyped?: number;
	last_heard?: string | null;
}

export interface HeardTopic {
	topic: string;
	count: number;
	first_at: string;
	last_at: string;
	last_payload: string;
	/** A shipped profile, not on, that would take it in. */
	looks_like: string | null;
}

export interface Overview {
	folder: string | null;
	catalog: { present: boolean; types: number; error: string | null };
	profiles: ProfileStatus[];
	untyped: number;
	shipped_off: { file: string; name: string; description: string | null }[];
	off: OffProfile[];
	heard: HeardTopic[];
}

export interface ProfileDevice {
	device_id: string;
	name: string;
	device_type: string | null;
	/** What the profile says it is, by its ID. */
	configured: { device_type: string | null; name: string | null } | null;
	/** What its ecosystem says it is. */
	suggestion: string | null;
	/** The name its ecosystem gives it, when it gives one. */
	suggested_name?: string | null;
	available: boolean;
	last_seen: string;
	readings: Record<string, unknown>;
}

export interface DeviceType {
	name: string;
	description: string | null;
	attributes: { name: string; writable: boolean }[];
}

export interface DeviceChange {
	device_id: string;
	device_type?: string | null;
	name?: string | null;
}

export type Answer<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<Answer<T>> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		return { ok: false, error: 'homeCore is not answering.' };
	}
	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		// An answer with no body.
	}
	if (res.ok) return { ok: true, data: data as T };
	if (res.status === 401 || res.status === 403)
		return { ok: false, error: "You aren't allowed to do this." };
	if (res.status === 404 && path === '/mqtt')
		return { ok: false, error: 'This homeCore is older than 0.1.126, which brings this page.' };
	const said = (data as { error?: unknown } | null)?.error;
	return {
		ok: false,
		error: typeof said === 'string' ? said : `homeCore said no (${res.status}).`
	};
}

const one = (name: string) => `/mqtt/profiles/${encodeURIComponent(name)}`;

export const loadOverview = () => call<Overview>('GET', '/mqtt');
export const loadProfile = (name: string) =>
	call<{ profile: ProfileStatus; devices: ProfileDevice[] }>('GET', one(name));
export const loadTypes = () => call<{ types: DeviceType[] }>('GET', '/mqtt/device-types');
export const addCatalog = () => call<{ added: boolean }>('POST', '/mqtt/catalog');
export const setDevices = (name: string, changes: DeviceChange[]) =>
	call<{ ok: boolean }>('PATCH', `${one(name)}/devices`, { changes });

// ---- words ----

/** The shipped profiles' names, as people know them. */
const ECOSYSTEMS: Record<string, string> = {
	tasmota: 'Tasmota',
	zigbee2mqtt: 'Zigbee2MQTT',
	'shelly-gen1': 'Shelly (original firmware)',
	'shelly-gen2': 'Shelly Plus, Pro and Mini'
};

/** What to call a profile: its ecosystem's name, or its own. */
export const ecosystemName = (name: string) => ECOSYSTEMS[name] ?? name;

/** `dimmer_light` → "Dimmer light". */
export function typeLabel(name: string): string {
	const words = name.replace(/_/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** What a writable attribute lets someone do, in words. */
const CONTROLS: [RegExp, string][] = [
	[/^on$/, 'on and off'],
	[/^brightness(_pct)?$/, 'brightness'],
	[/^color_temp$/, 'warmth'],
	[/^colou?r(_xy|_rgb|_hex|_hs)?$/, 'color'],
	[/^(position|open)$/, 'open and close'],
	[/^tilt(_pct)?$/, 'tilt'],
	[/^locked$/, 'lock and unlock'],
	[/^(heat_setpoint|cool_setpoint|setpoint|target_temperature)$/, 'temperature'],
	[/^hvac_mode$/, 'mode'],
	[/^fan_mode$/, 'fan'],
	[/^volume$/, 'volume'],
	[/^muted$/, 'mute']
];

const joinWords = (xs: string[]) =>
	xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What a type gives a device in the app: the controls its writable
 * attributes become ("On and off, brightness and warmth"), else what it
 * reports ("Reports occupied and battery").
 */
export function givesOf(t: DeviceType): string {
	const controls: string[] = [];
	for (const a of t.attributes.filter((x) => x.writable)) {
		const hit = CONTROLS.find(([re]) => re.test(a.name));
		const words = hit ? hit[1] : a.name.replace(/_pct$/, '').replace(/_/g, ' ');
		if (!controls.includes(words)) controls.push(words);
	}
	if (controls.length > 0) return cap(joinWords(controls));
	const reads = t.attributes.map((a) => a.name.replace(/_pct$/, '').replace(/_/g, ' '));
	return reads.length > 0 ? `Reports ${joinWords(reads.slice(0, 4))}` : (t.description ?? '');
}

/** A device's readings, short: "on: true · brightness_pct: 54". */
export function readingsLine(r: Record<string, unknown>, max = 4): string {
	return Object.entries(r)
		.filter(([, v]) => v !== null && typeof v !== 'object')
		.slice(0, max)
		.map(([k, v]) => `${k}: ${String(v)}`)
		.join(' · ');
}

/** The devices whose type hasn't been said, and which the ecosystem suggests. */
export function untypedOf(devices: ProfileDevice[]) {
	const untyped = devices.filter((d) => !d.device_type);
	return { untyped, suggested: untyped.filter((d) => d.suggestion) };
}

/**
 * The changes that give each suggested device its suggestion, keeping a
 * name the profile already gives it.
 */
export const suggestionChanges = (devices: ProfileDevice[]): DeviceChange[] =>
	untypedOf(devices).suggested.map((d) => ({
		device_id: d.device_id,
		device_type: d.suggestion,
		name: d.configured?.name ?? d.suggested_name ?? null
	}));

/** The broker's topic, shown by what it is: "Shelly (original firmware)" or nothing. */
export const looksLike = (h: HeardTopic) => (h.looks_like ? ecosystemName(h.looks_like) : null);

/** Types a device's readings point to, likeliest first, for choosing one. */
const HINTS: [string, string[]][] = [
	['brightness_pct', ['light', 'dimmer_light']],
	['color_temp', ['light']],
	['position', ['cover']],
	['locked', ['lock']],
	['heat_setpoint', ['climate']],
	['hvac_mode', ['climate']],
	['power_w', ['power_monitor']],
	['occupied', ['motion_sensor', 'occupancy_sensor']],
	['open', ['contact_sensor']],
	['water_detected', ['water_sensor']],
	['smoke', ['smoke_sensor']],
	['temperature', ['temperature_sensor']],
	['illuminance', ['illuminance_sensor']],
	['on', ['switch']]
];

export function likelyTypes(readings: Record<string, unknown>, known: string[]): string[] {
	const out: string[] = [];
	for (const [attr, types] of HINTS)
		if (attr in readings)
			for (const t of types) if (known.includes(t) && !out.includes(t)) out.push(t);
	return out.slice(0, 3);
}

// ---- round 2: on and off, the editor, trying, logins ----

export interface OffProfile {
	file: string;
	name: string | null;
	description: string | null;
}

export interface PreviewDevice {
	device_id: string;
	device_type: string | null;
	name: string | null;
}

export type TryResult =
	| {
			kind: 'state';
			device_id: string;
			state: Record<string, unknown>;
			partial: boolean;
			device_type: string | null;
			name: string | null;
	  }
	| { kind: 'availability'; device_id: string; available: boolean }
	| { kind: 'no_match' }
	| { kind: 'error'; error: string };

export interface DeviceLogin {
	user: string;
	profile: string;
	label: string;
	created: string;
	last_login: string | null;
}

export const turnOn = (file: string) => call<{ ok: boolean }>('POST', '/mqtt/on', { file });
export const turnOff = (file: string) => call<{ ok: boolean }>('POST', '/mqtt/off', { file });
export const loadPreview = (file: string) =>
	call<{ devices: PreviewDevice[] }>('GET', `/mqtt/preview?file=${encodeURIComponent(file)}`);
export const loadFile = (file: string) =>
	call<{ file: string; text: string; on: boolean; status: ProfileStatus | null }>(
		'GET',
		`/mqtt/files/${encodeURIComponent(file)}`
	);
export const saveFile = (file: string, text: string) =>
	call<{ ok: boolean }>('PUT', `/mqtt/files/${encodeURIComponent(file)}`, { text });
export const deleteFile = (file: string) =>
	call<{ ok: boolean }>('DELETE', `/mqtt/files/${encodeURIComponent(file)}`);
export const tryMessage = (text: string, topic: string, payload: string) =>
	call<TryResult>('POST', '/mqtt/try', { text, topic, payload });
export const loadLogins = (profile: string) =>
	call<{ broker_asks: boolean | null; logins: DeviceLogin[] }>(
		'GET',
		`/mqtt/logins?profile=${encodeURIComponent(profile)}`
	);
export const addLogin = (profile: string, user: string, label: string) =>
	call<{ user: string; password: string }>('POST', '/mqtt/logins', { profile, user, label });
export const resetLogin = (user: string) =>
	call<{ password: string }>('POST', `/mqtt/logins/${encodeURIComponent(user)}/password`);
export const removeLogin = (user: string) =>
	call<{ ok: boolean }>('DELETE', `/mqtt/logins/${encodeURIComponent(user)}`);

/** A plain word for files and IDs: "My Firmware!" → "my-firmware". */
export const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/**
 * A topic pattern guessed from one heard topic: the part that names the
 * device is usually the second level (`esphome/garage-door/sensor/state`),
 * so that becomes `{device}`; a topic of one level is taken as it is.
 */
export function guessPattern(topic: string): string {
	const parts = topic.split('/');
	if (parts.length < 2) return topic;
	parts[1] = '{device}';
	return parts.join('/');
}

/** The device a pattern makes of a topic, or null when it doesn't match. */
export function deviceOf(pattern: string, topic: string): string | null {
	const p = pattern.split('/');
	const t = topic.split('/');
	if (p.length !== t.length) return null;
	let device: string | null = null;
	for (let i = 0; i < p.length; i++) {
		if (p[i] === '{device}') device = t[i]!;
		else if (!/^\{.+\}$/.test(p[i]!) && p[i] !== t[i]) return null;
	}
	return device;
}

const tomlString = (s: string) => JSON.stringify(s);

/** A new profile's text: commented, ready to edit and save. */
export function draftProfile(d: {
	name: string;
	prefix: string;
	pattern: string;
	payload?: string;
}): string {
	const json = (() => {
		try {
			const v = JSON.parse(d.payload ?? '');
			return v !== null && typeof v === 'object' && !Array.isArray(v);
		} catch {
			return false;
		}
	})();
	const lines = [
		`# ${d.name}: devices homeCore takes in from MQTT.`,
		'# Settings › Devices over MQTT edits this file; so can you.',
		'',
		'[ecosystem]',
		`name   = ${tomlString(d.name)}`,
		`prefix = ${tomlString(d.prefix)}`,
		'',
		'[[ecosystem.state_topics]]',
		`pattern = ${tomlString(d.pattern)}`
	];
	if (!json) {
		lines.push(
			'# The message is one value; name the reading it is.',
			'attribute     = "state"',
			'coerce_scalar = true'
		);
	}
	lines.push(
		'# What the devices on this topic are, for their controls in the app:',
		'# device_type = "switch"',
		'',
		'# Commands back to the device, when it takes them:',
		'# [[ecosystem.cmd_topics]]',
		`# source    = "homecore/devices/${d.prefix}{device}/cmd"`,
		`# target    = ${tomlString(d.pattern.replace(/[^/]+$/, 'set'))}`,
		'# attribute = "on"',
		''
	);
	return lines.join('\n');
}

export const reloadFolder = () => call<{ ok: boolean }>('POST', '/mqtt/reload');

/** The ecosystem a device comes in through, if one does. */
export const loadDeviceEcosystem = (id: string) =>
	call<{ profile: string; file: string | null }>('GET', `/mqtt/devices/${encodeURIComponent(id)}`);
