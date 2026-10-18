/**
 * A rule in words (A2, doc 09 §3): "When **Bathroom Door** closes, only if
 * it's between 06:00 and 12:00 → set the volume of **Bathroom** to 15".
 *
 * A rule names everything by id; this says it with the house's names, and
 * with each device's own words from its schema — a door "opens", a leak
 * sensor "detects water", a speaker's action reads "set the volume of
 * {device} to {volume}". Anything a rule names that the house doesn't have
 * is marked, because homeCore will still report the step as done.
 *
 * Every trigger, condition and action homeCore has (its vocabulary, 18 · 13 ·
 * 34) is phrased; a kind added later reads as its name and fields rather than
 * disappearing.
 */
import { cap, words } from './card.js';
import { displayName, type AttributeSchema, type CoreDevice, type ParamSpec } from './devices.js';

/** One piece of a phrase: plain words, a device by name, or text as written. */
export interface Bit {
	t: string;
	/** The device this names — for a link, and so search finds it. */
	device?: string;
	/** Names something the house doesn't have. */
	missing?: boolean;
	/** A script, a topic, an expression: shown as written. */
	code?: boolean;
}
export type Phrase = Bit[];

/** What the phrasing needs from the house. */
export interface House {
	device(id: string): CoreDevice | undefined;
	scene?(id: string): string | undefined;
	rule?(id: string): string | undefined;
}

/** A rule as homeCore sends it — only what the app reads. */
export interface Rule {
	id: string;
	name: string;
	enabled: boolean;
	priority?: number;
	tags?: string[];
	trigger: Json;
	/** More moments, any of which starts it (E2). */
	triggers?: Json[];
	conditions?: Json[];
	actions?: { enabled?: boolean; action: Json }[];
	error?: string;
	cooldown_secs?: number;
	run_mode?: Json;
	required_expression?: string;
	trigger_condition?: string;
	trigger_label?: string;
	variables?: Record<string, unknown>;
	log_events?: boolean;
	log_triggers?: boolean;
	log_actions?: boolean;
	cancel_on_false?: boolean;
}

// serde's external tagging: `{"Kind": {fields}}`, or `"Kind"` for one without fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** A tagged value's kind and fields. */
export function tagOf(v: Json): [string, Record<string, Json>] {
	if (typeof v === 'string') return [v, {}];
	if (v === null || typeof v !== 'object') return ['', {}];
	const kind = Object.keys(v)[0] ?? '';
	const body = v[kind];
	return [kind, body !== null && typeof body === 'object' ? body : {}];
}

// ---- building phrases ----

const t = (s: string): Bit => ({ t: s });
const code = (s: string): Bit => ({ t: s, code: true });

/** "A", "A and B", "A, B and C" — of phrases. */
function list(items: Phrase[], last = 'and'): Phrase {
	const out: Phrase = [];
	items.forEach((p, i) => {
		if (i > 0) out.push(t(i === items.length - 1 ? ` ${last} ` : ', '));
		out.push(...p);
	});
	return out;
}

/** The phrase as plain text, for search and for a title attribute. */
export const plain = (p: Phrase) => p.map((b) => b.t).join('');

/** A device by its name, or marked when the house has no such device. */
export function deviceBit(h: House, id: string): Bit {
	if (id.startsWith('DELETED:')) return { t: 'a deleted device', device: id, missing: true };
	const d = h.device(id);
	return d ? { t: displayName(d), device: d.device_id } : { t: id, device: id, missing: true };
}

function devicesPhrase(h: House, ids: string[], last = 'and'): Phrase {
	return list(
		ids.map((id) => [deviceBit(h, id)]),
		last
	);
}

function specOf(h: House, id: string, attr: string): AttributeSchema | undefined {
	return h.device(id)?.schema?.attributes?.[attr];
}

/** An attribute's name mid-sentence: "humidity", "colour temperature". */
function attrName(spec: AttributeSchema | undefined, attr: string): string {
	const s = spec?.display_name ?? words(attr);
	// Keep "LED", "UV"; lower "Humidity".
	return /^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s;
}

