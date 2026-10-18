/**
 * Writing a rule (A3, doc 09 §3): what a device offers to a rule, in its own
 * words — the moments it has ("opens", "button 1 is pressed"), what can be
 * checked about it ("is open"), what it can be told ("set the volume of
 * {device} to {volume}") — and the kinds of When, Only if and Do the editor
 * offers by name, with the rest of homeCore's vocabulary reachable as fields.
 *
 * The editor edits the rule's own JSON: a part is replaced only when someone
 * changes it, so anything the editor can't draw survives a save untouched
 * (D13). Everything here is pure: a value in, a value out.
 */
import { cap, words } from './card.js';
import { displayName, type AttributeSchema, type CoreDevice, type ParamSpec } from './devices.js';
import { tagOf, type Rule } from './ruleWords.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// ---- what this homeCore can do (its vocabulary) ----

export interface FieldSpec {
	name: string;
	type: string;
	required: boolean;
}
export interface VariantSpec {
	tag: string;
	fields: FieldSpec[];
}
export interface Vocabulary {
	triggers: VariantSpec[];
	conditions: VariantSpec[];
	actions: VariantSpec[];
	/** `triggers`, `if_checks`, `rule_events`, `test_draft` — absent before A3's homeCore. */
	features?: string[];
}

export interface Features {
	/** Several moments per rule (E2). */
	triggers: boolean;
	/** If/otherwise asks a check, not only a script (E3). */
	ifChecks: boolean;
	/** A draft can be dry-run before it's saved (E6). */
	testDraft: boolean;
	/** homeCore says when a rule changes. */
	ruleEvents: boolean;
}

export function featuresOf(v: Vocabulary | null | undefined): Features {
	const f = new Set(v?.features ?? []);
	return {
		triggers: f.has('triggers'),
		ifChecks: f.has('if_checks'),
		testDraft: f.has('test_draft'),
		ruleEvents: f.has('rule_events')
	};
}

// ---- fields a part is edited with ----

export interface Choice {
	value: string;
	label: string;
}

export type Field =
	| {
			kind: 'number';
			name: string;
			label: string;
			unit?: string;
			min?: number;
			max?: number;
			step?: number;
			optional?: boolean;
	  }
	| {
			kind: 'text';
			name: string;
			label: string;
			long?: boolean;
			optional?: boolean;
			suggest?: string[];
	  }
	| {
			kind: 'choice';
			name: string;
			label: string;
			options: Choice[];
			numeric?: boolean;
			/** "—" leaves it out: homeCore's default. */
			optional?: boolean;
	  }
	/** One value of any type, typed plainly: words, 42, true. Objects stay JSON. */
	| { kind: 'value'; name: string; label: string; optional?: boolean }
	| { kind: 'bool'; name: string; label: string }
	| { kind: 'duration'; name: string; label: string; optional?: boolean }
	| { kind: 'time'; name: string; label: string }
	| { kind: 'days'; name: string; label: string }
	| { kind: 'device'; name: string; label: string; optional?: boolean }
	| { kind: 'devices'; name: string; label: string }
	/** Steps inside a step: repeat, ping's two outcomes. */
	| { kind: 'steps'; name: string; label: string }
	/** Checks inside a check: all of, exactly one of. */
	| { kind: 'checks'; name: string; label: string }
	/** One check inside a check: not. */
	| { kind: 'check'; name: string; label: string }
	| { kind: 'json'; name: string; label: string; optional?: boolean };

// ---- a device's attributes, as a rule sees them ----

interface Attr {
	name: string;
	spec: AttributeSchema;
	label: string;
}

function attrsOf(d: CoreDevice): Attr[] {
	const a = d.schema?.attributes ?? {};
	const primary = d.schema?.primary ?? [];
	const rank = (n: string) => (primary.includes(n) ? primary.indexOf(n) : n === 'on' ? -1 : 50);
	return Object.entries(a)
		.filter(([, s]) => s.category !== 'diagnostic')
		.map(([name, spec]) => ({ name, spec, label: lower(spec.display_name ?? words(name)) }))
		.sort((x, y) => rank(x.name) - rank(y.name) || x.label.localeCompare(y.label));
}

function lower(s: string): string {
	return /^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s;
}

const isNum = (s: AttributeSchema) =>
	s.kind === 'integer' || s.kind === 'float' || s.kind === 'color_temp';
const isButton = (name: string) => /^button_?\d+$/.test(name);
const optionsOf = (s: AttributeSchema): Choice[] =>
	(s.options ?? []).map((o) =>
		typeof o === 'string'
			? { value: o, label: words(o) }
			: { value: o.value, label: o.label ?? words(o.value) }
	);

const TIMER_SAY: Record<string, string> = {
	finished: 'finishes',
	running: 'starts',
	paused: 'is paused',
	idle: 'stops',
	cancelled: 'is cancelled'
};

const PRESSES: [string, string][] = [
	['press', 'is pressed'],
	['release', 'is released'],
	['hold', 'is held'],
	['double', 'is double-pressed']
];

// ---- When: a device's moments ----

/** A moment a device has, as a rule's When. */
export interface Moment {
	key: string;
	label: string;
	/** It can be "and stays so for…". */
	lasting?: boolean;
	/** It needs a number: "rises above 30 %". */
	number?: { label: string; unit?: string };
	build(ids: string[], v: { for?: number; value?: number }): Json;
}

const key = (v: unknown) => JSON.stringify(v);

