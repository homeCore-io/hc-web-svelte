import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	DEFAULT_DAYS,
	StillWatch,
	expired,
	fetchAndKeep,
	isStillsPath,
	keepDays,
	keepStill,
	keptOf,
	pluginFileUrl,
	stillName,
	stillsRequest,
	stillsTarget,
	sweep,
	takenAt
} from './stills.js';

const DAY = 86_400_000;
const fresh = () => mkdtemp(path.join(tmpdir(), 'hc-stills-'));

describe('kept camera stills, by name', () => {
	it('are under /ui/stills', () => {
		expect(isStillsPath('/ui/stills/cam_1')).toBe(true);
		expect(isStillsPath('/ui/stillsx')).toBe(false);
		expect(isStillsPath('/ui/pictures')).toBe(false);
	});

	it('are named by camera and when they were taken, and nothing that climbs', () => {
		expect(stillName('reolink_nvr_1', 1762891200123)).toBe('reolink_nvr_1/1762891200123.jpg');
		expect(stillName('../etc', 1)).toBeUndefined();
		expect(stillName('a..b', 1)).toBeUndefined();
		expect(stillName('.hidden', 1)).toBeUndefined();
		expect(stillName('a/b', 1)).toBeUndefined();
		expect(stillName('cam', 0)).toBeUndefined();
		expect(stillName('cam', 1.5)).toBeUndefined();
	});

	it('take their time from the plugin, else from its file name', () => {
		expect(takenAt('snap/cam-1.jpg', '2026-11-11T20:00:00Z', 5)).toBe(
			Date.parse('2026-11-11T20:00:00Z')
		);
		expect(takenAt('snap/cam-1762891200123.jpg', undefined, 5)).toBe(1762891200123);
		expect(takenAt('snap/cam.jpg', 'later', 5)).toBe(5);
	});

	it('are kept 7 days unless set', () => {
		expect(keepDays(undefined)).toBe(DEFAULT_DAYS);
		expect(DEFAULT_DAYS).toBe(7);
		expect(keepDays('14')).toBe(14);
		expect(keepDays('0')).toBe(7);
		expect(keepDays('2.5')).toBe(7);
		expect(keepDays('soon')).toBe(7);
	});

	it('are past their time once older than that', () => {
		const now = 100 * DAY;
		const names = [`${now - 8 * DAY}.jpg`, `${now - 6 * DAY}.jpg`, 'notes.txt', 'x.jpg'];
		expect(expired(names, now, 7 * DAY)).toEqual([`${now - 8 * DAY}.jpg`]);
	});

	it('asks for a camera’s list or one still, and nothing else', () => {
		expect(stillsTarget('/ui/stills/cam_1?from=5')).toEqual({ ok: true, cam: 'cam_1', from: 5 });
		expect(stillsTarget('/ui/stills/cam_1/123.jpg')).toEqual({
			ok: true,
			cam: 'cam_1',
			ms: 123,
			from: 0
		});
		expect(stillsTarget('/ui/stills').ok).toBe(false);
		expect(stillsTarget('/ui/stills/cam/../x.jpg').ok).toBe(false);
		expect(stillsTarget('/ui/stills/%2e%2e/1.jpg').ok).toBe(false);
		expect(stillsTarget('/ui/stills/cam/1.png').ok).toBe(false);
		expect(stillsTarget('/ui/stills/cam/1.jpg/more').ok).toBe(false);
	});

	it('reach a plugin’s file at homeCore, each part escaped', () => {
		expect(pluginFileUrl('http://core', 'hc-reolink', '/snap/a b.jpg')).toBe(
			'http://core/api/v1/plugins/hc-reolink/files/snap/a%20b.jpg'
		);
	});
});

describe('keeping and sweeping stills', () => {
	it('writes each once, and lists a camera’s from a time on', async () => {
		const dir = await fresh();
		expect(await keepStill(dir, 'cam', 2000, new Uint8Array([1, 2]))).toBe(true);
		expect(await keepStill(dir, 'cam', 2000, new Uint8Array([3]))).toBe(false);
		expect(await keepStill(dir, 'cam', 1000, new Uint8Array([4]))).toBe(true);
		expect(await keepStill(dir, '../x', 1000, new Uint8Array([4]))).toBe(false);
		expect([...(await readFile(path.join(dir, 'cam', '2000.jpg')))]).toEqual([1, 2]);
		expect(await keptOf(dir, 'cam')).toEqual([1000, 2000]);
		expect(await keptOf(dir, 'cam', 1500)).toEqual([2000]);
		expect(await keptOf(dir, 'nobody')).toEqual([]);
		expect(await readdir(path.join(dir, 'cam'))).not.toContainEqual(expect.stringMatching(/tmp$/));
	});

	it('removes what is past its time, and a camera’s folder left empty', async () => {
		const dir = await fresh();
		const now = 100 * DAY;
		await keepStill(dir, 'old', now - 8 * DAY, new Uint8Array([1]));
		await keepStill(dir, 'cam', now - 8 * DAY, new Uint8Array([1]));
		await keepStill(dir, 'cam', now - DAY, new Uint8Array([1]));
		// A write that died before its rename, a day and more ago.
		const tmp = path.join(dir, 'cam', 'x.jpg.abc.tmp');
		await writeFile(tmp, 'x');
		await utimes(tmp, new Date(now - 2 * DAY), new Date(now - 2 * DAY));
		await mkdir(path.join(dir, '.other'));
		expect(await sweep(dir, now, 7 * DAY)).toBe(2);
		expect((await readdir(dir)).sort()).toEqual(['.other', 'cam']);
		expect(await readdir(path.join(dir, 'cam'))).toEqual([`${now - DAY}.jpg`]);
		expect(await sweep(path.join(dir, 'none'), now, 7 * DAY)).toBe(0);
	});
});

