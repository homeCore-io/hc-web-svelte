/**
 * Running the system's calls to homeCore (A6): status and versions, the log
 * level, logs, events, the audit, backups and restore, restarting, and
 * calendars — and the UI server's own documents, which a homeCore backup
 * doesn't hold.
 */
import { putConfig, restart } from './config.js';
import type { AuditEntry, LogLine } from './system.js';
import type { Latest } from './updates.js';

export type Answer<T> =
	{ ok: true; data: T } | { ok: false; error: string; status?: number; body?: unknown };

async function call<T>(
	method: string,
	path: string,
	body?: unknown,
	init: RequestInit = {}
): Promise<Answer<T>> {
	let res: Response;
	try {
		res = await fetch(path.startsWith('/ui/') ? path : `/api/v1${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			...init
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
	const said = data as { error?: unknown } | null;
	if (res.status === 403 || (res.status === 401 && typeof said?.error !== 'string'))
		return { ok: false, error: "You aren't allowed to do this.", status: res.status };
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

export interface Status {
	version: string;
	uptime_seconds: number;
	started_at: string;
	rules_total: number;
	rules_enabled: number;
	devices_total: number;
	plugins_active: number;
	state_db_bytes: number;
	history_db_bytes: number;
	timezone: string;
	last_backup_at: string | null;
}

export const loadStatus = () => call<Status>('GET', '/system/status');
export const loadVersions = () => call<Record<string, unknown>>('GET', '/system/versions');
/** Newer releases, as the UI server last heard from GitHub. */
export const loadUpdates = () =>
	call<{ off?: true; core?: Latest; app?: Latest }>('GET', '/ui/updates');

// ---- the log level ----

export const loadLevel = () => call<{ level: string }>('GET', '/system/log-level');
export const setLevel = (level: string) =>
	call<{ ok: boolean; level: string }>('PUT', '/system/log-level', { level });
/** Keep it after a restart: homecore.toml's `[logging].level`. */
/**
 * Keep a level for after a restart: everything's level, and each module's —
 * replacing the modules kept before (`was`), which a null removes.
 */
export const keepLevel = (
	level: string,
	targets: Record<string, string> = {},
	was: Record<string, unknown> = {}
) => {
	const modules: Record<string, string | null> = {};
	for (const k of Object.keys(was)) if (!(k in targets)) modules[k] = null;
	Object.assign(modules, targets);
	return putConfig({
		patch: {
			logging: { level },
			...(Object.keys(modules).length ? { 'logging.targets': modules } : {})
		}
	});
};

// ---- who's connected ----

export interface Connection {
	connection_id: string;
	endpoint: 'events_stream' | 'logs_stream' | string;
	client_id?: string | null;
	ip: string;
	user: string;
	user_agent?: string | null;
	connected_at: string;
}
export const loadConnections = () =>
	call<{ count: number; connections: Connection[] }>('GET', '/ws/connections');

/** "Firefox on Linux" from a user agent; the raw words when it can't tell. */
export function browserOf(ua: string | null | undefined): string {
	if (!ua) return 'something unnamed';
	const b = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\//.test(ua)
			? 'Firefox'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: /node|undici/i.test(ua)
						? 'the app’s server'
						: null;
	const os = /iPhone|iPad/.test(ua)
		? 'iOS'
		: /Android/.test(ua)
			? 'Android'
			: /Mac OS X/.test(ua)
				? 'a Mac'
				: /Windows/.test(ua)
					? 'Windows'
					: /Linux/.test(ua)
						? 'Linux'
						: null;
	return b ? (os ? `${b} on ${os}` : b) : ua.slice(0, 40);
}

// ---- logs and events ----

export function loadLogs(q: { since?: string; limit?: number; level?: string }) {
	const params = new URLSearchParams({ level: q.level ?? 'debug', limit: String(q.limit ?? 500) });
	if (q.since) params.set('since', q.since);
	return call<{ count: number; lines: LogLine[] }>('GET', `/logs?${params}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loadEvents = (limit = 500) =>
	call<{ seq: number; event_type: string; device_id?: string; event: any }[]>(
		'GET',
		`/events?limit=${limit}`
	);

// ---- the audit ----

/** What homeCore filters the audit by itself — across all of it, not a loaded page. */
export interface AuditAsk {
	limit?: number;
	/** Older than this (homeCore's `to`). */
	before?: string;
	/** Since this (homeCore's `from`). */
	since?: string;
	actor_id?: string;
	result?: 'success' | 'denied' | 'error';
	/** An event type; `auth.*` a kind of them, `!auth.*` all but (homeCore 0.1.82). */
	event_type?: string;
	/** One thing: a device, a rule, a key — everything recorded about it. */
	target_kind?: string;
	target_id?: string;
}

export function loadAudit(q: AuditAsk = {}) {
	const params = new URLSearchParams({ limit: String(q.limit ?? 500) });
	if (q.before) params.set('to', q.before);
	if (q.since) params.set('from', q.since);
	if (q.actor_id) params.set('actor_id', q.actor_id);
	if (q.result) params.set('result', q.result);
	if (q.event_type) params.set('event_type', q.event_type);
	if (q.target_kind) params.set('target_kind', q.target_kind);
	if (q.target_id) params.set('target_id', q.target_id);
	return call<AuditEntry[]>('GET', `/audit?${params}`);
}

/**
 * Refused and failed together — homeCore's `result` takes one value, so two
 * asks, merged newest first and cut to the page.
 */
export async function loadRefused(q: Omit<AuditAsk, 'result'>) {
	const [a, b] = await Promise.all([
		loadAudit({ ...q, result: 'denied' }),
		loadAudit({ ...q, result: 'error' })
	]);
	if (!a.ok) return a;
	if (!b.ok) return b;
	const all = [...a.data, ...b.data].sort((x, y) => Date.parse(y.ts) - Date.parse(x.ts));
	return { ok: true as const, data: all.slice(0, q.limit ?? 500) };
}

// ---- backups ----

/** Take a backup and hand it to the browser to save. */
export async function backUp(): Promise<Answer<{ filename: string; bytes: number }>> {
	let res: Response;
	try {
		res = await fetch('/api/v1/system/backup', { method: 'POST' });
	} catch {
		return { ok: false, error: 'homeCore is not answering.' };
	}
	if (!res.ok) {
		const said = (await res.json().catch(() => ({}))) as { error?: string };
		return {
			ok: false,
			status: res.status,
			error: said.error ?? `homeCore said no (${res.status}).`
		};
	}
	const blob = await res.blob();
	const filename =
		/filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
		'homecore-backup.zip';
	save(blob, filename);
	return { ok: true, data: { filename, bytes: blob.size } };
}

/** Backups homeCore makes by itself, kept on the house (core 0.1.83). */
export interface KeptBackups {
	every_hours: number;
	keep: number;
	dir: string | null;
	backups: { name: string; bytes: number; created_at: string }[];
}
export const loadKept = () => call<KeptBackups>('GET', '/system/backups');

/** Hand one kept backup to the browser to save. */
export async function downloadKept(name: string): Promise<Answer<{ filename: string }>> {
	let res: Response;
	try {
		res = await fetch(`/api/v1/system/backups/${encodeURIComponent(name)}`);
	} catch {
		return { ok: false, error: 'homeCore is not answering.' };
	}
	if (!res.ok) return { ok: false, status: res.status, error: 'That backup is gone.' };
	save(await res.blob(), name);
	return { ok: true, data: { filename: name } };
}

/** How often, said as a person would. */
export const everySaid = (hours: number) =>
	hours % 24 === 0
		? hours === 24
			? 'once a day'
			: hours === 168
				? 'once a week'
				: `every ${hours / 24} days`
		: hours === 1
			? 'every hour'
			: `every ${hours} hours`;

/** The UI server's own documents — pages, people's Homes, displays — saved too. */
export async function backUpApp(): Promise<Answer<{ filename: string; bytes: number }>> {
	const r = await call<unknown>('GET', '/ui/backup');
	if (!r.ok) return r;
	const text = JSON.stringify(r.data, null, '\t');
	const filename = `hc-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
	save(new Blob([text], { type: 'application/json' }), filename);
	return { ok: true, data: { filename, bytes: text.length } };
}

function save(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface RestorePlan {
	restored: string[];
	skipped: string[];
	taken_at: string | null;
	staged?: boolean;
}

/** What a backup would put back — nothing changes. */
export const checkRestore = (file: Blob) =>
	call<RestorePlan>('POST', '/system/restore?check=true', undefined, {
		body: file,
		headers: { 'content-type': 'application/zip' }
	});

/** What a backup kept on the house would put back (core 0.1.84). */
export const checkKept = (name: string) =>
	call<RestorePlan>('POST', `/system/backups/${encodeURIComponent(name)}/restore?check=true`);
/** Stage a kept one for the next start. */
export const stageKept = (name: string) =>
	call<RestorePlan>('POST', `/system/backups/${encodeURIComponent(name)}/restore`);

/** Stage it for the next start. */
export const stageRestore = (file: Blob) =>
	call<RestorePlan>('POST', '/system/restore', undefined, {
		body: file,
		headers: { 'content-type': 'application/zip' }
	});

/** Put the UI server's documents back from an app backup. */
export const restoreApp = (doc: unknown) => call<{ restored: number }>('POST', '/ui/backup', doc);

// ---- restarting ----

/**
 * Restart homeCore and wait for it to be back — a new `started_at`, not just
 * an answer, since the old process answers for a moment after agreeing.
 * Resolves with how long it took, or an error.
 */
export async function restartAndWait(
	onWaiting?: (secs: number) => void,
	timeoutMs = 90_000
): Promise<Answer<{ secs: number }>> {
	const before = await loadStatus();
	const was = before.ok ? before.data.started_at : null;
	const err = await restart();
	if (err) return { ok: false, error: err };
	const t0 = Date.now();
	while (Date.now() - t0 < timeoutMs) {
		await new Promise((r) => setTimeout(r, 1000));
		onWaiting?.(Math.round((Date.now() - t0) / 1000));
		const now = await loadStatus();
		if (now.ok && now.data.started_at !== was)
			return { ok: true, data: { secs: Math.round((Date.now() - t0) / 1000) } };
	}
	return {
		ok: false,
		error:
			'homeCore hasn’t come back yet. Whatever runs it (systemd, Docker) should start it again — check there.'
	};
}

// ---- calendars ----

export interface Calendar {
	id: string;
	event_count: number;
	upcoming_count: number;
	source_url: string | null;
	fetched_at: string | null;
	/** How often it's fetched again; null when it isn't. Absent before homeCore 0.1.80. */
	refresh_hours?: number | null;
	loaded_at: string;
}

export const loadCalendars = () => call<Calendar[]>('GET', '/calendars');
export const addCalendar = (url: string, name?: string, refresh_hours?: number) =>
	call<{ calendar_id: string; event_count: number }>('POST', '/calendars/fetch', {
		url,
		...(name ? { name } : {}),
		...(refresh_hours ? { refresh_hours } : {})
	});
export const uploadCalendar = (content: string, name?: string) =>
	call<{ calendar_id: string; event_count: number }>('POST', '/calendars/upload', {
		content,
		...(name ? { name } : {})
	});
export const removeCalendar = (id: string) =>
	call<{ deleted: string; referencing_rules: { rule_id: string; rule_name: string }[] }>(
		'DELETE',
		`/calendars/${encodeURIComponent(id)}`
	);
export const calendarEvents = (id: string, limit = 5) =>
	call<{ events: { uid: string; summary: string; start: string; is_all_day: boolean }[] }>(
		'GET',
		`/calendars/${encodeURIComponent(id)}/events?limit=${limit}`
	);

// ---- rules and scenes on their own ----

export const exportScenes = () => call<unknown>('GET', '/scenes/export');
/** homeCore adds each as a new scene, whatever its id — so choose what to bring. */
export const importScenes = (scenes: unknown[]) =>
	call<{ imported: number }>('POST', '/scenes/import', scenes);