/** Every moment a device offers, in its own words; the first is the likeliest. */
export function momentsOf(d: CoreDevice): Moment[] {
	const out: Moment[] = [];
	const dsc = (ids: string[], attribute: string | undefined, to: unknown, f?: number): Json => ({
		DeviceStateChanged: {
			device_id: ids[0] ?? '',
			...(ids.length > 1 ? { device_ids: ids.slice(1) } : {}),
			...(attribute !== undefined ? { attribute } : {}),
			...(to !== undefined ? { to } : {}),
			...(f ? { for_duration_secs: f } : {})
		}
	});
	for (const a of attrsOf(d)) {
		const s = a.spec;
		if (s.kind === 'bool') {
			for (const v of [true, false]) {
				const said = v ? s.states?.when_true : s.states?.when_false;
				const label =
					said?.verb ??
					(a.name === 'on'
						? v
							? 'turns on'
							: 'turns off'
						: `${a.label} becomes ${said?.label ?? (v ? 'yes' : 'no')}`);
				out.push({
					key: `to:${a.name}:${key(v)}`,
					label,
					lasting: true,
					build: (ids, f) => dsc(ids, a.name, v, f.for)
				});
			}
		} else if (s.kind === 'enum' && s.options?.length) {
			for (const o of optionsOf(s)) {
				const label =
					a.name === 'state' && TIMER_SAY[o.value]
						? TIMER_SAY[o.value]!
						: `${a.label} becomes ${o.label.toLowerCase()}`;
				out.push({
					key: `to:${a.name}:${key(o.value)}`,
					label,
					lasting: true,
					build: (ids, f) => dsc(ids, a.name, o.value, f.for)
				});
			}
		} else if (s.kind === 'string' && isButton(a.name)) {
			for (const [v, said] of PRESSES)
				out.push({
					key: `to:${a.name}:${key(v)}`,
					label: `${a.label} ${said}`,
					build: (ids) => dsc(ids, a.name, v)
				});
		} else if (isNum(s)) {
			for (const [op, said] of [
				['CrossesAbove', 'rises above'],
				['CrossesBelow', 'falls below']
			] as const)
				out.push({
					key: `${op}:${a.name}`,
					label: `${a.label} ${said}…`,
					number: { label: `${cap(a.label)} ${said}`, unit: s.unit },
					build: (ids, f) => ({
						NumericThreshold: {
							device_id: ids[0] ?? '',
							attribute: a.name,
							op,
							value: f.value ?? 0,
							...(f.for ? { for_duration_secs: f.for } : {})
						}
					})
				});
		}
		if (s.kind !== 'json' && !(s.kind === 'string' && isButton(a.name)))
			out.push({
				key: `changes:${a.name}`,
				label: `${a.label} changes`,
				build: (ids) => dsc(ids, a.name, undefined)
			});
	}
	out.push({
		key: 'changes',
		label: 'changes at all',
		build: (ids) => dsc(ids, undefined, undefined)
	});
	out.push(
		{
			key: 'offline',
			label: 'goes offline',
			lasting: true,
			build: (ids, f) => ({
				DeviceAvailabilityChanged: {
					device_id: ids[0] ?? '',
					to: false,
					...(f.for ? { for_duration_secs: f.for } : {})
				}
			})
		},
		{
			key: 'online',
			label: 'comes back online',
			build: (ids) => ({ DeviceAvailabilityChanged: { device_id: ids[0] ?? '', to: true } })
		}
	);
	return out;
}

/** Which of a device's moments a trigger is, and the values it carries. */
export function momentOf(
	trigger: Json
): { key: string; ids: string[]; for?: number; value?: number } | undefined {
	const [kind, f] = tagOf(trigger);
	if (kind === 'DeviceStateChanged') {
		if (f.from !== undefined || f.not_to !== undefined || f.not_from !== undefined)
			return undefined;
		const ids = [f.device_id, ...(f.device_ids ?? [])].filter(
			(x: unknown) => typeof x === 'string'
		);
		const k =
			f.attribute === undefined
				? 'changes'
				: f.to === undefined
					? `changes:${f.attribute}`
					: `to:${f.attribute}:${key(f.to)}`;
		return { key: k, ids, for: f.for_duration_secs };
	}
	if (kind === 'NumericThreshold' && (f.op === 'CrossesAbove' || f.op === 'CrossesBelow'))
		return {
			key: `${f.op}:${f.attribute}`,
			ids: [f.device_id],
			for: f.for_duration_secs,
			value: f.value
		};
	if (kind === 'DeviceAvailabilityChanged' && typeof f.to === 'boolean')
		return { key: f.to ? 'online' : 'offline', ids: [f.device_id], for: f.for_duration_secs };
	return undefined;
}

/**
 * Keep what the editor doesn't draw (`change_kind`, `change_source`) when a
 * moment is rebuilt.
 */
export function keepExtras(before: Json, after: Json): Json {
	const [k1, f1] = tagOf(before);
	const [k2, f2] = tagOf(after);
	if (k1 !== k2 || k1 !== 'DeviceStateChanged') return after;
	const extra = Object.fromEntries(
		Object.entries(f1).filter(([n]) => n === 'change_kind' || n === 'change_source')
	);
	return { [k2]: { ...f2, ...extra } };
}

// ---- Only if: what can be checked about a device ----

export interface State {
	key: string;
	label: string;
	number?: { label: string; unit?: string };
	build(id: string, v: { value?: number }): Json;
}

const OPS: [string, string][] = [
	['Gt', 'is above'],
	['Lt', 'is below'],
	['Gte', 'is at least'],
	['Lte', 'is at most']
];

