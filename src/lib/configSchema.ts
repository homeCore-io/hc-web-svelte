/**
 * A settings form from a plugin's JSON Schema (A7 coverage pass), for a
 * plugin that publishes a schema but no descriptor. homeCore's contract:
 * the descriptor is preferred; without one, "the client derives a baseline
 * from the schema". The baseline is a descriptor, so the one renderer and
 * the one write path serve it.
 *
 * What the schema says, and nothing more: a section per table, a field per
 * setting it can type, defaults and bounds as given. What it can't type is
 * left to the file, and said so.
 */
import type { Descriptor, Field, Opt, Section } from './descriptor.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = Record<string, any>;

/** "broker_port" → "Broker port". */
export function humanize(key: string): string {
	const words = key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A description's first paragraph: doc comments run on into notes for whoever wrote the code. */
function helpOf(s: Schema): string | undefined {
	const d = typeof s.description === 'string' ? s.description.trim() : '';
	if (!d) return undefined;
	return (d.split(/\n\s*\n/)[0] ?? d).replace(/\s*\n\s*/g, ' ');
}

const SECRET = /(^|_)(password|passwd|secret|token|api_?key|private_?key)$/i;

/**
 * The schema behind a `$ref`, an `allOf`, or an optional (`T | null`):
 * what the setting actually is.
 */
function resolve(root: Schema, s: Schema | undefined, depth = 0): Schema {
	if (!s || typeof s !== 'object' || depth > 16) return {};
	let out: Schema = s;
	if (typeof s.$ref === 'string') {
		const m = /^#\/(\$defs|definitions)\/(.+)$/.exec(s.$ref);
		const target = m ? root[m[1]!]?.[m[2]!] : undefined;
		const { $ref: _, ...rest } = s;
		out = { ...resolve(root, target, depth + 1), ...rest };
	}
	if (Array.isArray(out.allOf) && out.allOf.length) {
		const { allOf, ...rest } = out;
		out = Object.assign({}, ...allOf.map((x: Schema) => resolve(root, x, depth + 1)), rest);
	}
	for (const k of ['anyOf', 'oneOf'] as const) {
		const alts = out[k];
		if (!Array.isArray(alts)) continue;
		const real = alts.filter((x: Schema) => x?.type !== 'null');
		if (real.length === 1) {
			const { [k]: _, ...rest } = out;
			out = { ...resolve(root, real[0], depth + 1), ...rest, nullable: true };
		} else if (real.every((x: Schema) => 'const' in x)) {
			// One string of several, each described: an enum with labels.
			const { [k]: _, ...rest } = out;
			out = { type: 'string', ...rest, oneOfConsts: real };
		}
	}
	if (Array.isArray(out.type)) {
		const real = out.type.filter((t: string) => t !== 'null');
		out = {
			...out,
			type: real.length === 1 ? real[0] : real,
			nullable: real.length < out.type.length
		};
	}
	return out;
}

const isTable = (s: Schema) =>
	s.type === 'object' && s.properties && typeof s.properties === 'object';

/** A plain value a form control can hold, or null when it's more than that. */
function fieldOf(
	root: Schema,
	key: string,
	name: string,
	raw: Schema,
	required: boolean
): Field | null {
	const s = resolve(root, raw);
	const base: Field = {
		kind: 'text',
		key,
		label: typeof s.title === 'string' ? s.title : humanize(name),
		help: helpOf(s),
		...(s.default !== undefined && s.default !== null ? { default: s.default } : {}),
		...(required && s.default === undefined && !s.nullable ? { required: true } : {})
	};
	const bounds = {
		...(typeof s.minimum === 'number' ? { min: s.minimum } : {}),
		...(typeof s.maximum === 'number' ? { max: s.maximum } : {})
	};
	if (Array.isArray(s.enum) && s.enum.every((v: unknown) => typeof v !== 'object')) {
		const options: Opt[] = s.enum
			.filter((v: unknown) => v !== null)
			.map((v: unknown) => ({ value: v, label: String(v) }));
		return { ...base, kind: 'enum', options };
	}
	if (Array.isArray(s.oneOfConsts)) {
		const options: Opt[] = s.oneOfConsts.map((x: Schema) => ({
			value: x.const,
			label: typeof x.title === 'string' ? x.title : (helpOf(x) ?? String(x.const))
		}));
		return { ...base, kind: 'enum', options };
	}
	switch (s.type) {
		case 'boolean':
			return { ...base, kind: 'toggle' };
		case 'integer':
			return {
				...base,
				kind: /port$/i.test(name) && s.maximum === 65535 ? 'port' : 'int',
				...bounds
			};
		case 'number':
			return { ...base, kind: 'number', ...bounds };
		case 'string':
			if (SECRET.test(name) || s.writeOnly) return { ...base, kind: 'secret', secret: true };
			if (s.format === 'uri' || s.format === 'url') return { ...base, kind: 'url' };
			if (s.format === 'hostname' || /(^|_)host$/i.test(name)) return { ...base, kind: 'host' };
			return base;
		case 'array': {
			const item = resolve(root, s.items);
			const kind =
				item.type === 'integer'
					? 'int'
					: item.type === 'number'
						? 'number'
						: item.type === 'string'
							? 'text'
							: null;
			return kind ? { ...base, kind: 'list', item: kind } : null;
		}
		default:
			return null;
	}
}

/** `[[name]]` rows: a table field, read-only when a row holds more than plain values. */
function tableOf(root: Schema, key: string, name: string, raw: Schema): Field | null {
	const s = resolve(root, raw);
	const item = resolve(root, s.items);
	if (s.type !== 'array' || !isTable(item)) return null;
	const req = new Set<string>(Array.isArray(item.required) ? item.required : []);
	const columns: Field[] = [];
	let whole = true;
	for (const [k, v] of Object.entries(item.properties as Record<string, Schema>)) {
		const f = fieldOf(root, k, k, v, req.has(k));
		if (f) columns.push(f);
		else whole = false;
	}
	if (!columns.length) return null;
	const keyBy = ['name', 'id'].find((k) => columns.some((c) => c.key === k));
	return {
		kind: 'table',
		key,
		label: typeof s.title === 'string' ? s.title : humanize(name),
		help: whole
			? helpOf(s)
			: 'Some of each row’s settings are more than this form can show, so change these in the file.',
		// Read-only all the way down: a row's cells are controls of their own.
		item: whole ? columns : columns.map((c) => ({ ...c, read_only: true })),
		...(keyBy ? { key_by: keyBy } : {}),
		...(whole ? {} : { read_only: true })
	};
}

/** homeCore's own section: written when the plugin was installed, and how it signs in. */
const HOMECORE = 'homecore';

/**
 * A baseline descriptor from a config's JSON Schema, or null when the schema
 * holds nothing a form could show.
 */
export function descriptorFromSchema(schema: unknown, pluginId?: string): Descriptor | null {
	if (!schema || typeof schema !== 'object') return null;
	const root = schema as Schema;
	const top = resolve(root, root);
	if (!isTable(top)) return null;

	const sections: Section[] = [];
	const general: Field[] = [];
	let leftOut = 0;
	const topReq = new Set<string>(Array.isArray(top.required) ? top.required : []);

	const walk = (path: string, name: string, s: Schema, required: Set<string>) => {
		const fields: Field[] = [];
		const nested: [string, string, Schema][] = [];
		for (const [k, raw] of Object.entries(s.properties as Record<string, Schema>)) {
			const v = resolve(root, raw);
			const key = `${path}.${k}`;
			if (isTable(v)) nested.push([key, k, v]);
			else {
				const f = tableOf(root, key, k, raw) ?? fieldOf(root, key, k, raw, required.has(k));
				if (f) fields.push(f);
				else leftOut++;
			}
		}
		if (fields.length) {
			const own = path === HOMECORE;
			sections.push({
				id: path,
				title: own
					? 'Connection to homeCore'
					: typeof s.title === 'string'
						? s.title
						: humanize(name),
				help: own
					? 'homeCore wrote these when it added the plugin; they’re how the plugin signs in to it.'
					: helpOf(s),
				fields: own ? fields.map((f) => ({ ...f, read_only: true })) : fields
			});
		}
		for (const [key, k, v] of nested)
			walk(key, k, v, new Set(Array.isArray(v.required) ? v.required : []));
	};

	for (const [k, raw] of Object.entries(top.properties as Record<string, Schema>)) {
		const v = resolve(root, raw);
		if (isTable(v)) {
			walk(k, k, v, new Set(Array.isArray(v.required) ? v.required : []));
			continue;
		}
		const table = tableOf(root, k, k, raw);
		if (table) {
			sections.push({
				id: k,
				title: table.label ?? humanize(k),
				help: table.help,
				// The section says what they are; the field needn't again.
				fields: [{ ...table, label: 'Each entry', help: undefined }]
			});
			continue;
		}
		// homeCore's patch writes into a table, never the file's top level:
		// these are shown, and changed in the file.
		const f = fieldOf(root, k, k, raw, topReq.has(k));
		if (f) general.push({ ...f, read_only: true });
		else leftOut++;
	}
	if (general.length)
		sections.unshift({
			id: '_general',
			title: 'General',
			help: 'Settings at the top of the file. This form shows them; change them in the file.',
			fields: general
		});
	// homeCore's own section last: it's rarely the one to change.
	sections.sort((a, b) => Number(a.id === HOMECORE) - Number(b.id === HOMECORE));
	const first = sections[0];
	if (!first) return null;
	if (leftOut)
		first.fields.push({
			kind: 'note',
			text: `${leftOut} more setting${leftOut === 1 ? ' is' : 's are'} more than this form can show — they’re in the file.`
		});
	return {
		...(pluginId ? { plugin_id: pluginId } : {}),
		...(typeof root.title === 'string' && root.title !== 'Config' ? { title: root.title } : {}),
		sections
	};
}
