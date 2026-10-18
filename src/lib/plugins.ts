/**
 * Plugins (A4): what connects homeCore to devices — each as the house sees
 * it: running or not, how many devices, its version and whether a newer one
 * is in the registry; what it can do (its actions), and an action's progress
 * as it talks back.
 *
 * Shapes follow homeCore's (`GET /plugins`, `/registry/plugins`,
 * `/plugins/{id}/capabilities`, the command stream) — only what the app reads.
 */
import { cap, words, ago } from './card.js';
import { pluginLabel } from './inventory.js';
import type { Field } from './ruleEdit.js';

export interface Notice {
	level: 'info' | 'warning' | 'error';
	code: string;
	message: string;
	remedy?: string;
}

export interface PluginAction {
	id: string;
	label: string;
	description?: string;
	params?: Record<string, ParamSchema>;
	stream?: boolean;
	cancelable?: boolean;
	concurrency?: 'multi' | 'single';
	item_key?: string;
	requires_role?: 'admin' | 'user' | 'read_only';
	timeout_ms?: number;
}

export interface ParamSchema {
	type?: string;
	title?: string;
	description?: string;
	default?: unknown;
	minimum?: number;
	maximum?: number;
	enum?: unknown[];
}

export interface PluginRecord {
	plugin_id: string;
	status: 'active' | 'offline' | 'stopped' | 'starting' | string;
	enabled: boolean;
	managed: boolean;
	config_path?: string;
	last_heartbeat?: string;
	last_restart?: string;
	restart_count: number;
	uptime_started?: string;
	device_count: number;
	log_level?: string;
	version?: string;
	installed_version?: string;
	supports_management: boolean;
	notices?: Notice[];
	capabilities?: { actions?: PluginAction[] };
	config_descriptor?: unknown;
}

export interface RegistryPlugin {
	id: string;
	name: string;
	description: string;
	category?: string;
	versions: {
		version: string;
		min_core?: string;
		artifacts: { os: string; arch: string; size: number; runtime?: string }[];
	}[];
}

// ---- versions ----

/** Compare dotted versions by number: 0.1.10 is after 0.1.9. */
export function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, '').split(/[.-]/);
	const pb = b.replace(/^v/, '').split(/[.-]/);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const x = pa[i] ?? '0';
		const y = pb[i] ?? '0';
		const nx = Number(x);
		const ny = Number(y);
		const c = Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny;
		if (c !== 0) return c;
	}
	return 0;
}

type Version = RegistryPlugin['versions'][number];

/**
 * What a version needs that this homeCore isn't: the `min_core` it names,
 * when `core` is older. Undefined when it runs, or when either isn't known.
 */
export const needsCore = (v: Version | undefined, core: string | null | undefined) =>
	v?.min_core && core && compareVersions(core, v.min_core) < 0 ? v.min_core : undefined;

/** The newest version — the newest that runs on `core`, when it's known. */
export const latestOf = (r: RegistryPlugin | undefined, core?: string | null) =>
	r?.versions
		.filter((v) => needsCore(v, core) === undefined)
		.map((v) => v.version)
		.sort(compareVersions)
		.at(-1);

/** The version it runs: what it says, else what was installed. */
export const versionOf = (p: PluginRecord) => p.version ?? p.installed_version;

/** A newer version in the registry that runs on `core`, if there is one. */
export function updateOf(
	p: PluginRecord,
	r: RegistryPlugin | undefined,
	core?: string | null
): string | undefined {
	const have = versionOf(p);
	const latest = latestOf(r, core);
	return have && latest && compareVersions(latest, have) > 0 ? latest : undefined;
}

// ---- how it is ----

export type Tone = 'good' | 'quiet' | 'bad';