/** What can be checked about a device, in its own words. */
export function statesOf(d: CoreDevice): State[] {
	const out: State[] = [];
	const mode = d.plugin_id === 'core.mode' || d.device_id.startsWith('mode_');
	for (const a of attrsOf(d)) {
		const s = a.spec;
		if (s.kind === 'bool') {
			for (const v of [true, false]) {
				const said = v ? s.states?.when_true?.label : s.states?.when_false?.label;
				const label = `is ${said ?? (a.name === 'on' ? (v ? 'on' : 'off') : `${a.label}: ${v ? 'yes' : 'no'}`)}`;
				out.push({
					key: `is:${a.name}:${key(v)}`,
					label,
					build: (id) =>
						mode && a.name === 'on'
							? { ModeIs: { mode_id: id, on: v } }
							: { DeviceState: { device_id: id, attribute: a.name, op: 'Eq', value: v } }
				});
			}
		} else if (s.kind === 'enum' && s.options?.length) {
			for (const o of optionsOf(s))
				out.push({
					key: `is:${a.name}:${key(o.value)}`,
					label:
						a.name === 'state'
							? `is ${o.label.toLowerCase()}`
							: `${a.label} is ${o.label.toLowerCase()}`,
					build: (id) => ({
						DeviceState: { device_id: id, attribute: a.name, op: 'Eq', value: o.value }
					})
				});
		} else if (isNum(s)) {
			for (const [op, said] of OPS)
				out.push({
					key: `${op}:${a.name}`,
					label: `${a.label} ${said}…`,
					number: { label: `${cap(a.label)} ${said}`, unit: s.unit },
					build: (id, v) => ({
						DeviceState: { device_id: id, attribute: a.name, op, value: v.value ?? 0 }
					})
				});
		}
	}
	return out;
}

/** Which of a device's states a condition is, and its number. */
export function stateOf(c: Json): { key: string; id: string; value?: number } | undefined {
	const [kind, f] = tagOf(c);
	if (kind === 'ModeIs') return { key: `is:on:${key(f.on)}`, id: f.mode_id };
	if (kind !== 'DeviceState') return undefined;
	if (f.op === 'Eq' && (typeof f.value === 'boolean' || typeof f.value === 'string'))
		return { key: `is:${f.attribute}:${key(f.value)}`, id: f.device_id };
	if (typeof f.value === 'number' && f.op !== 'Eq' && f.op !== 'Ne')
		return { key: `${f.op}:${f.attribute}`, id: f.device_id, value: f.value };
	return undefined;
}

// ---- Do: what a device can be told ----

export interface Command {
	key: string;
	label: string;
	fields: Field[];
	build(v: Record<string, unknown>): Json;
	/** The values a state for this command carries, or undefined if it isn't this command. */
	read(state: Json): Record<string, unknown> | undefined;
}

/** A schema action's parameter as a field. */
export function paramField(p: ParamSpec, d: CoreDevice): Field {
	const label = p.label ?? cap(words(p.name));
	const from = p.options_from?.attribute;
	if (from) {
		const list = d.attributes[from.attribute];
		if (Array.isArray(list)) {
			const options = list
				.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
				.map((x) => ({
					value: String(x[from.value_key ?? 'value']),
					label: String(x[from.label_key ?? 'label'] ?? x[from.value_key ?? 'value'])
				}));
			if (options.length)
				return {
					kind: 'choice',
					name: p.name,
					label,
					options,
					numeric: p.kind === 'int' || p.kind === 'float'
				};
		}
	}
	if (p.options?.length)
		return {
			kind: 'choice',
			name: p.name,
			label,
			options: p.options.map((o) => ({
				value: String(o.value),
				label: o.label ?? words(String(o.value))
			}))
		};
	if (p.kind === 'int' || p.kind === 'float' || p.kind === 'number' || p.kind === 'integer')
		return { kind: 'number', name: p.name, label, unit: p.unit, min: p.min, max: p.max };
	if (p.kind === 'duration') return { kind: 'duration', name: p.name, label };
	if (p.kind === 'bool') return { kind: 'bool', name: p.name, label };
	return { kind: 'text', name: p.name, label, optional: !p.required };
}

const plainState = (state: Json) =>
	state !== null && typeof state === 'object' && !Array.isArray(state);

