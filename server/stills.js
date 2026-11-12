/**
 * Camera stills, kept here for a week (C7).
 *
 * The Reolink plugin takes a still as each detection starts, but keeps only
 * its newest few per camera, so by evening most of the day's events have
 * lost theirs. Pictures belong to the UI server, never to homeCore, so this
 * server copies each still into its own data the moment the camera takes it,
 * and the Cameras pages show the copy.
 *
 * - **How it hears.** homeCore's event stream, followed with a credential of
 *   the server's own: an API key holding only `devices:read`
 *   (`HC_STILLS_KEY`, or a file holding it, `HC_STILLS_KEY_FILE`). That one
 *   scope reads the stream's device frames, the camera's record and the
 *   plugin's files, and can change nothing. Without a key, a signed-in page
 *   that sees a new still asks for it to be kept (`POST`), and this server
 *   fetches it with that person's session: stills are then kept only while
 *   someone has a camera page open.
 * - **Where.** `<HC_DATA_DIR>/camera-stills/<camera>/<taken ms>.jpg`, written
 *   to a temporary file and renamed, so a half-written still is never shown.
 * - **How long.** `HC_STILLS_DAYS` days (7 unless set), swept on startup and
 *   daily after.
 * - **Who sees them.** Only someone signed in, checked with homeCore as live
 *   video is (`video.js`). They are in no backup.
 */
import { mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataDir } from './config.js';
import { isSecure, signedIn } from './video.js';
import { originAllowed } from './proxy.js';
import { resolveSession } from './session.js';

export const PREFIX = '/ui/stills';
export const DEFAULT_DAYS = 7;
const DAY_MS = 86_400_000;
/** The largest still kept: homeCore passes on no larger. */
const MAX_BYTES = 4 * 1024 * 1024;
const FETCH_MS = 15_000;
/** How often to look for a key when there's none. */
const NO_KEY_MS = 5 * 60_000;

/** A camera's id as a folder name: nothing that climbs or hides. */
const CAM = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const FILE = /^(\d{1,15})\.jpg$/;

/** @param {string | undefined} url */
export function isStillsPath(url) {
	return url !== undefined && (url === PREFIX || url.startsWith(`${PREFIX}/`));
}

/** The folder kept stills live in. */
export function stillsDir(root = dataDir()) {
	return path.join(root, 'camera-stills');
}

/**
 * How many days a still is kept: `HC_STILLS_DAYS`, a whole number from 1 to
 * 365, else 7.
 * @param {string | undefined} [value]
 */
export function keepDays(value = process.env.HC_STILLS_DAYS) {
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 && n <= 365 ? n : DEFAULT_DAYS;
}

/**
 * A kept still's name under the folder: `<camera>/<ms>.jpg`, or undefined
 * when the camera or the time can't make a safe one.
 * @param {string} cam
 * @param {number} ms
 */
export function stillName(cam, ms) {
	if (!CAM.test(cam) || cam.includes('..') || !Number.isSafeInteger(ms) || ms <= 0)
		return undefined;
	return `${cam}/${ms}.jpg`;
}

/**
 * When a still was taken, in ms: what the plugin said (`snapshot_at`), else
 * the time in its file's name (`snap/<camera>-<ms>.jpg`), else `fallback`.
 * @param {string} file
 * @param {unknown} takenAt
 * @param {number} fallback
 */
export function takenAt(file, takenAt, fallback) {
	const said = typeof takenAt === 'string' ? Date.parse(takenAt) : NaN;
	if (Number.isFinite(said) && said > 0) return Math.floor(said);
	const m = /-(\d{10,15})\.(jpe?g|png|webp)$/i.exec(file);
	if (m) return Number(m[1]);
	return Math.floor(fallback);
}

/**
 * The kept stills past their time, of `names` (a camera's files).
 * @param {string[]} names
 * @param {number} now
 * @param {number} maxAgeMs
 */
export function expired(names, now, maxAgeMs) {
	return names.filter((n) => {
		const m = FILE.exec(n);
		return m !== null && now - Number(m[1]) > maxAgeMs;
	});
}

/** @param {unknown} e */
const missing = (e) => /** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT';

/**
 * Keep a still, unless it already is. Reports whether it was written.
 * @param {string} dir
 * @param {string} cam
 * @param {number} ms
 * @param {Uint8Array} bytes
 */