function fmtNum(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** A value as the device would say it: "open", "On", "35 %", "“Piano”". */
export function valueText(spec: AttributeSchema | undefined, v: Json): string {
	if (typeof v === 'boolean') {
		const said = v ? spec?.states?.when_true.label : spec?.states?.when_false.label;
		return said ?? (v ? 'on' : 'off');
	}
	if (typeof v === 'number') return `${fmtNum(v)}${spec?.unit ? ` ${spec.unit}` : ''}`;
	if (typeof v === 'string') {
		const opt = spec?.options?.find((o) => (typeof o === 'string' ? o : o.value) === v);
		if (opt !== undefined && typeof opt !== 'string' && opt.label) return opt.label;
		if (spec?.kind === 'enum' || opt !== undefined) return words(v);
		return /^[a-z_]+$/.test(v) && v.length < 24 ? words(v) : `“${v}”`;
	}
	if (v === null || v === undefined) return 'nothing';
	return JSON.stringify(v);
}

/** 90 → "1 min 30 s", 300 → "5 min", 5400 → "1 h 30 min". */
export function duration(secs: number): string {
	const s = Math.max(0, Math.round(secs));
	if (s < 60) return `${s} s`;
	if (s < 3600) return s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`;
	const h = Math.floor(s / 3600);
	const m = Math.round((s % 3600) / 60);
	if (h >= 48 && s % 86400 === 0) return `${s / 86400} days`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "06:00:00" → "06:00". */
const hhmm = (s: unknown) => (typeof s === 'string' ? s.replace(/^(\d\d:\d\d):00$/, '$1') : '');

const ms = (n: unknown) => (typeof n === 'number' ? duration(n / 1000) : '');

// ---- a device's state: as a moment, as a check, as a command ----

const PRESS: Record<string, string> = {
	press: 'is pressed',
	pressed: 'is pressed',
	pushed: 'is pressed',
	push: 'is pressed',
	release: 'is released',
	released: 'is released',
	hold: 'is held',
	held: 'is held',
	long_press: 'is held',
	double: 'is double-pressed',
	double_press: 'is double-pressed',
	double_tap: 'is double-pressed',
	double_tapped: 'is double-pressed'
};

const TIMER_BECOMES: Record<string, string> = {
	finished: 'finishes',
	running: 'starts',
	paused: 'is paused',
	idle: 'stops',
	cancelled: 'is cancelled'
};

/** Whether `attr` is what the device is mostly about, so needn't be named. */
function isMain(h: House, id: string, attr: string): boolean {
	const d = h.device(id);
	if (attr === 'on' || attr === 'state') return true;
	const primary = d?.schema?.primary ?? [];
	return primary[0] === attr;
}

/** "opens", "turns off", "button 1 is pressed", "humidity becomes 35 %". */
function becomes(h: House, ids: string[], f: Record<string, Json>): Phrase {
	const many = ids.length > 1;
	const who: Phrase = many ? [t('any of '), ...devicesPhrase(h, ids, 'or')] : devicesPhrase(h, ids);
	const attr: string | undefined = f.attribute;
	if (attr === undefined) return [...who, t(' changes')];
	const spec = specOf(h, ids[0]!, attr);
	const { to, from } = f;
	const named = isMain(h, ids[0]!, attr) ? '' : ` ${attrName(spec, attr)}`;
	let what: string;
	if (to !== undefined && to !== null) {
		if (typeof to === 'boolean' && spec?.states) {
			const s = to ? spec.states.when_true : spec.states.when_false;
			what = s.verb ? ` ${s.verb}` : `${named} becomes ${s.label}`;
		} else if (typeof to === 'boolean' && attr === 'on') what = to ? ' turns on' : ' turns off';
		else if (typeof to === 'string' && PRESS[to.toLowerCase()])
			what = `${named} ${PRESS[to.toLowerCase()]!}`;
		else if (typeof to === 'string' && attr === 'state' && TIMER_BECOMES[to])
			what = ` ${TIMER_BECOMES[to]!}`;
		else what = `${named || ` ${attrName(spec, attr)}`} becomes ${valueText(spec, to)}`;
		if (from !== undefined && from !== null) what += ` (from ${valueText(spec, from)})`;
	} else if (from !== undefined && from !== null)
		what = `${named || ` ${attrName(spec, attr)}`} stops being ${valueText(spec, from)}`;
	else if (f.not_to !== undefined && f.not_to !== null)
		what = `${named || ` ${attrName(spec, attr)}`} changes to anything but ${valueText(spec, f.not_to)}`;
	else if (f.not_from !== undefined && f.not_from !== null)
		what = `${named || ` ${attrName(spec, attr)}`} changes from ${valueText(spec, f.not_from)}`;
	else what = `${named} changes`;
	const out: Phrase = [...who, t(what)];
	if (typeof f.for_duration_secs === 'number' && f.for_duration_secs > 0)
		out.push(t(` and stays so for ${duration(f.for_duration_secs)}`));
	const by = BY[f.change_kind as string];
	if (by) out.push(t(` ${by}`));
	if (typeof f.change_source === 'string') out.push(t(` (by ${words(f.change_source)})`));
	return out;
}

const BY: Record<string, string> = {
	physical: 'by hand',
	external: 'outside homeCore',
	homecore: 'by homeCore'
};

const OP_IS: Record<string, string> = {
	Eq: 'is',
	Ne: 'is not',
	Gt: 'is above',
	Gte: 'is at least',
	Lt: 'is below',
	Lte: 'is at most'
};

/** "is open", "humidity is below 35 %", "is running" — `are` for several. */
function isNow(h: House, ids: string[], attr: string, op: string, value: Json): Phrase {
	const spec = specOf(h, ids[0]!, attr);
	const many = ids.length > 1;
	const be = (s: string) => (many ? s.replace(/^is/, 'are') : s);
	const who = devicesPhrase(h, ids);
	if (
		(op === 'Eq' || op === 'Ne') &&
		typeof value === 'boolean' &&
		(spec?.states || attr === 'on')
	) {
		const v = op === 'Eq' ? value : !value;
		return [...who, t(` ${be('is')} ${valueText(spec, v)}`)];
	}
	const named = isMain(h, ids[0]!, attr) ? '' : ` ${attrName(spec, attr)}`;
	return [...who, t(`${named} ${be(OP_IS[op] ?? `is ${op}`)} ${valueText(spec, value)}`)];
}

/** Fill a schema action's sentence: "set the volume of {device} to {volume}". */
function sentenceOf(
	template: string,
	who: Phrase,
	params: ParamSpec[],
	values: Record<string, Json>
): Phrase {
	const out: Phrase = [];
	for (const [i, part] of template.split(/\{(\w+)\}/).entries()) {
		if (i % 2 === 0) {
			if (part) out.push(t(part));
		} else if (part === 'device') out.push(...who);
		else {
			const p = params.find((x) => x.name === part);
			out.push(t(paramText(p, values[part])));
		}
	}
	return out;
}

function paramText(p: ParamSpec | undefined, v: Json): string {
	if (v === undefined) return '…';
	const opt = p?.options?.find((o) => String(o.value) === String(v));
	if (opt?.label) return opt.label;
	if (typeof v === 'number')
		return `${fmtNum(v)}${p?.unit && p.unit !== '%' ? ` ${p.unit}` : p?.unit === '%' ? ' %' : ''}`;
	if (typeof v === 'string') return p?.kind === 'enum' ? words(v) : `“${v}”`;
	return JSON.stringify(v);
}

const COMMAND: Record<string, string> = {
	start: 'start',
	cancel: 'cancel',
	pause: 'pause',
	resume: 'resume',
	restart: 'restart',
	reset: 'reset',
	increment: 'add one to',
	decrement: 'take one from',
	toggle: 'toggle',
	trigger: 'trigger',
	press: 'press',
	select: 'set',
	set: 'set',
	clear: 'clear',
	next: 'move on',
	previous: 'move back'
};

/** A command in words: "turn A, B and C on", "start Exhaust for 5 min". */
export function setPhrase(h: House, ids: string[], state: Json): Phrase {
	const first = ids[0]!;
	const who = devicesPhrase(h, ids);
	if (state === null || typeof state !== 'object' || Array.isArray(state))
		return [t('set '), ...who, t(' to '), code(JSON.stringify(state))];
	const d = h.device(first);
	const actions = d?.schema?.actions ?? [];
	const keys = Object.keys(state);

	// A declared action, flat (`{action: "set_volume", volume: 15}`) or keyed (`{set_led: {…}}`).
	let id: string | undefined;
	let values: Record<string, Json> = {};
	if (typeof state.action === 'string') {
		id = state.action;
		values = Object.fromEntries(Object.entries(state).filter(([k]) => k !== 'action'));
	} else if (keys.length === 1 && actions.some((a) => a.id === keys[0])) {
		id = keys[0];
		const v = state[keys[0]!];
		values = v !== null && typeof v === 'object' ? v : {};
	}
	if (id !== undefined) {
		const a = actions.find((x) => x.id === id);
		const sentence = (a as { sentence?: string } | undefined)?.sentence;
		if (a && sentence) return sentenceOf(sentence, who, a.params ?? [], values);
		const label = a?.label ? a.label.toLowerCase() : words(id);
		const extras = Object.entries(values).map(([k, v]) =>
			paramText(
				a?.params?.find((p) => p.name === k),
				v
			)
		);
		return [t(`${label}${extras.length ? ` ${extras.join(', ')}` : ''} on `), ...who];
	}

	if (typeof state.command === 'string') {
		const verb = COMMAND[state.command] ?? words(state.command);
		const out: Phrase = [t(`${verb} `), ...who];
		const secs = state.duration_secs ?? state.duration;
		if (typeof secs === 'number') out.push(t(` for ${duration(secs)}`));
		if (state.value !== undefined) out.push(t(` to ${valueText(undefined, state.value)}`));
		if (typeof state.option === 'string') out.push(t(` to ${state.option}`));
		if (state.command === 'next' || state.command === 'previous')
			return [t(`move `), ...who, t(` to its ${state.command} choice`)];
		return out;
	}
	if (state.activate === true && keys.length === 1) return [t('run '), ...who];

	const rest = keys.filter((k) => k !== 'on');
	const settings = rest.map(
		(k) => `${attrName(specOf(h, first, k), k)} ${valueText(specOf(h, first, k), state[k])}`
	);
	if (typeof state.on === 'boolean') {
		const out: Phrase = [t('turn '), ...who, t(state.on ? ' on' : ' off')];
		if (settings.length) out.push(t(`, ${settings.join(', ')}`));
		return out;
	}
	return [t('set '), ...who, t(settings.length ? `: ${settings.join(', ')}` : ' as it was')];
}

// ---- Rhai, where it's simple enough to read ----

const RHAI_OP: Record<string, string> = {
	'==': 'Eq',
	'!=': 'Ne',
	'>': 'Gt',
	'>=': 'Gte',
	'<': 'Lt',
	'<=': 'Lte'
};

/**
 * `device_state("id")["open"] == true && …` as a check, or undefined for
 * anything else — which is then shown as written.
 */
export function readScript(h: House, script: string): Phrase | undefined {
	const s = script.trim();
	for (const [sep, word] of [
		['||', 'or'],
		['&&', 'and']
	] as const) {
		if (s.includes(sep)) {
			const parts = s.split(sep).map((x) => readScript(h, x));
			if (parts.some((p) => p === undefined)) return undefined;
			return list(parts as Phrase[], word);
		}
	}
	const m =
		/^device_state\(\s*"([^"]+)"\s*\)\s*\[\s*"([^"]+)"\s*\]\s*(==|!=|>=|<=|>|<)\s*(true|false|-?\d+(?:\.\d+)?|"[^"]*")$/.exec(
			s
		);
	if (!m) return undefined;
	const [, id, attr, op, lit] = m;
	const value: Json =
		lit === 'true'
			? true
			: lit === 'false'
				? false
				: lit!.startsWith('"')
					? lit!.slice(1, -1)
					: Number(lit);
	return isNow(h, [id!], attr!, RHAI_OP[op!]!, value);
}

/** What an if/otherwise asks: a check (E3), or a script read where it's simple. */
const check = (h: House, c: Json): Phrase =>
	c !== null && typeof c === 'object'
		? checkPhrase(h, c)
		: (readScript(h, String(c)) ?? [code(String(c))]);

// ---- triggers ----

const SUN: Record<string, string> = {
	Sunrise: 'sunrise',
	Sunset: 'sunset',
	SolarNoon: 'solar noon',
	CivilDawn: 'dawn',
	CivilDusk: 'dusk'
};
const BUTTON: Record<string, string> = {
	Pushed: 'is pressed',
	Held: 'is held',
	DoubleTapped: 'is double-pressed',
	Released: 'is released'
};
const THRESHOLD: Record<string, string> = {
	Above: 'is above',
	Below: 'is below',
	CrossesAbove: 'rises above',
	CrossesBelow: 'falls below'
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function daysText(days: string[]): string {
	const set = new Set(days.map((d) => d.slice(0, 3)));
	if (set.size === 0 || set.size === 7) return 'every day';
	if (set.size === 5 && DAYS.slice(0, 5).every((d) => set.has(d))) return 'on weekdays';
	if (set.size === 2 && set.has('Sat') && set.has('Sun')) return 'at weekends';
	return `on ${DAYS.filter((d) => set.has(d)).join(', ')}`;
}

function offsetText(min: number, of: string): string {
	if (!min) return `at ${of}`;
	return `${duration(Math.abs(min) * 60)} ${min < 0 ? 'before' : 'after'} ${of}`;
}

/** The moment a rule starts: "Bathroom Door closes", "at sunset". */
export function whenPhrase(h: House, trigger: Json): Phrase {
	const [kind, f] = tagOf(trigger);
	switch (kind) {
		case 'DeviceStateChanged': {
			const ids = [...new Set([f.device_id, ...(f.device_ids ?? [])].filter(Boolean) as string[])];
			return becomes(h, ids, f);
		}
		case 'ButtonEvent':
			return [
				deviceBit(h, f.device_id),
				t(
					`${f.button_number ? ` button ${f.button_number}` : ' a button'} ${BUTTON[f.event] ?? words(String(f.event))}`
				)
			];
		case 'NumericThreshold': {
			const spec = specOf(h, f.device_id, f.attribute);
			const out: Phrase = [
				deviceBit(h, f.device_id),
				t(
					` ${attrName(spec, f.attribute)} ${THRESHOLD[f.op] ?? words(String(f.op))} ${valueText(spec, f.value)}`
				)
			];
			if (f.for_duration_secs) out.push(t(` for ${duration(f.for_duration_secs)}`));
			return out;
		}
		case 'DeviceAvailabilityChanged': {
			const what =
				f.to === false
					? ' goes offline'
					: f.to === true
						? ' comes back online'
						: ' goes offline or comes back';
			const out: Phrase = [deviceBit(h, f.device_id), t(what)];
			if (f.for_duration_secs) out.push(t(` for ${duration(f.for_duration_secs)}`));
			return out;
		}
		case 'DeviceBatteryLow':
			return f.device_id
				? [deviceBit(h, f.device_id), t('’s battery runs low')]
				: [t('any device’s battery runs low')];
		case 'DeviceBatteryRecovered':
			return f.device_id
				? [deviceBit(h, f.device_id), t('’s battery is no longer low')]
				: [t('any device’s battery is no longer low')];
		case 'SunEvent':
			return [t(offsetText(f.offset_minutes ?? 0, SUN[f.event] ?? words(String(f.event))))];
		case 'TimeOfDay':
			return [t(`at ${hhmm(f.time)} ${daysText(f.days ?? [])}`)];
		case 'Cron':
			return [t('on the schedule '), code(String(f.expression))];
		case 'Periodic': {
			const unit = String(f.unit ?? '')
				.toLowerCase()
				.replace(/s$/, '');
			return [t(f.every_n === 1 ? `every ${unit}` : `every ${f.every_n} ${unit}s`)];
		}
		case 'SystemStarted':
			return [t('homeCore starts')];
		case 'ManualTrigger':
			return [t('someone runs it')];
		case 'ModeChanged':
			if (!f.mode_id) return [t('any mode changes')];
			return [
				deviceBit(h, f.mode_id),
				t(f.to === true ? ' turns on' : f.to === false ? ' turns off' : ' turns on or off')
			];
		case 'CustomEvent':
			return [t('the event '), code(String(f.event_type)), t(' happens')];
		case 'HubVariableChanged':
			return f.name
				? [t('the house value '), code(String(f.name)), t(' changes')]
				: [t('any house value changes')];
		case 'MqttMessage': {
			const out: Phrase = [t('a message arrives on '), code(String(f.topic_pattern))];
			if (f.payload) out.push(t(' saying '), code(String(f.payload)));
			if (f.value_path)
				out.push(
					t(' with '),
					code(`${f.value_path} ${f.value_op ?? ''} ${JSON.stringify(f.value_cmp ?? '')}`.trim())
				);
			return out;
		}
		case 'WebhookReceived':
			return [
				t('the web address '),
				code(`/webhooks/${String(f.path).replace(/^\//, '')}`),
				t(' is called')
			];
		case 'CalendarEvent': {
			const what = f.title_contains
				? `a calendar event titled “${f.title_contains}”`
				: 'a calendar event';
			const min = f.offset_minutes ?? 0;
			return [
				t(
					min
						? `${duration(Math.abs(min) * 60)} ${min < 0 ? 'before' : 'after'} ${what} starts`
						: `${what} starts`
				)
			];
		}
		default:
			return unknown(kind, f);
	}
}

/** A kind this app doesn't know yet: its name and fields, not nothing. */
function unknown(kind: string, f: Record<string, Json>): Phrase {
	return [
		t(cap(words(kind.replace(/([a-z])([A-Z])/g, '$1 $2')).toLowerCase())),
		...(Object.keys(f).length ? [t(' '), code(JSON.stringify(f))] : [])
	];
}

// ---- conditions ----

/** A check at that moment: "Night is on", "between 06:00 and 12:00". */
export function checkPhrase(h: House, c: Json): Phrase {
	const [kind, f] = tagOf(c);
	switch (kind) {
		case 'DeviceState':
			return isNow(h, [f.device_id], f.attribute, f.op, f.value);
		case 'ModeIs':
			return isNow(h, [f.mode_id], 'on', 'Eq', f.on === true);
		case 'TimeWindow':
			return [t(`it’s between ${hhmm(f.start)} and ${hhmm(f.end)}`)];
		case 'TimeElapsed': {
			const spec = specOf(h, f.device_id, f.attribute);
			return [
				deviceBit(h, f.device_id),
				t(
					`${isMain(h, f.device_id, f.attribute) ? '' : ` ${attrName(spec, f.attribute)}`} hasn’t changed for ${duration(f.duration_secs)}`
				)
			];
		}
		case 'DeviceLastChange': {
			const out: Phrase = [deviceBit(h, f.device_id), t(' was last changed')];
			if (f.kind && BY[f.kind]) out.push(t(` ${BY[f.kind]}`));
			if (f.source) out.push(t(` by ${words(f.source)}`));
			if (f.actor_name) out.push(t(` by ${f.actor_name}`));
			return out;
		}
		case 'And':
			return [
				t('all of: '),
				...list(
					(f.conditions ?? []).map((x: Json) => checkPhrase(h, x)),
					'and'
				)
			];
		case 'Or':
			return [
				t('any of: '),
				...list(
					(f.conditions ?? []).map((x: Json) => checkPhrase(h, x)),
					'or'
				)
			];
		case 'Xor':
			return [
				t('exactly one of: '),
				...list(
					(f.conditions ?? []).map((x: Json) => checkPhrase(h, x)),
					'or'
				)
			];
		case 'Not':
			return [t('not ('), ...checkPhrase(h, f.condition), t(')')];
		case 'ScriptExpression':
			return check(h, String(f.script));
		case 'HubVariable':
			return [
				t('the house value '),
				code(String(f.name)),
				t(` ${OP_IS[f.op] ?? f.op} ${valueText(undefined, f.value)}`)
			];
		case 'PrivateBooleanIs':
			return [t('its flag '), code(String(f.name)), t(f.value ? ' is set' : ' is not set')];
		case 'CalendarActive':
			return [
				t(
					f.title_contains
						? `a calendar event titled “${f.title_contains}” is on`
						: 'a calendar event is on'
				)
			];
		default:
			return unknown(kind, f);
	}
}

// ---- actions ----

/** A step and, for if / at the same time / repeat, the steps inside it. */
export interface Step {
	words: Phrase;
	kind: string;
	/** Turned off within the rule (top-level steps only). */
	off?: boolean;
	branches?: { label: string; steps: Step[] }[];
}

const modeName = (h: House, mode: string) =>
	deviceBit(h, mode.startsWith('mode_') ? mode : `mode_${mode}`);

/** One step in words, with what's inside it. */
export function stepOf(h: House, a: Json): Step {
	const [kind, f] = tagOf(a);
	const steps = (xs: Json[] | undefined) => (xs ?? []).map((x) => stepOf(h, x));
	const s = (words: Phrase, branches?: Step['branches']): Step => ({ words, kind, branches });
	switch (kind) {
		case 'SetDeviceState': {
			const p = setPhrase(h, [f.device_id], f.state);
			if (f.track_event_value) p.push(t(' (with the value that started it)'));
			return s(p);
		}
		case 'FadeDevice':
			return s([
				t('fade '),
				deviceBit(h, f.device_id),
				t(
					` to ${typeof f.target === 'object' ? JSON.stringify(f.target) : valueText(undefined, f.target)} over ${duration(f.duration_secs)}`
				)
			]);
		case 'SetDeviceStatePerMode':
			return s(
				[t('set '), deviceBit(h, f.device_id), t(' by mode')],
				[
					...(f.modes ?? []).map((m: Json) => ({
						label: `in ${plain([modeName(h, m.mode)])}`,
						steps: [{ kind: 'SetDeviceState', words: setPhrase(h, [f.device_id], m.state) }]
					})),
					...(f.default_state !== undefined && f.default_state !== null
						? [
								{
									label: 'otherwise',
									steps: [
										{ kind: 'SetDeviceState', words: setPhrase(h, [f.device_id], f.default_state) }
									]
								}
							]
						: [])
				]
			);
		case 'Notify': {
			const out: Phrase = [
				t('send '),
				t(`“${f.title ? `${f.title}: ` : ''}${f.message}”`),
				t(` to ${f.channel === 'all' ? 'every channel' : f.channel}`)
			];
			return s(out);
		}
		case 'Delay':
			return s([t(`wait ${duration(f.duration_secs)}`)]);
		case 'DelayPerMode':
			return s(
				[t('wait, by mode: ')],
				[
					...(f.modes ?? []).map((m: Json) => ({
						label: `in ${plain([modeName(h, m.mode)])}`,
						steps: [{ kind: 'Delay', words: [t(`wait ${duration(m.duration_secs)}`)] }]
					})),
					...(f.default_secs
						? [
								{
									label: 'otherwise',
									steps: [{ kind: 'Delay', words: [t(`wait ${duration(f.default_secs)}`)] }]
								}
							]
						: [])
				]
			);
		case 'Parallel':
			return s([t('at the same time')], [{ label: '', steps: steps(f.actions) }]);
		case 'Conditional':
			return s(
				[t('if '), ...check(h, f.condition)],
				[
					{ label: 'then', steps: steps(f.then_actions) },
					...(f.else_if ?? []).map((b: Json) => ({
						label: `or if ${plain(check(h, b.condition))}`,
						steps: steps(b.actions)
					})),
					...((f.else_actions ?? []).length
						? [{ label: 'otherwise', steps: steps(f.else_actions) }]
						: [])
				]
			);
		case 'RepeatCount':
			return s(
				[t(`${f.count} times${f.interval_ms ? `, ${ms(f.interval_ms)} apart` : ''}`)],
				[{ label: '', steps: steps(f.actions) }]
			);
		case 'RepeatUntil':
		case 'RepeatWhile':
			return s(
				[
					t(kind === 'RepeatUntil' ? 'repeat until ' : 'repeat while '),
					...check(h, String(f.condition)),
					t(f.max_iterations ? ` (at most ${f.max_iterations} times)` : '')
				],
				[{ label: '', steps: steps(f.actions) }]
			);
		case 'PingHost':
			return s(
				[t('if '), code(String(f.host)), t(' answers a ping')],
				[
					{ label: 'then', steps: steps(f.then_actions) },
					...((f.else_actions ?? []).length
						? [{ label: 'otherwise', steps: steps(f.else_actions) }]
						: [])
				]
			);
		case 'WaitForEvent': {
			const out: Phrase = [t('wait for ')];
			if (f.device_id)
				out.push(
					deviceBit(h, f.device_id),
					t(
						f.attribute
							? ` ${attrName(specOf(h, f.device_id, f.attribute), f.attribute)} to change`
							: ' to change'
					)
				);
			else if (f.event_type) out.push(t('the event '), code(String(f.event_type)));
			else out.push(t('any event'));
			if (f.timeout_ms) out.push(t(`, at most ${ms(f.timeout_ms)}`));
			return s(out);
		}
		case 'WaitForExpression':
			return s([
				t('wait until '),
				...check(h, String(f.expression)),
				t(f.hold_duration_ms ? ` for ${ms(f.hold_duration_ms)}` : ''),
				t(f.timeout_ms ? `, at most ${ms(f.timeout_ms)}` : '')
			]);
		case 'SetMode':
			return s([
				t(f.command === 'Toggle' ? 'switch ' : 'turn '),
				deviceBit(h, f.mode_id),
				t(f.command === 'On' ? ' on' : f.command === 'Off' ? ' off' : ' over')
			]);
		case 'ActivateScenePerMode':
			if ((f.modes ?? []).length === 0 && f.default_scene_id)
				return s([t('run '), sceneBit(h, f.default_scene_id)]);
			return s(
				[t('run a scene by mode')],
				[
					...(f.modes ?? []).map((m: Json) => ({
						label: `in ${plain([modeName(h, m.mode)])}`,
						steps: [{ kind: 'Scene', words: [t('run '), sceneBit(h, m.scene_id)] }]
					})),
					...(f.default_scene_id
						? [
								{
									label: 'otherwise',
									steps: [{ kind: 'Scene', words: [t('run '), sceneBit(h, f.default_scene_id)] }]
								}
							]
						: [])
				]
			);
		case 'CaptureDeviceState':
			return s([
				t('remember how '),
				...devicesPhrase(h, f.device_ids ?? []),
				t(` ${(f.device_ids ?? []).length > 1 ? 'are' : 'is'} set, as `),
				code(String(f.key))
			]);
		case 'RestoreDeviceState':
			return s([t('put back what was remembered as '), code(String(f.key))]);
		case 'RunRuleActions':
			return s([t('do the steps of '), ruleBit(h, f.rule_id)]);
		case 'PauseRule':
			return s([t('pause '), ruleBit(h, f.rule_id)]);
		case 'ResumeRule':
			return s([t('resume '), ruleBit(h, f.rule_id)]);
		case 'CancelDelays':
			return s([
				t(f.key ? 'cancel the waits called ' : 'cancel this rule’s waits'),
				...(f.key ? [code(String(f.key))] : [])
			]);
		case 'CancelRuleTimers':
			return s(
				f.rule_id
					? [t('cancel the timers of '), ruleBit(h, f.rule_id)]
					: [t('cancel this rule’s timers')]
			);
		case 'SetVariable':
		case 'SetHubVariable':
			return s([
				t(kind === 'SetHubVariable' ? 'set the house value ' : 'set its value '),
				code(String(f.name)),
				t(` ${opText(f.op)} ${valueText(undefined, f.value)}`)
			]);
		case 'SetPrivateBoolean':
			return s([t(f.value ? 'set its flag ' : 'clear its flag '), code(String(f.name))]);
		case 'FireEvent':
			return s([t('announce the event '), code(String(f.event_type))]);
		case 'PublishMqtt':
			return s([t('publish '), code(String(f.payload)), t(' to '), code(String(f.topic))]);
		case 'CallService':
			return s([t(`call ${String(f.method).toUpperCase()} `), code(String(f.url))]);
		case 'RunScript':
			return s([t('run the script '), code(String(f.script))]);
		case 'LogMessage':
			return s([t('write to the log: '), t(`“${f.message}”`)]);
		case 'Comment':
			return s([t(`note: ${f.text}`)]);
		case 'StopRuleChain':
			return s([t('stop lower-priority rules from running')]);
		case 'ExitRule':
			return s([t('stop here')]);
		default:
			return s(unknown(kind, f));
	}
}

function opText(op: Json): string {
	return op === 'Add'
		? '+'
		: op === 'Subtract'
			? '−'
			: op === 'Multiply'
				? '×'
				: op === 'Divide'
					? '÷'
					: op === 'Toggle'
						? 'toggled from'
						: 'to';
}

function sceneBit(h: House, id: string): Bit {
	const name = h.scene?.(id);
	return name ? { t: name } : { t: 'a scene that no longer exists', missing: true };
}

function ruleBit(h: House, id: string): Bit {
	const name = h.rule?.(id);
	return name ? { t: `“${name}”` } : { t: 'a rule that no longer exists', missing: true };
}

// ---- the whole rule ----

export interface Reading {
	/** The first moment; `whens` has them all. */
	when: Phrase;
	whens: Phrase[];
	checks: Phrase[];
	steps: Step[];
	/** Advanced options the rule uses (E7), in words. */
	more: string[];
}

export function readRule(h: House, r: Rule): Reading {
	return {
		when: whenPhrase(h, r.trigger),
		whens: [r.trigger, ...(r.triggers ?? [])].map((x) => whenPhrase(h, x)),
		checks: (r.conditions ?? []).map((c) => checkPhrase(h, c)),
		steps: (r.actions ?? []).map((a) => ({ ...stepOf(h, a.action), off: a.enabled === false })),
		more: moreOf(r)
	};
}

/** What under More (E7) the rule uses. */
export function moreOf(r: Rule): string[] {
	const out: string[] = [];
	const [mode, f] = tagOf(r.run_mode);
	if (mode === 'Single') out.push('Skips a run while one is going');
	else if (mode === 'Restart') out.push('Starts over if it runs again');
	else if (mode === 'Queued') out.push(`Queues up to ${f.max_queue ?? 10} runs`);
	if (r.cooldown_secs) out.push(`Rests ${duration(r.cooldown_secs)} after running`);
	if (r.required_expression)
		out.push(
			`Only while ${r.required_expression}${r.cancel_on_false ? ', stopping when it stops being so' : ''}`
		);
	if (r.trigger_condition) out.push(`Only when ${r.trigger_condition}`);
	if (r.variables && Object.keys(r.variables).length)
		out.push(`Has its own values: ${Object.keys(r.variables).join(', ')}`);
	if (r.log_events || r.log_triggers || r.log_actions) out.push('Writes what it does to the log');
	return out;
}

/**
 * The whole rule as one line, for the list: consecutive like steps and
 * checks are said once — "turn A, B and C on", "A, B and C are off".
 */
export function sentence(h: House, r: Rule): Phrase {
	const out: Phrase = [...opening(whenPhrase(h, r.trigger))];
	for (const more of r.triggers ?? []) out.push(t(', or '), ...lowerWhen(whenPhrase(h, more)));
	const checks = merged(r.conditions ?? [], h, 'check');
	if (checks.length) out.push(t(', only if '), ...list(checks));
	const steps = merged(
		(r.actions ?? []).filter((a) => a.enabled !== false).map((a) => a.action),
		h,
		'step'
	);
	out.push(t(' → '), ...(steps.length ? list(steps) : [t('nothing')]));
	return out;
}

/** The phrase as the start of a line: "Bathroom Door opens", "At sunset". */
export function capitalised(p: Phrase): Phrase {
	const first = p[0];
	if (!first || first.device || first.code) return p;
	return [{ ...first, t: cap(first.t) }, ...p.slice(1)];
}

/** A further moment after "or": "when the door opens", "at sunset". */
function lowerWhen(when: Phrase): Phrase {
	const first = when[0];
	if (first && !first.device && /^(at |every |on the |\d)/.test(first.t)) return when;
	return [t('when '), ...when];
}

/** "When the door opens", but "At sunset", "Every 5 minutes". */
export function opening(when: Phrase): Phrase {
	const first = when[0];
	if (first && !first.device && /^(at |every |on the |\d)/.test(first.t))
		return [{ ...first, t: cap(first.t) }, ...when.slice(1)];
	return [t('When '), ...when];
}

/** Steps or checks, with runs of the same thing to several devices said once. */
function merged(items: Json[], h: House, as: 'check' | 'step'): Phrase[] {
	const out: Phrase[] = [];
	let i = 0;
	while (i < items.length) {
		const [kind, f] = tagOf(items[i]);
		const same = (x: Json) => {
			const [k, g] = tagOf(x);
			if (k !== kind) return false;
			if (k === 'SetDeviceState')
				return !g.track_event_value && JSON.stringify(g.state) === JSON.stringify(f.state);
			if (k === 'DeviceState')
				return (
					g.attribute === f.attribute &&
					g.op === f.op &&
					JSON.stringify(g.value) === JSON.stringify(f.value)
				);
			return false;
		};
		let j = i + 1;
		if (kind === 'SetDeviceState' || kind === 'DeviceState')
			while (j < items.length && same(items[j])) j++;
		const ids = items.slice(i, j).map((x) => tagOf(x)[1].device_id as string);
		if (j - i > 1 && kind === 'SetDeviceState') out.push(setPhrase(h, ids, f.state));
		else if (j - i > 1) out.push(isNow(h, ids, f.attribute, f.op, f.value));
		else if (as === 'check') out.push(checkPhrase(h, items[i]));
		else out.push(inline(stepOf(h, items[i])));
		i = j;
	}
	return out;
}

/** A step with what's inside it, on one line: "if X: a, b; otherwise c". */
export const stepLine = (h: House, action: Json): Phrase => inline(stepOf(h, action));

function inline(s: Step): Phrase {
	if (!s.branches) return s.words;
	const out: Phrase = [...s.words];
	s.branches.forEach((b, i) => {
		if (b.steps.length === 0) return;
		const inner = list(b.steps.map(inline));
		if (b.label === 'then' || b.label === '') out.push(t(': '), ...inner);
		else out.push(t(i > 0 ? `; ${b.label}: ` : ` ${b.label}: `), ...inner);
	});
	return out;
}

// ---- what a rule names ----

export interface Ref {
	id: string;
	missing: boolean;
}

/**
 * Every device, helper and mode a rule names — in its trigger, its checks,
 * its steps and the scripts inside them — and whether the house has it.
 * homeCore's own stale-reference check misses step targets (doc 09 §1).
 */
export function refsOf(h: House, r: Rule): Ref[] {
	const ids = new Set<string>();
	const walk = (v: Json, key = '') => {
		if (typeof v === 'string') {
			if (key === 'device_id' || key === 'mode_id' || key === 'device_ids') ids.add(v);
			else if (key === 'mode' && v) ids.add(v.startsWith('mode_') ? v : `mode_${v}`);
			for (const m of v.matchAll(/device_state\(\s*"([^"]+)"/g)) ids.add(m[1]!);
			return;
		}
		if (Array.isArray(v)) v.forEach((x) => walk(x, key));
		else if (v !== null && typeof v === 'object')
			for (const [k, x] of Object.entries(v)) walk(x, k);
	};
	walk({ trigger: r.trigger, triggers: r.triggers, conditions: r.conditions, actions: r.actions });
	return [...ids].map((id) => ({
		id,
		missing: id.startsWith('DELETED:') || h.device(id) === undefined
	}));
}
