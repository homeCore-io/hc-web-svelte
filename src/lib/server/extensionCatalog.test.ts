import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync, gzipSync, zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
	catalogPreview,
	installFromFile,
	installFromCatalog,
	remove,
	signedBy,
	catalogIndex
} from './extensionCatalog.js';
import { listExtensions } from './extensions.js';
import { safePath, unpack } from './unpack.js';

const enc = (s: string) => new TextEncoder().encode(s);

// ---- packing, as tar and zip tools do ----

function tar(files: { path: string; data: Uint8Array; type?: string }[]): Uint8Array {
	const blocks: Uint8Array[] = [];
	for (const f of files) {
		const h = new Uint8Array(512);
		h.set(enc(f.path).subarray(0, 100), 0);
		h.set(enc('0000644\0'), 100);
		h.set(enc(f.data.length.toString(8).padStart(11, '0') + '\0'), 124);
		h[156] = (f.type ?? '0').charCodeAt(0);
		h.set(enc('ustar\0'), 257);
		blocks.push(h, f.data, new Uint8Array((512 - (f.data.length % 512)) % 512));
	}
	blocks.push(new Uint8Array(1024));
	return Buffer.concat(blocks);
}

function zip(files: { path: string; data: Uint8Array; mode?: number }[]): Uint8Array {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let at = 0;
	for (const f of files) {
		const name = Buffer.from(f.path);
		const packed = deflateRawSync(f.data);
		const l = Buffer.alloc(30);
		l.writeUInt32LE(0x04034b50, 0);
		l.writeUInt16LE(8, 8);
		l.writeUInt32LE(packed.length, 18);
		l.writeUInt32LE(f.data.length, 22);
		l.writeUInt16LE(name.length, 26);
		const c = Buffer.alloc(46);
		c.writeUInt32LE(0x02014b50, 0);
		c.writeUInt16LE(8, 10);
		c.writeUInt32LE(packed.length, 20);
		c.writeUInt32LE(f.data.length, 24);
		c.writeUInt16LE(name.length, 28);
		c.writeUInt32LE(((f.mode ?? 0o100644) << 16) >>> 0, 38);
		c.writeUInt32LE(at, 42);
		locals.push(l, name, packed);
		centrals.push(c, name);
		at += 30 + name.length + packed.length;
	}
	const cd = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(files.length, 8);
	end.writeUInt16LE(files.length, 10);
	end.writeUInt32LE(cd.length, 12);
	end.writeUInt32LE(at, 16);
	return Buffer.concat([...locals, cd, end]);
}

const manifest = (id = 'hc-thermostat', version = '0.1.0') =>
	enc(
		JSON.stringify({
			id,
			name: 'Animated thermostat',
			version,
			values: 1,
			elements: [
				{ id: 'dial', kind: 'rive', label: 'Animated', draws: 'climate', file: 'thermostat.riv' }
			]
		})
	);
const thermostat = (id?: string, version?: string) => [
	{ path: 'extension.json', data: manifest(id, version) },
	{ path: 'thermostat.riv', data: enc('RIVE') }
];

describe('unpacking an extension', () => {
	it('reads .tar.zst, .tar.gz and .zip alike', () => {
		const want = thermostat().map((f) => f.path);
		expect(unpack(zstdCompressSync(tar(thermostat()))).map((f) => f.path)).toEqual(want);
		expect(unpack(gzipSync(tar(thermostat()))).map((f) => f.path)).toEqual(want);
		expect(unpack(zip(thermostat())).map((f) => f.path)).toEqual(want);
		expect(new TextDecoder().decode(unpack(zip(thermostat()))[1]!.data)).toBe('RIVE');
	});

	it('takes a folder packed as itself', () => {
		const inFolder = thermostat().map((f) => ({ ...f, path: `hc-thermostat/${f.path}` }));
		expect(unpack(zip(inFolder)).map((f) => f.path)).toEqual(['extension.json', 'thermostat.riv']);
	});

	it('refuses paths outside its folder, links, and what it can’t read', () => {
		expect(() => unpack(zip([{ path: '../x', data: enc('') }]))).toThrow(/outside/);
		expect(() => unpack(gzipSync(tar([{ path: '/etc/x', data: enc('') }])))).toThrow(/outside/);
		expect(() =>
			unpack(gzipSync(tar([{ path: 'link', data: new Uint8Array(), type: '2' }])))
		).toThrow(/other than files/);
		expect(() => unpack(zip([{ path: 'link', data: enc('/etc'), mode: 0o120777 }]))).toThrow(
			/link/
		);
		expect(() => unpack(enc('not a package'))).toThrow(/isn’t a/);
		expect(safePath('a/b.riv')).toBe(true);
		expect(safePath('a/../b')).toBe(false);
		expect(safePath('a\\b')).toBe(false);
	});
});