/** Everything a device can be told, in its own words. */
export function commandsOf(d: CoreDevice): Command[] {
	const out: Command[] = [];
	const attrs = attrsOf(d).filter((a) => a.spec.writable);
	const helper = d.plugin_id === 'core.glue';
	const type = d.device_type ?? '';

	if (attrs.some((a) => a.name === 'on' && a.spec.kind === 'bool'))
		for (const v of [true, false])
			out.push({
				key: `on:${v}`,
				label: v ? 'turn on' : 'turn off',
				fields: [],
				build: () => ({ on: v }),
				read: (s) => (plainState(s) && Object.keys(s).length === 1 && s.on === v ? {} : undefined)
			});

	// Helpers take commands their schema doesn't declare (glue/timer_manager.rs).
	if (helper && type === 'timer') {
		out.push({
			key: 'cmd:start',
			label: 'start',
			fields: [{ kind: 'duration', name: 'duration_secs', label: 'For' }],
			build: (v) => ({ command: 'start', duration_secs: Number(v.duration_secs ?? 300) }),
			read: (s) =>
				plainState(s) && s.command === 'start'
					? { duration_secs: s.duration_secs ?? 300 }
					: undefined
		});
		for (const c of ['cancel', 'pause', 'resume', 'restart'])
			out.push({
				key: `cmd:${c}`,
				label: c,
				fields: [],
				build: () => ({ command: c }),
				read: (s) => (plainState(s) && s.command === c ? {} : undefined)
			});
	}
	if (helper && (type === 'counter' || type === 'number')) {
		// Only a counter resets (glue/counter.rs); a number drops it (glue/number.rs).
		const cmds = [
			['increment', 'add one to'],
			['decrement', 'take one from'],
			...(type === 'counter' ? [['reset', 'reset'] as const] : [])
		] as const;
		for (const [c, label] of cmds)
			out.push({
				key: `cmd:${c}`,
				label,
				fields: [],
				build: () => ({ command: c }),
				read: (s) => (plainState(s) && s.command === c ? {} : undefined)
			});
		out.push({
			key: 'cmd:set',
			label: 'set to',
			fields: [{ kind: 'number', name: 'value', label: 'Value' }],
			build: (v) => ({ command: 'set', value: Number(v.value ?? 0) }),
			read: (s) => (plainState(s) && s.command === 'set' ? { value: s.value } : undefined)
		});
	}
	if (helper && type === 'select') {
		const options = Array.isArray(d.attributes?.options)
			? (d.attributes.options as unknown[]).map(String)
			: [];
		out.push({
			key: 'cmd:select',
			label: 'set to',
			fields: [
				options.length
					? {
							kind: 'choice',
							name: 'option',
							label: 'Choice',
							options: options.map((o) => ({ value: o, label: o }))
						}
					: { kind: 'text', name: 'option', label: 'Choice' }
			],
			build: (v) => ({ command: 'select', option: String(v.option ?? options[0] ?? '') }),
			read: (s) => (plainState(s) && s.command === 'select' ? { option: s.option } : undefined)
		});
		for (const [c, label] of [
			['next', 'move on to the next choice of'],
			['previous', 'move back to the previous choice of']
		] as const)
			out.push({
				key: `cmd:${c}`,
				label,
				fields: [],
				build: () => ({ command: c }),
				read: (s) => (plainState(s) && s.command === c ? {} : undefined)
			});
	}
	if (helper && (type === 'text' || type === 'datetime')) {
		out.push({
			key: 'cmd:set',
			label: 'set to',
			fields: [
				{
					kind: 'text',
					name: 'value',
					label: type === 'datetime' ? 'Date, time or both — 2026-04-04, 08:00:00' : 'Words'
				}
			],
			build: (v) => ({ command: 'set', value: String(v.value ?? '') }),
			read: (s) => (plainState(s) && s.command === 'set' ? { value: s.value } : undefined)
		});
		out.push({
			key: 'cmd:clear',
			label: 'clear',
			fields: [],
			build: () => ({ command: 'clear' }),
			read: (s) => (plainState(s) && s.command === 'clear' ? {} : undefined)
		});
	}
	if (helper && type === 'button')
		out.push({
			key: 'cmd:press',
			label: 'press',
			fields: [],
			build: () => ({ command: 'press' }),
			read: (s) => (plainState(s) && s.command === 'press' ? {} : undefined)
		});

	for (const a of attrs) {
		if (a.name === 'on') continue;
		const s = a.spec;
		let field: Field | undefined;
		if (s.kind === 'bool')
			field = {
				kind: 'choice',
				name: 'v',
				label: cap(a.label),
				options: [
					{ value: 'true', label: s.states?.when_true?.label ?? 'yes' },
					{ value: 'false', label: s.states?.when_false?.label ?? 'no' }
				]
			};
		else if (s.kind === 'enum' && s.options?.length)
			field = { kind: 'choice', name: 'v', label: cap(a.label), options: optionsOf(s) };
		else if (isNum(s))
			field = {
				kind: 'number',
				name: 'v',
				label: cap(a.label),
				unit: s.unit,
				min: s.min,
				max: s.max,
				step: s.step
			};
		if (!field) continue;
		const f = field;
		out.push({
			key: `set:${a.name}`,
			label: `set ${a.label}`,
			fields: [f],
			build: (v) => ({
				[a.name]:
					s.kind === 'bool'
						? v.v === 'true' || v.v === true
						: isNum(s)
							? Number(v.v ?? s.min ?? 0)
							: (v.v ?? optionsOf(s)[0]?.value)
			}),
			read: (st) =>
				plainState(st) && Object.keys(st).length === 1 && a.name in st
					? { v: s.kind === 'bool' ? String(st[a.name]) : st[a.name] }
					: undefined
		});
	}

	for (const act of d.schema?.actions ?? []) {
		const params = act.params ?? [];
		const fields = params.map((p) => paramField(p, d));
		out.push({
			key: `act:${act.id}`,
			label: (act.label ?? words(act.id)).replace(/^./, (c) => c.toLowerCase()),
			fields,
			build: (v) => {
				const body: Record<string, unknown> = { action: act.id };
				for (const f of fields) {
					const raw = v[f.name] ?? params.find((p) => p.name === f.name)?.default;
					if (raw === undefined || raw === '') continue;
					body[f.name] =
						(f.kind === 'choice' && f.numeric) || f.kind === 'number' || f.kind === 'duration'
							? Number(raw)
							: raw;
				}
				return body;
			},
			read: (st) => {
				if (!plainState(st)) return undefined;
				if (st.action === act.id) {
					const { action: _a, ...rest } = st;
					return stringy(rest, fields);
				}
				// The keyed form some rules use: `{ set_led: { button: 1, state: 1 } }`.
				const k = Object.keys(st);
				if (k.length === 1 && k[0] === act.id)
					return stringy(plainState(st[act.id]) ? st[act.id] : {}, fields);
				return undefined;
			}
		});
	}
	return out;
}

/** Choice values are strings in a form; numbers stay numbers elsewhere. */
function stringy(v: Record<string, unknown>, fields: Field[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, x] of Object.entries(v))
		out[k] = fields.find((f) => f.name === k)?.kind === 'choice' ? String(x) : x;
	return out;
}

