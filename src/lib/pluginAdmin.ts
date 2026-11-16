/**
 * Plugins' calls to homeCore (A4): list, start and stop, settings, actions
 * and their streams, logs, install and uninstall, runtimes.
 */
import type { Descriptor } from './descriptor.js';
import type { LogLine, PluginRecord, RegistryPlugin, StreamEvent } from './plugins.js';

export type Answer<T> =
	{ ok: true; data: T } | { ok: false; error: string; status?: number; body?: unknown };

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
	const text = await res.text();
	let data: unknown = text;
	try {
		data = text === '' ? null : JSON.parse(text);
	} catch {
		// homeCore's own words, as text.
	}
	if (res.ok) return { ok: true, data: data as T };
	if (res.status === 401 || res.status === 403)
		return { ok: false, error: "You aren't allowed to do this.", status: res.status };
	const said = data as { error?: unknown } | null;
	return {
		ok: false,
		status: res.status,
		body: data,
		error:
			typeof said?.error === 'string'
				? said.error
				: typeof data === 'string' && data.trim()
					? data.trim()
					: `homeCore said no (${res.status}).`
	};
}

const one = (id: string) => `/plugins/${encodeURIComponent(id)}`;

export const loadPlugins = () => call<PluginRecord[]>('GET', '/plugins');
export const loadStatus = () => call<PluginRecord[]>('GET', '/plugins/status');
export const loadPlugin = (id: string) => call<PluginRecord>('GET', one(id));
export const loadRegistry = () => call<{ plugins: RegistryPlugin[] }>('GET', '/registry/plugins');

export const lifecycle = (id: string, what: 'start' | 'stop' | 'restart') =>
	call<{ ok: boolean }>('POST', `${one(id)}/${what}`);

/** Turn it on or off for good (homeCore keeps it across restarts). */
export const setEnabled = (id: string, enabled: boolean) =>
	call<PluginRecord>('PATCH', one(id), { enabled });

/** How much it logs — until it restarts; homeCore doesn't keep it. */
export const setLogLevel = (id: string, log_level: string) =>
	call<PluginRecord>('PATCH', one(id), { log_level });

export interface Uninstalled {
	devices_removed: number;
	affected_rules: string[];
	config_removed: boolean;
}
export const uninstall = (id: string, keepConfig: boolean) =>
	call<Uninstalled>('DELETE', `${one(id)}?keep_config=${keepConfig}`);

export const removeDevices = (id: string) =>
	call<{ deleted: number; affected_rules: string[] }>('DELETE', `${one(id)}/devices`);

export interface Installed {
	installed: string;
	version: string;
	reinstall: boolean;
	activated: boolean;
	note?: string;
}
/** Sent to a plugin runtime instead (202): it installs it on its next check-in. */
export interface Placed {
	placed_on: string;
	plugin_id: string;
	version: string;
	note?: string;
}
export const install = (id: string, version?: string, runtimeId?: string) =>
	call<Installed | Placed>('POST', '/plugins/install', {
		id,
		...(version ? { version } : {}),
		...(runtimeId ? { runtime_id: runtimeId } : {})
	});
export const wasPlaced = (r: Installed | Placed): r is Placed => 'placed_on' in r;
/**
 * homeCore's 409 when more than one runtime could run it: the runtimes to
 * choose from, or nothing when the refusal was something else.
 */
