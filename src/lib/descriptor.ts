/**
 * The config descriptor (T4): how homeCore and its plugins say a settings
 * form looks. homeCore's own homecore.toml and every plugin's config are
 * described in one vocabulary (core's `hc_types::config_descriptor`), so one
 * renderer serves both. The values come separately; this is their shape.
 *
 * Everything here is pure: what's shown, what changed, what's wrong, and
 * the write homeCore's `PUT /system/config` takes.
 */

export interface Opt {
	value: unknown;
	label: string;
}

/** `visible_when` / `required_when`, exactly as core serialises a `Cond`. */
export type Cond =
	| { field: string; truthy: boolean }
	| { field: string; eq: unknown }
	| { field: string; ne: unknown }
	| { field: string; in: unknown[] }
	| { field: string; gt: number }
	| { field: string; lt: number }
	| { all: Cond[] }
	| { any: Cond[] }
	| { not: Cond };

export interface Source {
	kind: 'core_resource' | 'plugin_action' | string;
	ref: string;
	item_key?: string;
	labels?: unknown;
	capability?: string;
}

export interface Field {
	kind: string;
	/** Dotted path into the config — `server.port`. Absent on `note`, `link`, `import`. */
	key?: string;
	label?: string;
	help?: string;
	placeholder?: string;
	unit?: string;
	render?: string;
	default?: unknown;
	required?: boolean;
	secret?: boolean;
	read_only?: boolean;
	allow_create?: boolean;
	min?: number;
	max?: number;
	step?: number;
	options?: Opt[];
	/** A `list`'s item kind, or a `table`'s columns. */
	item?: string | Field[];
	key_by?: string;
	source?: Source;
	href?: string;
	text?: string;
	action?: string;
	targets?: string[];
	group_by?: string;
	prompt_when_empty?: boolean;
	generated?: boolean;
	visible_when?: Cond;
	required_when?: Cond;
	/** This app's own (not core's): a `sensor` field lists this room's sensors first. */
	near?: string;
}

export interface Section {
	id: string;
	title: string;
	icon?: string;
	help?: string;
	hidden?: boolean;
	visible_when?: Cond;
	fields: Field[];
}

export interface Descriptor {
	plugin_id?: string;
	descriptor_version?: number;
	title?: string;
	sections: Section[];
}

/** Field kinds that hold a value. */
const VALUED = new Set([
	'toggle',
	'text',
	'host',
	'port',
	'url',
	'secret',
	'int',
	'number',
	'duration',
	'enum',
	'select',
	'list',
	'table',
	'map'
]);
export const holdsValue = (f: Field): f is Field & { key: string } =>
	f.key !== undefined && VALUED.has(f.kind);

/** Kinds typed as a number. */
export const numeric = (kind: string) =>
	kind === 'port' || kind === 'int' || kind === 'number' || kind === 'duration';

/** The value at a dotted path, or undefined. */
export function read(config: unknown, key: string): unknown {
	let at: unknown = config;
	for (const part of key.split('.')) {
		if (at === null || typeof at !== 'object' || Array.isArray(at)) return undefined;
		at = (at as Record<string, unknown>)[part];
	}
	return at;
}

/** Every valued field, keyed by its path. */
export function fieldsOf(d: Descriptor): Map<string, Field & { key: string }> {
	const all = new Map<string, Field & { key: string }>();
	for (const s of d.sections) for (const f of s.fields) if (holdsValue(f)) all.set(f.key, f);
	return all;
}

/** What the file holds for each field — undefined where it says nothing. */
export function valuesOf(d: Descriptor, config: unknown): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of fieldsOf(d).keys()) out[key] = read(config, key);
	return out;
}

/** What a field means: what's set, else its default. */
export function effective(f: Field, set: unknown): unknown {
	return set === undefined ? f.default : set;
}

export function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function truthy(v: unknown): boolean {
	if (Array.isArray(v)) return v.length > 0;
	return v !== undefined && v !== null && v !== false && v !== '' && v !== 0;
}

/** Whether `c` holds, reading fields through `get`. */
export function holds(c: Cond | undefined, get: (key: string) => unknown): boolean {
	if (c === undefined) return true;
	if ('all' in c) return c.all.every((x) => holds(x, get));
	if ('any' in c) return c.any.some((x) => holds(x, get));
	if ('not' in c) return !holds(c.not, get);
	const v = get(c.field);
	if ('truthy' in c) return truthy(v) === c.truthy;
	if ('eq' in c) return same(v, c.eq);
	if ('ne' in c) return !same(v, c.ne);
	if ('in' in c) return c.in.some((x) => same(v, x));
	if ('gt' in c) return typeof v === 'number' && v > c.gt;
	if ('lt' in c) return typeof v === 'number' && v < c.lt;
	return true;
}