/** Which command a state is, and its values; undefined when none fits. */
export function commandOf(
	cmds: Command[],
	state: Json
): { cmd: Command; values: Record<string, unknown> } | undefined {
	for (const cmd of cmds) {
		const values = cmd.read(state);
		if (values !== undefined) return { cmd, values };
	}
	return undefined;
}

/**
 * Rebuild a command in the shape the rule already had it — a rule written
 * `{ set_led: {…} }` keeps that form when only a value changes.
 */
export function rebuild(cmd: Command, values: Record<string, unknown>, before: Json): Json {
	const next = cmd.build(values);
	if (!cmd.key.startsWith('act:') || !plainState(before)) return next;
	const id = cmd.key.slice(4);
	const k = Object.keys(before);
	const keyed = k.length === 1 && k[0] === id && typeof before.action !== 'string';
	// A value the rule had as a number stays a number, whatever the schema's options say.
	const was: Record<string, unknown> = keyed ? (plainState(before[id]) ? before[id] : {}) : before;
	for (const [name, v] of Object.entries(next))
		if (
			typeof was[name] === 'number' &&
			typeof v === 'string' &&
			v.trim() !== '' &&
			!Number.isNaN(Number(v))
		)
			next[name] = Number(v);
	if (keyed) {
		const { action: _a, ...rest } = next;
		return { [id]: rest };
	}
	return next;
}

/** Devices that can be told something, for "Set a device". */
export const commandable = (d: CoreDevice) => commandsOf(d).length > 0;
/** Devices that report something a rule can wait for. */
export const momentful = (d: CoreDevice) =>
	d.device_type !== 'scene' || d.schema?.attributes?.on !== undefined;

// ---- the kinds offered by name ----

export type WhenKind = 'device' | 'time' | 'sun' | 'mode' | 'start' | 'every' | 'other';
export type CheckKind = 'device' | 'mode' | 'time' | 'any' | 'other';
export type StepKind =
	'device' | 'scene' | 'wait' | 'notify' | 'if' | 'together' | 'mode' | 'other';

export const WHEN_KINDS: { kind: WhenKind; label: string; sub: string }[] = [
	{ kind: 'device', label: 'A device changes', sub: 'Opens, turns on, is pressed…' },
	{ kind: 'time', label: 'A time of day', sub: 'On the days you choose' },
	{ kind: 'sun', label: 'Sunrise or sunset', sub: 'With an offset' },
	{ kind: 'mode', label: 'A mode changes', sub: 'Night, Away…' },
	{ kind: 'start', label: 'homeCore starts', sub: '' },
	{ kind: 'every', label: 'Every so often', sub: 'Every 5 minutes, every hour…' },
	{
		kind: 'other',
		label: 'Something else',
		sub: 'A battery runs low, a webhook, a calendar event…'
	}
];

export const CHECK_KINDS: { kind: CheckKind; label: string }[] = [
	{ kind: 'device', label: 'A device is…' },
	{ kind: 'mode', label: 'A mode is on or off' },
	{ kind: 'time', label: 'It’s between two times' },
	{ kind: 'any', label: 'Any of these' },
	{ kind: 'other', label: 'Something else' }
];

export const STEP_KINDS: { kind: StepKind; label: string; sub: string }[] = [
	{ kind: 'device', label: 'Set a device', sub: 'On, off, a level — whatever it takes' },
	{ kind: 'scene', label: 'Run a scene', sub: 'One of homeCore’s scenes' },
	{ kind: 'wait', label: 'Wait', sub: 'For a time' },
	{ kind: 'if', label: 'If / otherwise', sub: 'Do one thing or another' },
	{ kind: 'notify', label: 'Tell someone', sub: 'Through a notification channel' },
	{ kind: 'together', label: 'At the same time', sub: 'Steps that run together' },
	{ kind: 'mode', label: 'Turn a mode on or off', sub: '' },
	{ kind: 'other', label: 'Something else', sub: 'Repeat, wait for, a script…' }
];

export function whenKindOf(t: Json): WhenKind {
	const [kind] = tagOf(t);
	if (momentOf(t)) return 'device';
	if (kind === 'TimeOfDay') return 'time';
	if (kind === 'SunEvent') return 'sun';
	if (kind === 'ModeChanged') return 'mode';
	if (kind === 'SystemStarted') return 'start';
	if (kind === 'Periodic') return 'every';
	return 'other';
}

export function checkKindOf(c: Json): CheckKind {
	const [kind] = tagOf(c);
	if (kind === 'ModeIs') return 'mode';
	if (kind === 'DeviceState' && stateOf(c)) return 'device';
	if (kind === 'TimeWindow') return 'time';
	if (kind === 'Or') return 'any';
	return 'other';
}

export function stepKindOf(a: Json): StepKind {
	const [kind, f] = tagOf(a);
	if (kind === 'SetDeviceState') return 'device';
	if (kind === 'ActivateScenePerMode' && (f.modes ?? []).length === 0) return 'scene';
	if (kind === 'Delay') return 'wait';
	if (kind === 'Notify') return 'notify';
	if (kind === 'Conditional') return 'if';
	if (kind === 'Parallel') return 'together';
	if (kind === 'SetMode') return 'mode';
	return 'other';
}

/** A new part of the kind chosen, with nothing chosen yet. */
export function newWhen(kind: WhenKind): Json {
	switch (kind) {
		case 'device':
			return { DeviceStateChanged: { device_id: '' } };
		case 'time':
			return { TimeOfDay: { time: '07:00:00', days: [] } };
		case 'sun':
			return { SunEvent: { event: 'Sunset', offset_minutes: 0 } };
		case 'mode':
			return { ModeChanged: { mode_id: 'mode_night', to: true } };
		case 'start':
			return 'SystemStarted';
		case 'every':
			return { Periodic: { every_n: 5, unit: 'Minutes' } };
		default:
			return 'ManualTrigger';
	}
}