describe('the catalog', () => {
	const keys = generateKeyPairSync('ed25519');
	const pub = keys.publicKey
		.export({ format: 'der', type: 'spki' })
		.subarray(12)
		.toString('base64');
	const signed = (b: Uint8Array) => sign(null, b, keys.privateKey).toString('base64');
	const pkg = zstdCompressSync(tar(thermostat()));
	const sha = createHash('sha256').update(pkg).digest('hex');
	const indexOf = (sha256 = sha, values = 1) =>
		enc(
			JSON.stringify({
				schema: '1',
				extensions: [
					{
						id: 'hc-thermostat',
						name: 'Animated thermostat',
						description: '',
						category: 'Thermostats',
						versions: [
							{ version: '0.1.0', values, url: 'https://x/t.tar.zst', sha256 },
							{ version: '9.0.0', values: 99, url: 'https://x/future.tar.zst', sha256 }
						]
					}
				]
			})
		);
	const serve =
		(index: Uint8Array, sig = signed(index), file = pkg): typeof fetch =>
		async (u) => {
			const url = String(u);
			if (url.endsWith('.json')) return new Response(Buffer.from(index));
			if (url.endsWith('.json.sig')) return new Response(sig);
			if (url === 'https://x/t.tar.zst') return new Response(Buffer.from(file));
			return new Response('', { status: 404 });
		};
	const at = { url: 'https://r/extensions.json', key: pub };

	it('trusts only an index signed by its key', async () => {
		const idx = indexOf();
		expect(signedBy(idx, signed(idx), pub)).toBe(true);
		expect(signedBy(enc('changed'), signed(idx), pub)).toBe(false);
		await expect(catalogIndex(serve(idx, signed(enc('other'))), at)).rejects.toThrow(/signed/);
		// Versions expecting newer values than this app gives are left out.
		expect((await catalogIndex(serve(idx), at))[0]!.versions.map((v) => v.version)).toEqual([
			'0.1.0'
		]);
		const none: typeof fetch = async () => new Response('', { status: 404 });
		expect(await catalogIndex(none, at)).toEqual([]);
	});

	it('installs a version whose file matches its checksum, and removes it', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'hc-ext-'));
		await expect(
			installFromCatalog('hc-thermostat', '0.1.0', serve(indexOf('0'.repeat(64))), {
				index: at,
				dir
			})
		).rejects.toThrow(/checksum/);
		expect(await readdir(dir)).toEqual([]);

		await installFromCatalog('hc-thermostat', '0.1.0', serve(indexOf()), { index: at, dir });
		const [x] = await listExtensions(dir);
		expect(x?.installed?.from).toBe('catalog');
		expect(await readFile(path.join(dir, 'hc-thermostat', 'thermostat.riv'), 'utf8')).toBe('RIVE');

		expect(await remove('hc-thermostat', dir)).toBe(true);
		expect(await listExtensions(dir)).toEqual([]);
		expect(await remove('../etc', dir)).toBe(false);
	});

	it('installs from a file, replacing the version it had', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'hc-ext-'));
		await installFromFile(zip(thermostat()), dir);
		await installFromFile(zip(thermostat(undefined, '0.2.0')), dir);
		const list = await listExtensions(dir);
		expect(list.map((x) => [x.version, x.installed?.from])).toEqual([['0.2.0', 'file']]);
		expect((await readdir(dir)).filter((n) => n.startsWith('.'))).toEqual([]);
		await expect(
			installFromFile(zip([{ path: 'extension.json', data: manifest() }]), dir)
		).rejects.toThrow(/isn’t in it/);
		await expect(installFromFile(zip(thermostat('catalog')), dir)).rejects.toThrow(/can’t be/);
	});

	it('serves a release’s preview only when it matches the signed checksum', async () => {
		const movie = enc('a short film');
		const sum = createHash('sha256').update(movie).digest('hex');
		const index = (sha256: string) =>
			enc(
				JSON.stringify({
					extensions: [
						{
							id: 'hc-thermostat',
							name: 'T',
							description: '',
							category: '',
							versions: [
								{
									version: '0.1.0',
									values: 1,
									url: 'https://x/t.tar.zst',
									sha256: sha,
									preview: { url: 'https://x/t-preview.mp4', sha256 }
								}
							]
						}
					]
				})
			);
		const site =
			(idx: Uint8Array): typeof fetch =>
			async (u) => {
				const url = String(u);
				if (url.endsWith('.json')) return new Response(Buffer.from(idx));
				if (url.endsWith('.json.sig')) return new Response(signed(idx));
				if (url.endsWith('preview.mp4')) return new Response(Buffer.from(movie));
				return new Response('', { status: 404 });
			};
		const got = await catalogPreview('hc-thermostat', '0.1.0', site(index(sum)), at);
		expect(got?.type).toBe('video/mp4');
		expect(new TextDecoder().decode(got?.bytes)).toBe('a short film');
		expect(
			await catalogPreview('hc-thermostat', '0.1.0', site(index('f'.repeat(64))), at)
		).toBeUndefined();
		expect(await catalogPreview('hc-thermostat', '9.9.9', site(index(sum)), at)).toBeUndefined();
	});
});