describe('following homeCore for stills', () => {
	it('keeps each camera’s newest on connecting, then each new one', () => {
		const w = new StillWatch();
		const first = w.onFrame(
			{
				type: 'snapshot',
				devices: [
					{
						device_id: 'cam',
						plugin_id: 'hc-reolink',
						attributes: { snapshot: 'snap/cam-1000.jpg', snapshot_at: '1970-01-01T00:00:01Z' }
					},
					{ device_id: 'lamp', plugin_id: 'hc-hue', attributes: { on: true } }
				]
			},
			9
		);
		expect(first).toEqual([
			{ cam: 'cam', plugin: 'hc-reolink', file: 'snap/cam-1000.jpg', at: 1000 }
		]);
		const changed = (/** @type {Record<string, unknown>} */ current, changed = ['snapshot']) =>
			w.onFrame(
				{
					type: 'device_state_changed',
					timestamp: '1970-01-01T00:00:09Z',
					device_id: 'cam',
					current,
					changed
				},
				9
			);
		// The same still again, or another reading, keeps nothing.
		expect(changed({ snapshot: 'snap/cam-1000.jpg' })).toEqual([]);
		expect(
			changed({ snapshot: 'snap/cam-1000.jpg', person_detected: true }, ['person_detected'])
		).toEqual([]);
		expect(changed({ snapshot: 'snap/cam-1762891200123.jpg' })).toEqual([
			{ cam: 'cam', plugin: 'hc-reolink', file: 'snap/cam-1762891200123.jpg', at: 1762891200123 }
		]);
		// A camera added since: its plugin learned from its record.
		w.onFrame({ type: 'device_added', device: { device_id: 'new', plugin_id: 'hc-reolink' } }, 9);
		expect(
			w.onFrame(
				{
					type: 'device_state_changed',
					timestamp: 'x',
					device_id: 'new',
					current: { snapshot: 'snap/new.jpg' },
					changed: ['snapshot']
				},
				42
			)
		).toEqual([{ cam: 'new', plugin: 'hc-reolink', file: 'snap/new.jpg', at: 42 }]);
		expect(w.onFrame('nonsense', 1)).toEqual([]);
	});
});

describe('fetching and serving stills', () => {
	/** @type {import('node:http').Server | undefined} */
	let core;
	afterEach(() => core?.close());

	/** homeCore, as far as stills go: the plugin's files for a good token. */
	async function fakeCore() {
		/** @type {string[]} */
		const asked = [];
		core = createServer((req, res) => {
			asked.push(req.url ?? '');
			if (req.headers.authorization !== 'Bearer good') return void res.writeHead(401).end();
			if (req.url === '/api/v1/devices/cam')
				return void res
					.writeHead(200, { 'content-type': 'application/json' })
					.end(JSON.stringify({ plugin_id: 'hc-reolink' }));
			if (req.url === '/api/v1/plugins/hc-reolink/files/snap/cam-5.jpg')
				return void res.writeHead(200, { 'content-type': 'image/jpeg' }).end(Buffer.from([7, 7]));
			if (req.url === '/api/v1/plugins/hc-reolink/files/snap/page.jpg')
				return void res.writeHead(200, { 'content-type': 'text/html' }).end('<b>');
			res.writeHead(404).end();
		});
		await new Promise((r) => core?.listen(0, '127.0.0.1', () => r(undefined)));
		const a = /** @type {import('node:net').AddressInfo} */ (core.address());
		return { url: `http://127.0.0.1:${a.port}`, asked };
	}

	it('fetches a still with the server’s key and keeps it, once', async () => {
		const { url, asked } = await fakeCore();
		const dir = await fresh();
		const w = { cam: 'cam', plugin: undefined, file: 'snap/cam-5.jpg', at: 5 };
		expect(await fetchAndKeep({ core: url, dir, token: 'good' }, w)).toBe(true);
		expect([...(await readFile(path.join(dir, 'cam', '5.jpg')))]).toEqual([7, 7]);
		const n = asked.length;
		expect(await fetchAndKeep({ core: url, dir, token: 'good' }, w)).toBe(false);
		expect(asked.length).toBe(n);
		// Refused, or not a picture: nothing kept.
		expect(await fetchAndKeep({ core: url, dir, token: 'bad' }, { ...w, at: 6 })).toBe(false);
		expect(
			await fetchAndKeep(
				{ core: url, dir, token: 'good' },
				{ ...w, plugin: 'hc-reolink', file: 'snap/page.jpg', at: 7 }
			)
		).toBe(false);
		expect(await keptOf(dir, 'cam')).toEqual([5]);
	});

	it('shows them to nobody who isn’t signed in', async () => {
		const { url } = await fakeCore();
		const dir = await fresh();
		await keepStill(dir, 'cam', 5, new Uint8Array([1]));
		for (const [method, at] of [
			['GET', '/ui/stills/cam/5.jpg'],
			['GET', '/ui/stills/cam'],
			['POST', '/ui/stills/cam']
		]) {
			/** @type {{ status?: number, body?: string }} */
			const got = {};
			const req = /** @type {any} */ ({ method, url: at, headers: {}, socket: {} });
			const res = /** @type {any} */ ({
				writeHead: (/** @type {number} */ s) => (got.status = s),
				end: (/** @type {string} */ b) => (got.body = b)
			});
			await stillsRequest(req, res, url, dir);
			expect(got.status).toBe(401);
			expect(got.body).not.toContain('\u0001');
		}
	});
});