/** Reads a field's effective value from a draft, for conditions. */
export function getter(d: Descriptor, draft: Record<string, unknown>) {
	const fields = fieldsOf(d);
	return (key: string) => {
		const f = fields.get(key);
		return f ? effective(f, draft[key]) : draft[key];
	};
}

/** Whether a section is shown in the list of sections. */
export const sectionShown = (s: Section, get: (key: string) => unknown) =>
	!s.hidden && holds(s.visible_when, get);

/**
 * A section kept out of the list but still editable — a plugin's connection
 * to homeCore, say ("hidden": editable, not in the rail).
 */
export const sectionTucked = (s: Section, get: (key: string) => unknown) =>
	!!s.hidden && holds(s.visible_when, get);

/** Whether a field is shown within its (shown) section. */
export const fieldShown = (f: Field, get: (key: string) => unknown) => holds(f.visible_when, get);

const PORT = 'A port is a whole number from 1 to 65535.';
/** A name in a name → value table: one TOML key, as homeCore's targets are spelled. */
export const MAP_NAME = /^[A-Za-z0-9_][A-Za-z0-9_:.-]*$/;

/**
 * Typed text to a value, or what's wrong with it. Empty text is `undefined`:
 * the field says nothing, and its default (if any) applies.
 */
export function parse(f: Field, text: string): { value: unknown } | { error: string } {
	const t = text.trim();
	if (t === '') return { value: undefined };
	if (!numeric(f.kind)) return { value: f.kind === 'secret' ? text : t };
	const n = Number(t);
	if (!Number.isFinite(n)) return { error: f.kind === 'port' ? PORT : 'That isn’t a number.' };
	if (f.kind !== 'number' && !Number.isInteger(n))
		return { error: f.kind === 'port' ? PORT : 'A whole number, please.' };
	return { value: n };
}

/** Text for a value in an input. */
export function entry(v: unknown): string {
	return v === undefined || v === null ? '' : String(v);
}

/** What's wrong with a field's value, or null. `required` covers `required_when`. */
export function problem(f: Field, v: unknown, required = !!f.required): string | null {
	if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
		return required && f.default === undefined ? 'This needs a value.' : null;
	}
	// A port may be 0 only where the field says so (0 = off).
	if (f.kind === 'port' && (typeof v !== 'number' || v < (f.min ?? 1) || v > 65535)) return PORT;
	if (numeric(f.kind) && typeof v !== 'number') return 'That isn’t a number.';
	if (typeof v === 'number') {
		if (f.kind !== 'number' && !Number.isInteger(v)) return 'A whole number, please.';
		if (f.min !== undefined && v < f.min) return `At least ${f.min}${unitText(f)}.`;
		if (f.max !== undefined && v > f.max) return `At most ${f.max}${unitText(f)}.`;
		if (f.kind === 'duration' && v < 0) return 'A duration can’t be negative.';
	}
	if (f.kind === 'url' && typeof v === 'string' && !/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(v))
		return 'A web address, starting http:// or https://.';
	if (f.kind === 'host' && typeof v === 'string' && /\s/.test(v))
		return 'A host name or address has no spaces.';
	if (f.kind === 'map' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
		for (const [k, x] of Object.entries(v)) {
			if (!MAP_NAME.test(k))
				return `“${k}”: a name has no spaces — like hc_core or hc_core::engine.`;
			if (f.options && !f.options.some((o) => same(o.value, x)))
				return `${k}: ${entry(x)} isn’t one of ${f.options.map((o) => o.label).join(', ')}.`;
		}
	}
	if (f.kind === 'list' && Array.isArray(v) && typeof f.item === 'string') {
		const item = { kind: f.item } as Field;
		for (const x of v) {
			const p = problem(item, x);
			if (p) return `${entry(x)}: ${p}`;
		}
	}
	return null;
}

const UNITS: Record<string, string> = {
	secs: 'seconds',
	ms: 'milliseconds',
	mins: 'minutes',
	min: 'minutes'
};
/** A unit as a person reads it. */
export const unitName = (u: string | undefined) => (u === undefined ? '' : (UNITS[u] ?? u));
const unitText = (f: Field) => (f.unit ? ` ${unitName(f.unit)}` : '');

/** A value as a person reads it, for "was …" and the save bar. */
export function describe(f: Field, v: unknown): string {
	if (v === undefined)
		return f.default === undefined ? 'not set' : `default (${describe(f, f.default)})`;
	if (f.secret || f.kind === 'secret') return 'a secret';
	if (typeof v === 'boolean') return v ? 'on' : 'off';
	if (f.options) {
		const o = f.options.find((x) => same(x.value, v));
		if (o) return o.label;
	}
	if (Array.isArray(v))
		return v.length === 0 ? 'none' : `${v.length} item${v.length === 1 ? '' : 's'}`;
	if (f.kind === 'map' && v !== null && typeof v === 'object') {
		const n = Object.keys(v).length;
		return n === 0 ? 'none' : `${n} entr${n === 1 ? 'y' : 'ies'}`;
	}
	if (v === '') return 'empty';
	return `${String(v)}${unitText(f)}`;
}