export function newCheck(kind: CheckKind): Json {
	switch (kind) {
		case 'device':
			return { DeviceState: { device_id: '', attribute: 'on', op: 'Eq', value: true } };
		case 'mode':
			return { ModeIs: { mode_id: 'mode_night', on: true } };
		case 'time':
			return { TimeWindow: { start: '22:00:00', end: '06:00:00' } };
		case 'any':
			return { Or: { conditions: [] } };
		default:
			return { ScriptExpression: { script: 'true' } };
	}
}

export function newStep(kind: StepKind, firstScene = ''): Json {
	switch (kind) {
		case 'device':
			return { SetDeviceState: { device_id: '', state: { on: true }, track_event_value: false } };
		case 'scene':
			return { ActivateScenePerMode: { modes: [], default_scene_id: firstScene } };
		case 'wait':
			return { Delay: { duration_secs: 60, cancelable: true } };
		case 'notify':
			return { Notify: { channel: 'all', message: '', title: null } };
		case 'if':
			return { Conditional: { condition: '', then_actions: [], else_actions: [] } };
		case 'together':
			return { Parallel: { actions: [] } };
		case 'mode':
			return { SetMode: { mode_id: 'mode_night', command: 'On' } };
		default:
			return { Comment: { text: '' } };
	}
}

// ---- the rest of the vocabulary, as fields ----

/** A variant's fields as form fields, by their JSON type. */
export function vocabFields(spec: VariantSpec): Field[] {
	return spec.fields.map((f): Field => {
		const label = cap(words(f.name));
		const optional = !f.required;
		if (f.name === 'device_id') return { kind: 'device', name: f.name, label: 'Device', optional };
		if (f.type === 'integer' || f.type === 'number')
			return { kind: 'number', name: f.name, label, optional };
		if (f.type === 'boolean') return { kind: 'bool', name: f.name, label };
		if (f.type === 'string')
			return {
				kind: 'text',
				name: f.name,
				label,
				optional,
				long: /script|expression|condition|message|payload/.test(f.name)
			};
		return { kind: 'json', name: f.name, label, optional };
	});
}

/** A new value of a vocabulary variant, with its required fields empty. */
export function newOf(spec: VariantSpec): Json {
	if (spec.fields.length === 0) return spec.tag;
	const body: Record<string, unknown> = {};
	for (const f of spec.fields) {
		if (!f.required) continue;
		body[f.name] =
			f.type === 'integer' || f.type === 'number'
				? 0
				: f.type === 'boolean'
					? false
					: f.type === 'array'
						? []
						: f.type === 'string'
							? ''
							: f.type === 'object'
								? {}
								: null;
	}
	return { [spec.tag]: body };
}

// ---- if/otherwise: what it asks ----

/**
 * What an if/otherwise asks, as checks. A homeCore with `if_checks` takes a
 * check (one, or "all of"); before that only a script, so simple device and
 * mode checks are written as the script `readScript` reads back.
 */
export function ifCondition(checks: Json[], f: Features): Json | undefined {
	if (f.ifChecks) return checks.length === 1 ? checks[0] : { And: { conditions: checks } };
	const parts = checks.map(toRhai);
	if (parts.some((p) => p === undefined)) return undefined;
	return parts.join(' && ');
}

/** The checks an if/otherwise asks, when they're checks (or a script read as them). */
export function ifChecks(condition: Json): Json[] | undefined {
	if (condition === '' || condition === null || condition === undefined) return [];
	if (typeof condition === 'object') {
		const [kind, f] = tagOf(condition);
		return kind === 'And' ? (f.conditions ?? []) : [condition];
	}
	const parts = String(condition)
		.split('&&')
		.map((p) => fromRhai(p.trim()));
	return parts.some((p) => p === undefined) ? undefined : (parts as Json[]);
}

const RHAI_OP: Record<string, string> = {
	Eq: '==',
	Ne: '!=',
	Gt: '>',
	Gte: '>=',
	Lt: '<',
	Lte: '<='
};

function toRhai(c: Json): string | undefined {
	const [kind, f] = tagOf(c);
	if (kind === 'ModeIs')
		return `device_state(${JSON.stringify(f.mode_id)})["on"] == ${f.on ? 'true' : 'false'}`;
	if (
		kind === 'DeviceState' &&
		RHAI_OP[f.op] &&
		['boolean', 'number', 'string'].includes(typeof f.value)
	)
		return `device_state(${JSON.stringify(f.device_id)})[${JSON.stringify(f.attribute)}] ${RHAI_OP[f.op]} ${JSON.stringify(f.value)}`;
	return undefined;
}

function fromRhai(s: string): Json | undefined {
	const m =
		/^device_state\(\s*"([^"]+)"\s*\)\s*\[\s*"([^"]+)"\s*\]\s*(==|!=|>=|<=|>|<)\s*(true|false|-?\d+(?:\.\d+)?|"[^"]*")$/.exec(
			s
		);
	if (!m) return undefined;
	const [, id, attribute, op, lit] = m;
	const value =
		lit === 'true'
			? true
			: lit === 'false'
				? false
				: lit!.startsWith('"')
					? JSON.parse(lit!)
					: Number(lit);
	const name = Object.entries(RHAI_OP).find(([, sym]) => sym === op)![0];
	if (attribute === 'on' && id!.startsWith('mode_') && name === 'Eq' && typeof value === 'boolean')
		return { ModeIs: { mode_id: id, on: value } };
	return { DeviceState: { device_id: id, attribute, op: name, value } };
}