export async function keepStill(dir, cam, ms, bytes) {
	const name = stillName(cam, ms);
	if (name === undefined) return false;
	const file = path.join(dir, name);
	try {
		await stat(file);
		return false;
	} catch (e) {
		if (!missing(e)) throw e;
	}
	await mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.${randomUUID()}.tmp`;
	await writeFile(tmp, bytes);
	await rename(tmp, file);
	return true;
}

/**
 * Whether a still is already kept.
 * @param {string} dir
 * @param {string} cam
 * @param {number} ms
 */
export async function isKept(dir, cam, ms) {
	const name = stillName(cam, ms);
	if (name === undefined) return false;
	try {
		await stat(path.join(dir, name));
		return true;
	} catch {
		return false;
	}
}

/**
 * The times of a camera's kept stills from `from` on, oldest first.
 * @param {string} dir
 * @param {string} cam
 * @param {number} [from]
 * @returns {Promise<number[]>}
 */
export async function keptOf(dir, cam, from = 0) {
	if (stillName(cam, 1) === undefined) return [];
	try {
		const names = await readdir(path.join(dir, cam));
		return names
			.map((n) => FILE.exec(n))
			.filter((m) => m !== null)
			.map((m) => Number(m[1]))
			.filter((t) => t >= from)
			.sort((a, b) => a - b);
	} catch (e) {
		if (missing(e)) return [];
		throw e;
	}
}

/**
 * Remove every kept still older than `maxAgeMs`, and any camera's folder
 * left empty. Reports how many went.
 * @param {string} dir
 * @param {number} now
 * @param {number} maxAgeMs
 */
export async function sweep(dir, now, maxAgeMs) {
	let cams;
	try {
		cams = await readdir(dir, { withFileTypes: true });
	} catch (e) {
		if (missing(e)) return 0;
		throw e;
	}
	let gone = 0;
	for (const c of cams) {
		if (!c.isDirectory() || stillName(c.name, 1) === undefined) continue;
		const folder = path.join(dir, c.name);
		const names = await readdir(folder);
		for (const n of expired(names, now, maxAgeMs)) {
			await rm(path.join(folder, n), { force: true });
			gone += 1;
		}
		// A write that died between its temporary file and the rename.
		for (const n of names.filter((x) => x.endsWith('.tmp'))) {
			const s = await stat(path.join(folder, n)).catch(() => undefined);
			if (s && now - s.mtimeMs > DAY_MS) await rm(path.join(folder, n), { force: true });
		}
		if ((await readdir(folder)).length === 0) await rmdir(folder).catch(() => {});
	}
	return gone;
}

// ---- following homeCore ----

/**
 * @typedef {{ cam: string, plugin: string | undefined, file: string, at: number }} Wanted
 */

/**
 * What the event stream says to keep: the newest still of each camera on
 * connecting, and each new one as it's taken. Pure, so it can be tested; the
 * fetching is the caller's.
 */
export class StillWatch {
	constructor() {
		/** @type {Map<string, string | undefined>} each camera's plugin */
		this.plugins = new Map();
		/** @type {Map<string, string>} each camera's newest still */
		this.last = new Map();
	}

	/**
	 * @param {any} frame
	 * @param {number} now
	 * @returns {Wanted[]}
	 */
	onFrame(frame, now) {
		/** @type {Wanted[]} */
		const out = [];
		if (frame === null || typeof frame !== 'object') return out;
		switch (frame.type) {
			case 'snapshot': {
				if (!Array.isArray(frame.devices)) return out;
				for (const d of frame.devices) {
					const w = this.#device(d, now);
					if (w) out.push(w);
				}
				return out;
			}
			case 'device_added':
			case 'device_metadata_changed': {
				const d = frame.device;
				if (d && typeof d.device_id === 'string' && typeof d.plugin_id === 'string')
					this.plugins.set(d.device_id, d.plugin_id);
				return out;
			}
			case 'device_removed': {
				this.plugins.delete(frame.device_id);
				this.last.delete(frame.device_id);
				return out;
			}
			case 'device_state_changed': {
				const id = frame.device_id;
				const cur = frame.current ?? {};
				const file = cur.snapshot;
				if (typeof id !== 'string' || typeof file !== 'string' || file === '') return out;
				if (Array.isArray(frame.changed) && !frame.changed.includes('snapshot')) return out;
				if (this.last.get(id) === file) return out;
				this.last.set(id, file);
				const at = takenAt(file, cur.snapshot_at, Date.parse(frame.timestamp) || now);
				out.push({ cam: id, plugin: this.plugins.get(id), file, at });
				return out;
			}
			default:
				return out;
		}
	}

	/**
	 * @param {any} d
	 * @param {number} now
	 * @returns {Wanted | undefined}
	 */
	#device(d, now) {
		if (!d || typeof d.device_id !== 'string') return undefined;
		if (typeof d.plugin_id === 'string') this.plugins.set(d.device_id, d.plugin_id);
		const file = d.attributes?.snapshot;
		if (typeof file !== 'string' || file === '') return undefined;
		this.last.set(d.device_id, file);
		return {
			cam: d.device_id,
			plugin: d.plugin_id,
			file,
			at: takenAt(file, d.attributes?.snapshot_at, now)
		};
	}
}

/**
 * A plugin's file at homeCore.
 * @param {string} core
 * @param {string} plugin
 * @param {string} file
 */
export function pluginFileUrl(core, plugin, file) {
	const rel = file.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
	return `${core}/api/v1/plugins/${encodeURIComponent(plugin)}/files/${rel}`;
}

/**
 * Fetch a camera's still from homeCore with `token` and keep it. Reports
 * whether a new one was written.
 * @param {{ core: string, dir: string, token: string }} opts
 * @param {Wanted} w
 */
export async function fetchAndKeep({ core, dir, token }, w) {
	if (stillName(w.cam, w.at) === undefined || !/\.jpe?g$/i.test(w.file)) return false;
	if (await isKept(dir, w.cam, w.at)) return false;
	const auth = { authorization: `Bearer ${token}` };
	let plugin = w.plugin;
	if (plugin === undefined) {
		const r = await fetch(`${core}/api/v1/devices/${encodeURIComponent(w.cam)}`, {
			headers: auth,
			signal: AbortSignal.timeout(FETCH_MS)
		});
		if (!r.ok) return false;
		plugin = (await r.json())?.plugin_id;
		if (typeof plugin !== 'string') return false;
	}
	const r = await fetch(pluginFileUrl(core, plugin, w.file), {
		headers: auth,
		signal: AbortSignal.timeout(FETCH_MS)
	});
	if (!r.ok || !/^image\/jpe?g/i.test(r.headers.get('content-type') ?? '')) return false;
	const bytes = new Uint8Array(await r.arrayBuffer());
	if (bytes.length === 0 || bytes.length > MAX_BYTES) return false;
	return keepStill(dir, w.cam, w.at, bytes);
}

/** The server's own key, from `HC_STILLS_KEY` or the file `HC_STILLS_KEY_FILE` names. */
export async function stillsKey() {
	const direct = (process.env.HC_STILLS_KEY ?? '').trim();
	if (direct !== '') return direct;
	const file = process.env.HC_STILLS_KEY_FILE ?? '';
	if (file === '') return undefined;
	try {
		const k = (await readFile(file, 'utf8')).trim();
		return k === '' ? undefined : k;
	} catch {
		return undefined;
	}
}

/** Whether this server is following homeCore itself now, with its key. */
let watching = false;

/**
 * Keep stills from now on: the sweep on startup and daily, and, with a key,
 * homeCore's event stream followed. Returns the way to stop.
 * @param {{ core: string, dir?: string }} opts
 */
export function startStills({ core, dir = stillsDir() }) {
	let stopped = false;
	const days = keepDays();
	const doSweep = () =>
		void sweep(dir, Date.now(), days * DAY_MS).catch((e) =>
			console.warn(`camera stills: the sweep failed (${e?.code ?? 'error'})`)
		);
	doSweep();
	const daily = setInterval(doSweep, DAY_MS);
	daily.unref?.();

	/** @type {WebSocket | undefined} */
	let socket;
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;
	let retry = 0;

	const open = async () => {
		if (stopped) return;
		// Read each time, so a key put in place or changed is picked up.
		const key = await stillsKey();
		if (key === undefined) {
			// Looked for again in a while: a key can be put in place without a restart.
			timer = setTimeout(() => void open(), NO_KEY_MS);
			timer.unref?.();
			return;
		}
		const url = new URL(`${core}/api/v1/events/stream`);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		url.searchParams.set('snapshot', 'true');
		url.searchParams.set('client_id', 'hc-web-stills');
		url.searchParams.set('token', key);
		const watch = new StillWatch();
		/** @type {Promise<unknown>} one still at a time, in the order taken */
		let queue = Promise.resolve();
		const ws = new WebSocket(url);
		socket = ws;
		ws.onopen = () => {
			retry = 0;
			watching = true;
			console.log(`camera stills: following homeCore, kept ${days} days in ${dir}`);
		};
		ws.onmessage = (m) => {
			let frame;
			try {
				frame = JSON.parse(String(m.data));
			} catch {
				return;
			}
			for (const w of watch.onFrame(frame, Date.now())) {
				queue = queue
					.then(() => fetchAndKeep({ core, dir, token: key }, w))
					.catch(() => {
						// Missed: the plugin's own file stays until it rolls over.
					});
			}
		};
		ws.onclose = () => {
			if (socket !== ws) return;
			// Until it's back (or a key homeCore refuses), pages ask for stills to be kept.
			watching = false;
			if (stopped) return;
			const wait = Math.min(60_000, 1000 * 2 ** retry++);
			timer = setTimeout(() => void open(), wait);
			timer.unref?.();
		};
		// The URL holds the key, so nothing about the socket is logged.
		ws.onerror = () => {};
	};
	void open();

	return () => {
		stopped = true;
		clearInterval(daily);
		clearTimeout(timer);
		socket?.close();
	};
}

// ---- serving them ----

/**
 * What a `/ui/stills/…` request asks for.
 * @param {string} url
 * @returns {{ ok: true, cam: string, ms?: number, from: number } | { ok: false }}
 */
export function stillsTarget(url) {
	const u = new URL(url, 'http://x');
	// The path as sent, before a URL folds `..` away.
	const raw = url.split('?')[0] ?? '';
	if (!isStillsPath(raw)) return { ok: false };
	const parts = raw.slice(PREFIX.length).split('/').filter(Boolean);
	let cam;
	try {
		cam = decodeURIComponent(parts[0] ?? '');
	} catch {
		return { ok: false };
	}
	if (parts.length < 1 || parts.length > 2 || stillName(cam, 1) === undefined) return { ok: false };
	const from = Number(u.searchParams.get('from') ?? 0);
	const f = Number.isFinite(from) && from > 0 ? from : 0;
	if (parts.length === 1) return { ok: true, cam, from: f };
	const m = FILE.exec(parts[1] ?? '');
	if (!m) return { ok: false };
	return { ok: true, cam, ms: Number(m[1]), from: f };
}

/**
 * `GET /ui/stills/<camera>?from=<ms>`: the times of its kept stills.
 * `GET /ui/stills/<camera>/<ms>.jpg`: one of them.
 * `POST /ui/stills/<camera>`: keep its newest still now, fetched with the
 * asker's session (only when this server has no key of its own).
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} core
 * @param {string} [dir]
 */
export async function stillsRequest(req, res, core, dir = stillsDir()) {
	/** @param {number} status @param {unknown} body @param {string[]} [cookies] */
	const say = (status, body, cookies = []) => {
		/** @type {Record<string, string | string[]>} */
		const h = { 'content-type': 'application/json', 'cache-control': 'no-store' };
		if (cookies.length > 0) h['set-cookie'] = cookies;
		res.writeHead(status, h);
		res.end(JSON.stringify(body));
	};
	const t = stillsTarget(req.url ?? '');
	if (!t.ok) return say(404, { error: 'No such still.' });
	const secure = isSecure(req);

	if (req.method === 'POST' && t.ms === undefined) {
		if (!originAllowed('POST', req.headers)) return say(403, { error: 'Not from this app.' });
		const session = await resolveSession(req.headers.cookie, { core, secure });
		if (session === undefined) return say(401, { error: 'Not signed in.' });
		if (watching) return say(200, { kept: false, watching: true }, session.setCookies);
		try {
			// What homeCore says the camera's newest still is; nothing the page sent.
			const r = await fetch(`${core}/api/v1/devices/${encodeURIComponent(t.cam)}`, {
				headers: { authorization: `Bearer ${session.token}` },
				signal: AbortSignal.timeout(FETCH_MS)
			});
			if (!r.ok) return say(r.status === 401 ? 401 : 404, { error: 'No such camera.' });
			const d = await r.json();
			const file = d?.attributes?.snapshot;
			if (typeof file !== 'string' || file === '') return say(200, { kept: false });
			const kept = await fetchAndKeep(
				{ core, dir, token: session.token },
				{
					cam: t.cam,
					plugin: typeof d.plugin_id === 'string' ? d.plugin_id : undefined,
					file,
					at: takenAt(file, d.attributes?.snapshot_at, Date.now())
				}
			);
			return say(200, { kept }, session.setCookies);
		} catch {
			return say(502, { error: 'homeCore is not answering.' });
		}
	}

	if (req.method !== 'GET' && req.method !== 'HEAD') return say(405, { error: 'Only looking.' });
	if (!(await signedIn(req, core, secure))) return say(401, { error: 'Not signed in.' });
	if (t.ms === undefined) return say(200, { kept: await keptOf(dir, t.cam, t.from), watching });
	const name = stillName(t.cam, t.ms);
	if (name === undefined) return say(404, { error: 'No such still.' });
	let bytes;
	try {
		bytes = await readFile(path.join(dir, name));
	} catch {
		return say(404, { error: 'Not kept.' });
	}
	res.writeHead(200, {
		'content-type': 'image/jpeg',
		'content-length': String(bytes.length),
		// Named by when it was taken, so it never changes; the browser may keep it.
		'cache-control': 'private, max-age=604800, immutable',
		'x-content-type-options': 'nosniff',
		'content-security-policy': "default-src 'none'"
	});
	res.end(req.method === 'HEAD' ? undefined : bytes);
}