export interface Change {
	key: string;
	field: Field & { key: string };
	section: Section;
	was: unknown;
	now: unknown;
}

/** What the draft changes, in the descriptor's order. */
export function changes(
	d: Descriptor,
	original: Record<string, unknown>,
	draft: Record<string, unknown>
): Change[] {
	const out: Change[] = [];
	for (const section of d.sections)
		for (const field of section.fields) {
			if (!holdsValue(field)) continue;
			const was = original[field.key];
			const now = draft[field.key];
			if (!same(was, now)) out.push({ key: field.key, field, section, was, now });
		}
	return out;
}

/** Problems with the draft, by key — only for fields that are shown. */
export function problems(d: Descriptor, draft: Record<string, unknown>): Record<string, string> {
	const get = getter(d, draft);
	const out: Record<string, string> = {};
	for (const s of d.sections) {
		if (!sectionShown(s, get)) continue;
		for (const f of s.fields) {
			if (!holdsValue(f) || !fieldShown(f, get)) continue;
			const required =
				!!f.required || (f.required_when !== undefined && holds(f.required_when, get));
			const p = problem(f, draft[f.key], required);
			if (p) out[f.key] = p;
		}
	}
	return out;
}

/**
 * A number written as a float even when it is whole. JSON has one number
 * type; `json()` spells these with a decimal point so homeCore keeps them
 * floats.
 */
export class Float {
	constructor(readonly n: number) {}
	toJSON() {
		return `${FLOAT}${this.n}`;
	}
}
const FLOAT = '\u0001float:';

/** JSON for a write, with each `Float` spelled as one. */
export function json(body: unknown): string {
	return JSON.stringify(body).replace(/"\\u0001float:([^"]+)"/g, (_, n: string) =>
		/[.eE]/.test(n) ? n : `${n}.0`
	);
}

/** homeCore's config write for a set of changes: one `patch`, and one `array_of_tables` per table. */
export interface Writes {
	patch: Record<string, Record<string, unknown>> | null;
	tables: { section: string; items: unknown[] }[];
	/** Changes this can't write — a value taken away, which a patch can't say. */
	cannot: Change[];
}

export function writes(cs: Change[]): Writes {
	const patch: Record<string, Record<string, unknown>> = {};
	const tables: Writes['tables'] = [];
	const cannot: Change[] = [];
	for (const c of cs) {
		if (c.field.kind === 'table') {
			tables.push({ section: c.key, items: Array.isArray(c.now) ? c.now : [] });
			continue;
		}
		if (c.field.kind === 'map') {
			// A patch on the table itself: each name set, each one gone as null
			// (homeCore 0.1.80 and later take null as "remove").
			const was = (c.was ?? {}) as Record<string, unknown>;
			const now = (c.now ?? {}) as Record<string, unknown>;
			const edits: Record<string, unknown> = {};
			for (const [k, x] of Object.entries(now)) if (!same(was[k], x)) edits[k] = x;
			for (const k of Object.keys(was)) if (!(k in now)) edits[k] = null;
			if (Object.keys(edits).length) patch[c.key] = { ...(patch[c.key] ?? {}), ...edits };
			continue;
		}
		let now = c.now;
		if (now === undefined) {
			// A patch can set a value but not remove one. Where there's a
			// default, writing it says the same thing.
			if (c.field.default === undefined) {
				cannot.push(c);
				continue;
			}
			now = c.field.default;
		}
		// A `number` stays a float in the file: 20.0 written back as 15 would
		// change its TOML type, which a float setting may refuse.
		if (c.field.kind === 'number' && typeof now === 'number') now = new Float(now);
		const dot = c.key.lastIndexOf('.');
		const table = dot < 0 ? '' : c.key.slice(0, dot);
		(patch[table] ??= {})[c.key.slice(dot + 1)] = now;
	}
	return { patch: Object.keys(patch).length ? patch : null, tables, cannot };
}

/**
 * A `link` field's address: `{client_host}` is the host this page came from,
 * `{some.key}` a value from the config.
 */
export function linkTo(href: string, host: string, get: (key: string) => unknown): string {
	return href.replace(/\{([^}]+)\}/g, (_, name: string) =>
		name === 'client_host' ? host : encodeURIComponent(entry(get(name)))
	);
}

/** Lowercased words a settings search matches a section on. */
export function searchText(s: Section): string {
	return [s.title, s.help, ...s.fields.flatMap((f) => [f.label, f.key, f.help])]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}