/** Its state in words: "Running since 15:07", "Offline — last heard 3 h ago". */
export function stateOf(
	p: PluginRecord,
	now = Date.now()
): { word: string; detail: string; tone: Tone } {
	if (!p.enabled) return { word: 'Turned off', detail: '', tone: 'quiet' };
	const since = (iso?: string) => {
		if (!iso) return '';
		const at = new Date(iso);
		const ms = now - at.getTime();
		return ms < 86_400_000
			? `since ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
			: `for ${ago(ms)}`;
	};
	switch (p.status) {
		case 'active':
			return { word: 'Running', detail: since(p.uptime_started), tone: 'good' };
		case 'starting':
			return { word: 'Starting', detail: '', tone: 'quiet' };
		case 'stopped':
			return { word: 'Stopped', detail: '', tone: 'quiet' };
		case 'offline':
			return {
				word: 'Not answering',
				detail: p.last_heartbeat ? `last heard ${ago(now - Date.parse(p.last_heartbeat))} ago` : '',
				tone: 'bad'
			};
		default:
			return { word: cap(words(p.status)), detail: '', tone: 'quiet' };
	}
}

export interface Row {
	id: string;
	name: string;
	what: string;
	version?: string;
	update?: string;
	devices: number;
	state: ReturnType<typeof stateOf>;
	/** Its worst notice, for the list. */
	notice?: Notice;
	record: PluginRecord;
}

const NOTICE_RANK = { error: 0, warning: 1, info: 2 } as const;

export function rowsOf(
	list: PluginRecord[],
	registry: RegistryPlugin[] = [],
	now = Date.now(),
	core?: string | null
): Row[] {
	return list
		.map((p) => {
			const r = registry.find((x) => x.id === p.plugin_id);
			const notices = [...(p.notices ?? [])].sort(
				(a, b) => NOTICE_RANK[a.level] - NOTICE_RANK[b.level]
			);
			return {
				id: p.plugin_id,
				name: r?.name ?? pluginLabel(p.plugin_id),
				what: r?.description ?? '',
				version: versionOf(p),
				update: updateOf(p, r, core),
				devices: p.device_count,
				state: stateOf(p, now),
				notice: notices.find((n) => n.level !== 'info'),
				record: p
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Registry plugins the house doesn't have. */
export const notInstalled = (registry: RegistryPlugin[], list: PluginRecord[]) =>
	registry
		.filter((r) => !list.some((p) => p.plugin_id === r.id))
		.sort((a, b) => a.name.localeCompare(b.name));

/** "4.0 MB" for this machine's artifact, if the registry says. */
export function sizeOf(r: RegistryPlugin, version: string): string | undefined {
	const a = r.versions.find((v) => v.version === version)?.artifacts.find((x) => x.os === 'linux');
	return a ? `${(a.size / 1_048_576).toFixed(1)} MB` : undefined;
}

// ---- actions ----

/** An action's parameters as form fields (the rule editor's, reused). */
export function paramFields(a: PluginAction): Field[] {
	return Object.entries(a.params ?? {}).map(([name, p]): Field => {
		const label = p.title ?? cap(words(name));
		if (p.enum?.length)
			return {
				kind: 'choice',
				name,
				label,
				options: p.enum.map((v) => ({ value: String(v), label: words(String(v)) })),
				numeric: p.type === 'integer' || p.type === 'number'
			};
		if (p.type === 'integer' || p.type === 'number')
			return { kind: 'number', name, label, min: p.minimum, max: p.maximum };
		if (p.type === 'boolean') return { kind: 'bool', name, label };
		if (p.type === 'object' || p.type === 'array')
			return { kind: 'json', name, label, optional: true };
		return { kind: 'text', name, label, optional: true };
	});
}

/** The values an action starts with: its defaults. */
export const paramDefaults = (a: PluginAction): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(a.params ?? {})
			.filter(([, p]) => p.default !== undefined)
			.map(([name, p]) => [name, p.enum ? String(p.default) : p.default])
	);

/** The verb on an action's button. */
export function buttonOf(a: PluginAction): string {
	if (/^(remove|delete|forget|unpair|reset)/i.test(a.id)) return 'Remove…';
	if (Object.keys(a.params ?? {}).length || a.stream) return a.stream ? 'Start…' : 'Run…';
	return 'Run';
}

export const dangerous = (a: PluginAction) =>
	/^(remove|delete|forget|unpair|reset|factory)/i.test(a.id);

// ---- an action talking back ----

export type StreamEvent =
	| { stage: 'progress'; percent?: number; label?: string; message?: string; ts?: string }
	| { stage: 'item'; op: 'add' | 'update' | 'remove'; data: Record<string, unknown>; ts?: string }
	| { stage: 'warning'; message: string; ts?: string }
	| {
			stage: 'awaiting_user';
			prompt: string;
			/** JSON-schema style (`properties`, `required`), or the fields themselves. */
			response_schema?: Record<string, unknown>;
			ts?: string;
	  }
	| { stage: 'complete'; data?: unknown; ts?: string }
	| { stage: 'error'; message: string; data?: { reason?: string }; ts?: string }
	| { stage: 'canceled'; ts?: string }
	| { stage: 'timeout'; message?: string; ts?: string };

export interface Run {
	state: 'running' | 'waiting' | 'done' | 'failed' | 'canceled' | 'timed out';
	percent?: number;
	/** What's happening, newest last. */
	lines: { at: string; text: string; tone: 'plain' | 'warn' | 'bad' | 'good' }[];
	/** Things it found or changed, by key. */
	items: Record<string, Record<string, unknown>>;
	prompt?: { text: string; fields: Field[]; required: string[] };
	result?: unknown;
}

export const startRun = (): Run => ({ state: 'running', lines: [], items: {} });

/** A run after one more event. */
export function runAfter(run: Run, e: StreamEvent, key = 'id'): Run {
	const at = e.ts
		? new Date(e.ts).toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false
			})
		: '';
	// The same words again are the same news: one line, not a hundred.
	const line = (text: string, tone: Run['lines'][number]['tone'] = 'plain') =>
		run.lines.at(-1)?.text === text ? run.lines : [...run.lines, { at, text, tone }];
	switch (e.stage) {
		case 'progress':
			return {
				...run,
				state: 'running',
				prompt: undefined,
				percent: e.percent ?? run.percent,
				lines: e.message || e.label ? line(e.message ?? e.label ?? '') : run.lines
			};
		case 'item': {
			const id = String(e.data?.[key] ?? Object.keys(run.items).length);
			const items = { ...run.items };
			if (e.op === 'remove') delete items[id];
			else items[id] = { ...items[id], ...e.data };
			return {
				...run,
				items,
				lines: e.op === 'add' ? line(`Found ${describe(e.data, key)}.`, 'good') : run.lines
			};
		}
		case 'warning':
			return { ...run, lines: line(e.message, 'warn') };
		case 'awaiting_user': {
			const { props, required } = answerSchema(e.response_schema);
			return {
				...run,
				state: Object.keys(props).length ? 'waiting' : run.state,
				lines: line(e.prompt, 'warn'),
				prompt: Object.keys(props).length
					? { text: e.prompt, fields: paramFields({ id: '', label: '', params: props }), required }
					: undefined
			};
		}
		case 'complete':
			return {
				...run,
				state: 'done',
				percent: 100,
				prompt: undefined,
				result: e.data,
				lines: line('Done.', 'good')
			};
		case 'error':
			return {
				...run,
				state: 'failed',
				prompt: undefined,
				lines: line(
					e.data?.reason === 'plugin_offline' ? 'The plugin stopped answering.' : e.message,
					'bad'
				)
			};
		case 'canceled':
			return { ...run, state: 'canceled', prompt: undefined, lines: line('Cancelled.') };
		case 'timeout':
			return {
				...run,
				state: 'timed out',
				prompt: undefined,
				lines: line('It took too long and was stopped.', 'bad')
			};
		default:
			return run;
	}
}

/**
 * What a question asks for: JSON-schema style (`properties`, `required`), or
 * a map of the fields themselves, each saying whether it's `required`.
 */
function answerSchema(schema: Record<string, unknown> | undefined): {
	props: Record<string, ParamSchema>;
	required: string[];
} {
	if (!schema) return { props: {}, required: [] };
	if (schema.properties && typeof schema.properties === 'object')
		return {
			props: schema.properties as Record<string, ParamSchema>,
			required: Array.isArray(schema.required) ? (schema.required as string[]) : []
		};
	const props = Object.fromEntries(
		Object.entries(schema).filter(([, v]) => v !== null && typeof v === 'object')
	) as Record<string, ParamSchema & { required?: boolean }>;
	return {
		props,
		required: Object.entries(props)
			.filter(([, v]) => v.required === true)
			.map(([k]) => k)
	};
}

export const finished = (r: Run) => r.state !== 'running' && r.state !== 'waiting';

function describe(data: Record<string, unknown>, key: string): string {
	const name = data.name ?? data.label ?? data.title;
	return typeof name === 'string' ? name : `${data[key] ?? 'something'}`;
}

// ---- logs ----

export interface LogLine {
	timestamp: string;
	level: string;
	target?: string;
	message: string;
	plugin_id?: string;
}

export const LEVELS = ['error', 'warn', 'info', 'debug', 'trace'] as const;
