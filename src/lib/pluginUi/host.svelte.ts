/**
 * The `host` a plugin's component is given (`@homecore/plugin-ui`, version 1):
 * its plugin's devices, live; commands and its actions; its settings; the
 * app's confirm and navigation; and the app's look. Scoped to the one plugin.
 */
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { devices } from '../devices.svelte.js';
import { displayName, type CoreDevice } from '../devices.js';
import { rooms } from '../rooms.svelte.js';
import { roomOf } from '../summary.js';
import { commands } from '../commands.svelte.js';
import { session } from '../me.svelte.js';
import { ask } from '../confirm.svelte.js';
import { openDevice } from '../popup.js';
import { lifecycle, loadConfig, runAction, saveConfig } from '../pluginAdmin.js';
import type { Device, Host, Result } from './types.js';
import kit from './kit.css?raw';

let sheet: CSSStyleSheet | undefined;
function theSheet(): CSSStyleSheet {
	if (!sheet) {
		sheet = new CSSStyleSheet();
		sheet.replaceSync(kit);
	}
	return sheet;
}

const view = (d: CoreDevice): Device => ({
	device_id: d.device_id,
	name: d.name,
	name_override: d.name_override ?? null,
	device_type: (d.device_type as string | undefined) ?? null,
	plugin_id: d.plugin_id ?? '',
	available: d.available !== false,
	room: roomOf(d, rooms.list)?.name ?? null,
	attributes: { ...d.attributes },
	last_seen: d.last_seen ?? null,
	sw_version: (d.sw_version as string | undefined) ?? null
});

const mine = (pluginId: string) =>
	Object.values(devices.byId)
		.filter((d) => d.plugin_id === pluginId)
		.sort((a, b) => displayName(a).localeCompare(displayName(b)))
		.map(view);

const storeUrl = (pluginId: string, key: string) =>
	`/ui/plugin-store/${encodeURIComponent(pluginId)}/${encodeURIComponent(key)}`;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function createHost(pluginId: string): Host {
	const owns = (id: string) => devices.byId[id]?.plugin_id === pluginId;
	const reply = async (
		action: string,
		params: Record<string, unknown>
	): Promise<Result<Record<string, unknown>>> => {
		const r = await runAction(pluginId, action, params);
		if (!r.ok) return fail(r.error);
		if (r.data.kind === 'reply') return { ok: true, data: r.data.reply };
		if (r.data.kind === 'busy') return fail('It is already doing that.');
		return { ok: true, data: { request_id: r.data.request_id } };
	};
	return {
		api: 1,
		pluginId,
		appVersion: __APP_VERSION__,
		me: {
			get name() {
				return session.me?.username ?? '';
			},
			get role() {
				return session.me?.role ?? '';
			},
			get isAdmin() {
				return session.isAdmin;
			},
			can: (scope: string) => session.isAdmin || session.can(scope)
		},
		devices: {
			list: () => mine(pluginId),
			get: (id) => (owns(id) ? view(devices.byId[id]!) : undefined),
			label: (d) => d.name_override || d.name,
			subscribe(f) {
				// Svelte's own reactivity, outside any component: called now
				// and whenever one of its devices changes.
				return $effect.root(() => {
					$effect(() => {
						f(mine(pluginId));
					});
				});
			},
			async history(id, attribute, opts = {}) {
				if (!owns(id)) return fail('Not one of this plugin’s devices.');
				const q = new URLSearchParams({ attribute, limit: String(opts.limit ?? 1000) });
				if (opts.from) q.set('from', opts.from);
				try {
					const r = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`);
					if (!r.ok) return fail(`homeCore said ${r.status}.`);
					const rows = (await r.json()) as { value: unknown; recorded_at: string }[];
					return {
						ok: true,
						data: rows
							.map((x) => ({ at: x.recorded_at, value: x.value }))
							.sort((a, b) => a.at.localeCompare(b.at))
					};
				} catch {
					return fail('homeCore is not answering.');
				}
			}
		},
		async command(deviceId, body) {
			if (!owns(deviceId)) return fail('Not one of this plugin’s devices.');
			return (await commands.send(deviceId, body))
				? { ok: true, data: undefined }
				: fail('It wasn’t sent.');
		},
		action: (id, params = {}) => reply(id, params),
		async query(id, params = {}) {
			try {
				const r = await fetch(`/api/v1/plugins/${encodeURIComponent(pluginId)}/query`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action: id, ...params })
				});
				const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
				return r.ok
					? { ok: true, data: body }
					: fail(String(body.error ?? `homeCore said ${r.status}.`));
			} catch {
				return fail('homeCore is not answering.');
			}
		},
		fetch: (path, init) => fetch(`/api/v1${path.startsWith('/') ? '' : '/'}${path}`, init),
		async upload(action, file, params = {}, name) {
			const q = new URLSearchParams(params);
			if (name ?? (file as File).name) q.set('name', name ?? (file as File).name);
			try {
				const r = await fetch(
					`/api/v1/plugins/${encodeURIComponent(pluginId)}/upload/${encodeURIComponent(action)}?${q}`,
					{ method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file }
				);
				const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
				if (!r.ok || body.status === 'error')
					return fail(String(body.error ?? `homeCore said ${r.status}.`));
				return { ok: true, data: body };
			} catch {
				return fail('homeCore is not answering.');
			}
		},
		store: {
			async get(key) {
				try {
					const r = await fetch(storeUrl(pluginId, key));
					if (r.status === 404) return { ok: true, data: undefined };
					const body = (await r.json().catch(() => ({}))) as { value?: unknown; error?: string };
					return r.ok ? { ok: true, data: body.value as never } : fail(body.error ?? `${r.status}`);
				} catch {
					return fail('The app is not answering.');
				}
			},
			async put(key, value) {
				try {
					const r = await fetch(storeUrl(pluginId, key), {
						method: 'PUT',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(value)
					});
					return r.ok ? { ok: true, data: undefined } : fail(`It wasn’t kept (${r.status}).`);
				} catch {
					return fail('The app is not answering.');
				}
			},
			async remove(key) {
				try {
					const r = await fetch(storeUrl(pluginId, key), { method: 'DELETE' });
					return r.ok ? { ok: true, data: undefined } : fail(`${r.status}`);
				} catch {
					return fail('The app is not answering.');
				}
			}
		},
		config: {
			async get() {
				const r = await loadConfig(pluginId);
				return r.ok ? { ok: true, data: r.data.config ?? {} } : fail(r.error);
			},
			async patch(section, values) {
				const r = await saveConfig(pluginId, { patch: { [section]: values } });
				return r.ok ? { ok: true, data: undefined } : fail(r.error);
			},
			async restartPlugin() {
				const r = await lifecycle(pluginId, 'restart');
				return r.ok ? { ok: true, data: undefined } : fail(r.error);
			}
		},
		ui: {
			confirm: (q) => ask({ ...q }),
			openDevice: (id) => openDevice(id, page.url),
			navigate: (href) => void goto(href)
		},
		theme: {
			get sheet() {
				return theSheet();
			},
			// The app's own choice (`data-theme`), else the system's.
			dark: () => getComputedStyle(document.documentElement).colorScheme.includes('dark')
		}
	};
}