/** Which kinds of check an if/otherwise can ask on this homeCore. */
export const ifKinds = (f: Features): CheckKind[] =>
	f.ifChecks ? ['device', 'mode', 'time', 'any'] : ['device', 'mode'];

// ---- a whole rule ----

export function blankRule(name = ''): Rule {
	return {
		id: '',
		name,
		enabled: true,
		priority: 0,
		tags: [],
		trigger: newWhen('device'),
		conditions: [],
		actions: []
	};
}

/** The rule's moments, as one list; and back. */
export const whensOf = (r: Rule): Json[] => [r.trigger, ...((r as Json).triggers ?? [])];
export function withWhens(r: Rule, whens: Json[]): Rule {
	const [first, ...rest] = whens;
	const next = { ...r, trigger: first ?? 'ManualTrigger' } as Json;
	if (rest.length) next.triggers = rest;
	else delete next.triggers;
	return next;
}

/** What stops a draft being saved, in words; empty when nothing does. */
export function problemsOf(r: Rule, has: (id: string) => boolean): string[] {
	const out: string[] = [];
	if (!r.name.trim()) out.push('It needs a name.');
	const missing = new Set<string>();
	const walk = (v: Json, k = '') => {
		if (typeof v === 'string') {
			if ((k === 'device_id' || k === 'mode_id' || k === 'device_ids') && (v === '' || !has(v)))
				missing.add(v);
			return;
		}
		if (Array.isArray(v)) v.forEach((x) => walk(x, k));
		else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk);
	};
	walk({
		trigger: r.trigger,
		triggers: (r as Json).triggers,
		conditions: r.conditions,
		actions: r.actions
	});
	if (missing.has('')) out.push('A part still needs its device chosen.');
	const named = [...missing].filter((m) => m !== '');
	if (named.length)
		out.push(`It names ${named.map((m) => `“${m}”`).join(', ')}, which the house doesn’t have.`);
	if (!(r.actions ?? []).length) out.push('It doesn’t do anything yet — add a step.');
	const ifs = JSON.stringify(r.actions ?? []).includes('"Conditional":{"condition":""');
	if (ifs) out.push('An if/otherwise doesn’t ask anything yet.');
	return out;
}

/** The parts of a device list to choose from, grouped by room name. */
export function byRoomName(
	list: CoreDevice[],
	roomOf: (d: CoreDevice) => string | undefined
): { room: string; devices: CoreDevice[] }[] {
	const groups = new Map<string, CoreDevice[]>();
	for (const d of list) {
		const r = roomOf(d) ?? 'No room';
		groups.set(r, [...(groups.get(r) ?? []), d]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => (a === 'No room' ? 1 : b === 'No room' ? -1 : a.localeCompare(b)))
		.map(([room, devices]) => ({
			room,
			devices: devices.sort((a, b) => displayName(a).localeCompare(displayName(b)))
		}));
}

// ---- pickers for what a field names (A7 coverage pass) ----

/** What the house has for a field to choose from. */
export interface Lists {
	rules: { id: string; name: string }[];
	calendars: string[];
	modes: { id: string; name: string }[];
	/** Variable names the house's rules already use, by sort. */
	variables: { hub: string[]; private: string[]; rule: string[] };
	/** The readings of the device this part names, when it names one. */
	attributes?: string[];
}

/** A device's readings by name, for a field that names one: its schema's, then what it reports. */
export function readingsOf(d: CoreDevice | undefined): string[] {
	if (!d) return [];
	const named = Object.keys(d.schema?.attributes ?? {});
	const seen = Object.keys(d.attributes ?? {}).filter((k) => !named.includes(k));
	return [...named, ...seen].sort((a, b) => a.localeCompare(b));
}

const VARIABLE_SORT: Record<string, keyof Lists['variables']> = {
	HubVariableChanged: 'hub',
	HubVariable: 'hub',
	SetHubVariable: 'hub',
	PrivateBooleanIs: 'private',
	SetPrivateBoolean: 'private',
	SetVariable: 'rule'
};

/** Every variable name the rules use, by sort — homeCore can't list them. */
export function variablesIn(rules: unknown[]): Lists['variables'] {
	const out = { hub: new Set<string>(), private: new Set<string>(), rule: new Set<string>() };
	const visit = (v: unknown) => {
		if (Array.isArray(v)) return v.forEach(visit);
		if (!v || typeof v !== 'object') return;
		for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
			const sort = VARIABLE_SORT[k];
			const name = (inner as { name?: unknown } | null)?.name;
			if (sort && typeof name === 'string' && name.trim()) out[sort].add(name);
			visit(inner);
		}
	};
	visit(rules);
	const sorted = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b));
	return { hub: sorted(out.hub), private: sorted(out.private), rule: sorted(out.rule) };
}

/**
 * homeCore's fixed lists, by kind and field (hc-types rule.rs): what a
 * "something else" field may hold, in words. Core spells them as its enums do.
 */