export function runtimesToChoose(r: Answer<unknown>): string[] {
	if (r.ok || r.status !== 409) return [];
	const ids = (r.body as { runtimes?: unknown } | null)?.runtimes;
	return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

// ---- settings ----

export interface PluginConfig {
	format: 'toml' | 'remote';
	raw?: string;
	config?: Record<string, unknown>;
	config_error?: string;
}
export const loadConfig = (id: string) => call<PluginConfig>('GET', `${one(id)}/config`);
export const loadDescriptor = (id: string) =>
	call<{ descriptor: Descriptor }>('GET', `${one(id)}/config/descriptor`);

export const loadSchema = (id: string) =>
	call<{ schema: Record<string, unknown> }>('GET', `${one(id)}/config/schema`);

export type ConfigWrite =
	| { patch: Record<string, Record<string, unknown>> }
	| { array_of_tables: { section: string; items: unknown[] } }
	| { raw: string };
export const saveConfig = (id: string, body: ConfigWrite) =>
	call<{ ok: boolean }>('PUT', `${one(id)}/config`, body);

// ---- actions ----

export type Started =
	| { kind: 'stream'; request_id: string }
	| { kind: 'reply'; reply: Record<string, unknown> }
	| { kind: 'busy'; request_id?: string };

/** Run an action: a reply, or a stream to follow. */
export async function runAction(
	id: string,
	action: string,
	params: Record<string, unknown>
): Promise<Answer<Started>> {
	const res = await call<Record<string, unknown>>('POST', `${one(id)}/command`, {
		action,
		...params
	});
	if (!res.ok) {
		if (res.status === 409) {
			const b = res.body as { active_request_id?: string } | undefined;
			return { ok: true, data: { kind: 'busy', request_id: b?.active_request_id } };
		}
		return res;
	}
	const reply = res.data ?? {};
	if (reply.status === 'accepted' && typeof reply.request_id === 'string')
		return { ok: true, data: { kind: 'stream', request_id: reply.request_id } };
	// A reply that says it failed comes back as success; it isn't one.
	if (reply.status === 'error')
		return {
			ok: false,
			error: typeof reply.error === 'string' ? reply.error : 'The plugin said no.'
		};
	return { ok: true, data: { kind: 'reply', reply } };
}

export const cancelAction = (id: string, requestId: string) =>
	call<unknown>('POST', `${one(id)}/command`, { action: 'cancel', target_request_id: requestId });

export const answerAction = (id: string, requestId: string, response: Record<string, unknown>) =>
	call<unknown>('POST', `${one(id)}/command`, {
		action: 'respond',
		target_request_id: requestId,
		response
	});

/** Follow an action's stream; returns the way to stop listening. */
export function follow(
	id: string,
	requestId: string,
	on: (e: StreamEvent) => void,
	onClose: () => void
): () => void {
	const source = new EventSource(
		`/api/v1${one(id)}/command/${encodeURIComponent(requestId)}/stream`
	);
	const seen = new Set<string>();
	source.addEventListener('stream', (m) => {
		let e: StreamEvent;
		try {
			e = JSON.parse((m as MessageEvent).data) as StreamEvent;
		} catch {
			return;
		}
		const key = `${e.stage}:${e.ts ?? ''}`;
		if (seen.has(key)) return;
		seen.add(key);
		on(e);
		if (['complete', 'error', 'canceled', 'timeout'].includes(e.stage)) {
			source.close();
			onClose();
		}
	});
	// homeCore closes the stream after the last event; the browser would
	// reconnect and replay — don't.
	source.onerror = () => {
		if (source.readyState !== EventSource.OPEN) {
			source.close();
			onClose();
		}
	};
	return () => source.close();
}

// ---- logs ----

export const loadLogs = (id: string, level: string, limit = 300) =>
	call<{ lines: LogLine[] }>(
		'GET',
		`/logs?plugin_id=${encodeURIComponent(id)}&level=${encodeURIComponent(level)}&limit=${limit}`
	);

// ---- runtimes ----

/** A runtime as homeCore lists it. Never carries its password. */
export interface Runtime {
	runtime_id: string;
	name: string;
	kind: string;
	abi: string;
	/** Its plugin id in homeCore, and its broker username. */
	plugin_id: string;
	homecore_url: string;
	created_at: string;
	/** Reported when it connects. */
	arch?: string;
	host_version?: string;
	hostname?: string;
	network_mode?: string;
	source_ip?: string;
	/** Its own page: the port inside its container, and an address the operator set. Host 0.2.1+. */
	page_port?: number;
	page_url?: string;
	last_seen_at?: string;
	/** The most plugins it may hold; absent means no limit. */
	max_plugins?: number;
	/** Older than this homeCore expects: pull the newer image and restart it. */
	outdated?: boolean;
	/** The oldest runtime host this homeCore works with. */
	min_host_version?: string;
}
/** What is inside a connection key. */
export interface RuntimeKeyDetails {
	url: string;
	broker_host: string;
	broker_port: number;
	runtime_id: string;
	username: string;
	secret: string;
	kind: string;
	abi: string;
}
/** Returned once, when a runtime is added or its login reset. */
export interface IssuedKey {
	runtime: Runtime;
	key: string;
	details: RuntimeKeyDetails;
}
export interface BrokerStatus {
	host: string;
	port: number;
	reachable_from_network: boolean;
	can_open: boolean;
}
export const loadRuntimes = () => call<{ runtimes: Runtime[] }>('GET', '/plugin-runtimes');
export const addRuntime = (body: {
	name: string;
	kind?: string;
	homecore_url: string;
	max_plugins?: number;
}) => call<IssuedKey>('POST', '/plugin-runtimes', body);
export const updateRuntime = (id: string, body: { name?: string; max_plugins?: number | null }) =>
	call<Runtime>('PATCH', `/plugin-runtimes/${encodeURIComponent(id)}`, body);
export const resetRuntime = (id: string) =>
	call<IssuedKey>('POST', `/plugin-runtimes/${encodeURIComponent(id)}/reset`);
export const removeRuntime = (id: string) =>
	call<{ removed: string; plugins_removed: string[] }>(
		'DELETE',
		`/plugin-runtimes/${encodeURIComponent(id)}`
	);
export const loadBroker = () => call<BrokerStatus>('GET', '/plugin-runtimes/broker');
export const openBroker = () =>
	call<{ restart_required: boolean }>('POST', '/plugin-runtimes/broker/open');
/** Which plugins run on which runtime. homeCore without runtimes answers 404: none. */
export interface Placement {
	runtime_id: string;
	plugin_id: string;
	version: string;
	placed_at: string;
}
export async function loadPlacements(): Promise<Answer<Placement[]>> {
	const r = await call<{ placements: Placement[] }>('GET', '/plugin-runtimes/placements');
	if (r.ok) return { ok: true, data: r.data.placements ?? [] };
	return r.status === 404 ? { ok: true, data: [] } : r;
}
export const runtimeName = (r: Runtime | undefined, id: string) => r?.name ?? id;

// ---- Matter (the Matter plugin's controller) ----

export interface MatterNode {
	node_id: string;
	name?: string;
	vendor?: string;
	product?: string;
	[k: string]: unknown;
}
export const matterNodes = () => call<{ nodes: MatterNode[] }>('GET', '/plugins/matter/nodes');
export const commission = (passcode: number, discriminator?: number) =>
	call<unknown>('POST', '/plugins/matter/commission', {
		passcode,
		...(discriminator !== undefined ? { discriminator } : {})
	});
export const reinterview = (node_id: string) =>
	call<unknown>('POST', '/plugins/matter/reinterview', { node_id });
export const removeNode = (node_id: string) =>
	call<unknown>('DELETE', `/plugins/matter/nodes/${encodeURIComponent(node_id)}`);

/** One plugin to bring up to a newer version. */
export interface Pending {
	id: string;
	name: string;
	version: string;
}
/** How one update went: the answer from homeCore, or why it didn't. */
export interface Updated {
	plugin: Pending;
	error?: string;
}
/**
 * Every plugin with a newer version, one after another, so the house never
 * restarts them all at once. One that fails doesn't stop the rest. A plugin on
 * a runtime stays on that runtime, as its own Update keeps it.
 */
export async function updateAll(
	list: Pending[],
	step: (at: number, p: Pending) => void = () => {}
): Promise<Updated[]> {
	const placed = await loadPlacements();
	const on = (id: string) =>
		placed.ok ? placed.data.find((x) => x.plugin_id === id)?.runtime_id : undefined;
	const done: Updated[] = [];
	for (const [i, p] of list.entries()) {
		step(i, p);
		const r = await install(p.id, p.version, on(p.id));
		done.push(r.ok ? { plugin: p } : { plugin: p, error: r.error });
	}
	return done;
}
