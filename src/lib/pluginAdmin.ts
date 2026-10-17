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

export const install = (id: string, version?: string) =>
	call<{
		installed: string;
		version: string;
		reinstall: boolean;
		activated: boolean;
		note?: string;
	}>('POST', '/plugins/install', { id, ...(version ? { version } : {}) });

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

export interface Runtime {
	runtime_id: string;
	status: 'pending' | 'approved' | 'denied';
	capabilities?: { kind?: string; arch?: string };
	hostname?: string;
	code?: string;
	source_ip?: string;
	created_at?: string;
	last_seen_at?: string;
	plugin_id?: string;
}
export const loadRuntimes = () => call<{ runtimes: Runtime[] }>('GET', '/plugin-runtimes');
export const approveRuntime = (id: string) =>
	call<Runtime>('POST', `/plugin-runtimes/${encodeURIComponent(id)}/approve`);
export const denyRuntime = (id: string) =>
	call<Runtime>('POST', `/plugin-runtimes/${encodeURIComponent(id)}/deny`);
export const runtimeToken = () =>
	call<{ token: string; expires_at: string }>('POST', '/plugin-runtimes/tokens');

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