const SAME: Choice[] = [
	{ value: 'Eq', label: 'is' },
	{ value: 'Ne', label: 'isn’t' },
	{ value: 'Gt', label: 'is above' },
	{ value: 'Gte', label: 'is at least' },
	{ value: 'Lt', label: 'is below' },
	{ value: 'Lte', label: 'is at most' }
];
const CHANGE_KIND: Choice[] = [
	{ value: 'homecore', label: 'homeCore (a rule, the app)' },
	{ value: 'physical', label: 'by hand, at the device' },
	{ value: 'external', label: 'another app or hub' },
	{ value: 'unknown', label: 'nobody knows' }
];
const VARIABLE_OP: Choice[] = [
	{ value: 'Set', label: 'set it to' },
	{ value: 'Add', label: 'add' },
	{ value: 'Subtract', label: 'subtract' },
	{ value: 'Multiply', label: 'multiply by' },
	{ value: 'Divide', label: 'divide by' },
	{ value: 'Toggle', label: 'flip it' }
];
export const CHOICES: Record<string, { options: Choice[]; optional?: boolean; label?: string }> = {
	'ButtonEvent.event': {
		label: 'Button is',
		options: [
			{ value: 'Pushed', label: 'pushed' },
			{ value: 'Held', label: 'held' },
			{ value: 'DoubleTapped', label: 'double-tapped' },
			{ value: 'Released', label: 'released' }
		]
	},
	'NumericThreshold.op': {
		label: 'When it',
		options: [
			{ value: 'CrossesAbove', label: 'rises above' },
			{ value: 'CrossesBelow', label: 'falls below' },
			{ value: 'Above', label: 'is above (each reading)' },
			{ value: 'Below', label: 'is below (each reading)' }
		]
	},
	'SunEvent.event': {
		label: 'Sun',
		options: [
			{ value: 'Sunrise', label: 'sunrise' },
			{ value: 'Sunset', label: 'sunset' },
			{ value: 'SolarNoon', label: 'solar noon' },
			{ value: 'CivilDawn', label: 'dawn' },
			{ value: 'CivilDusk', label: 'dusk' }
		]
	},
	'Periodic.unit': {
		label: 'Unit',
		options: [
			{ value: 'Minutes', label: 'minutes' },
			{ value: 'Hours', label: 'hours' },
			{ value: 'Days', label: 'days' },
			{ value: 'Weeks', label: 'weeks' }
		]
	},
	'DeviceStateChanged.change_kind': { options: CHANGE_KIND, optional: true, label: 'Changed by' },
	'DeviceLastChange.kind': { options: CHANGE_KIND, optional: true, label: 'Last changed by' },
	'MqttMessage.value_op': { options: SAME, optional: true, label: 'Compare' },
	'DeviceState.op': { options: SAME, label: 'Compare' },
	'HubVariable.op': { options: SAME, label: 'Compare' },
	'SetVariable.op': { options: VARIABLE_OP, optional: true, label: 'How' },
	'SetHubVariable.op': { options: VARIABLE_OP, optional: true, label: 'How' },
	'SetMode.command': {
		label: 'Do',
		options: [
			{ value: 'On', label: 'turn on' },
			{ value: 'Off', label: 'turn off' },
			{ value: 'Toggle', label: 'switch over' }
		]
	},
	'LogMessage.level': {
		label: 'Level',
		optional: true,
		options: ['Trace', 'Debug', 'Info', 'Warn', 'Error'].map((l) => ({
			value: l,
			label: l.toLowerCase()
		}))
	},
	'CallService.method': {
		label: 'Method',
		options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }))
	}
};

/** Fields holding one value of any type: words, a number, yes or no. */
const VALUE_FIELDS = new Set(['to', 'from', 'not_to', 'not_from', 'value', 'value_cmp']);

/**
 * A vocabulary field, given a picker where it names something the house
 * has: a rule, a calendar, a mode, devices; variable names as suggestions.
 */
export function withPickers(tag: string, f: Field, lists: Lists): Field {
	const base = { name: f.name, label: f.label };
	if (f.name === 'rule_id' && lists.rules.length)
		return {
			kind: 'choice',
			...base,
			label: 'Rule',
			options: [...lists.rules]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((r) => ({ value: r.id, label: r.name }))
		};
	if (f.name === 'calendar_id')
		return lists.calendars.length
			? {
					kind: 'choice',
					...base,
					label: 'Calendar',
					options: lists.calendars.map((c) => ({ value: c, label: c }))
				}
			: { kind: 'text', ...base, label: 'Calendar', suggest: [] };
	if (f.name === 'mode_id' && lists.modes.length)
		return {
			kind: 'choice',
			...base,
			label: 'Mode',
			options: lists.modes.map((m) => ({ value: m.id, label: m.name }))
		};
	if (f.name === 'device_ids') return { kind: 'devices', ...base, label: 'Devices' };
	if (f.name === 'name' && VARIABLE_SORT[tag])
		return {
			kind: 'text',
			...base,
			label: 'Variable',
			suggest: lists.variables[VARIABLE_SORT[tag]!]
		};
	const STEP_LABELS: Record<string, string> = {
		actions: 'Steps',
		then_actions: 'If it answers',
		else_actions: 'If it doesn’t answer'
	};
	if (f.kind === 'json' && STEP_LABELS[f.name])
		return { kind: 'steps', ...base, label: STEP_LABELS[f.name]! };
	if (f.kind === 'json' && f.name === 'conditions')
		return {
			kind: 'checks',
			...base,
			label: tag === 'Xor' ? 'Exactly one of these' : tag === 'Or' ? 'Any of these' : 'All of these'
		};
	if (f.kind === 'json' && f.name === 'condition' && tag === 'Not')
		return { kind: 'check', ...base, label: 'This isn’t so' };
	const fixed = CHOICES[`${tag}.${f.name}`];
	if (fixed)
		return {
			kind: 'choice',
			...base,
			label: fixed.label ?? base.label,
			options: fixed.options,
			optional: fixed.optional
		};
	if (f.kind === 'json' && VALUE_FIELDS.has(f.name))
		return { kind: 'value', ...base, optional: 'optional' in f ? f.optional : undefined };
	if (f.name === 'attribute' && lists.attributes)
		return { kind: 'text', ...base, label: 'Reading', suggest: lists.attributes };
	return f;
}

/** Steps homeCore chooses by mode — each has its own table, not fields. */
export const PER_MODE = new Set(['DelayPerMode', 'SetDeviceStatePerMode', 'ActivateScenePerMode']);
