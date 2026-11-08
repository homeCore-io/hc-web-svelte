import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { docs } from './docs.js';
import {
	changeLibrary,
	findUses,
	keepUpload,
	mayChange,
	parseFile,
	readLibrary,
	sees,
	sniff,
	stripUses,
	takeOff,
	urlOf,
	usesOf,
	type Item
} from './library.js';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4];
const MP4 = [0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0];
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0];

const SAM = '11111111-1111-4111-8111-111111111111';
const RILEY = '22222222-2222-4222-8222-222222222222';

const stream = (...chunks: number[][]) =>
	new ReadableStream<Uint8Array>({
		start(c) {
			for (const ch of chunks) c.enqueue(new Uint8Array(ch));
			c.close();
		}
	});

const item = (o: Partial<Item> = {}): Item => ({
	id: 'a'.repeat(24),
	ext: 'jpg',
	name: 'Garage',
	kind: 'picture',
	bytes: 10,
	owner: SAM,
	by: 'sam',
	at: '2026-11-08T00:00:00Z',
	shared: false,
	albums: [],
	sizes: {},
	...o
});
const sam = { id: SAM, username: 'sam', scopes: [] };
const riley = { id: RILEY, username: 'riley', scopes: [] };
const editor = { id: 'ed', username: 'ed', scopes: ['content:write'] };
const display = { id: 'hall', username: 'hall', scopes: [], display: true };

describe('the pictures library (design 15)', () => {
	it('takes pictures and MP4 or WebM videos by their first bytes, nothing else', () => {
		expect(sniff(new Uint8Array(PNG))).toBe('png');
		expect(sniff(new Uint8Array(MP4))).toBe('mp4');
		expect(sniff(new Uint8Array(WEBM))).toBe('webm');
		expect(sniff(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe(
			undefined
		);
	});

	it('reads only its own file names, an original or one of its copies', () => {
		const id = 'b'.repeat(24);
		expect(parseFile(`${id}.jpg`)).toEqual({ id, ext: 'jpg', size: undefined });
		expect(parseFile(`${id}.tile.webp`)).toEqual({ id, ext: 'webp', size: 'tile' });
		expect(parseFile('../library.json')).toBeUndefined();
		expect(parseFile(`${id}.svg`)).toBeUndefined();
	});

	it('shows one of someone’s own only to them, and everyone’s to all but changed by few (P5, P8)', () => {
		const own = item();
		expect(sees(own, sam)).toBe(true);
		expect(sees(own, riley)).toBe(false);
		expect(sees(own, editor)).toBe(false);
		const shared = item({ shared: true });
		expect(sees(shared, display)).toBe(true);
		expect(mayChange(shared, sam)).toBe(true);
		expect(mayChange(shared, riley)).toBe(false);
		expect(mayChange(shared, editor)).toBe(true);
		expect(mayChange(item({ shared: true, owner: null }), sam)).toBe(false);
		expect(mayChange(shared, { ...display, scopes: ['content:write'] })).toBe(false);
	});

	it('finds an address wherever a document holds it, and takes it out (P4)', () => {
		const url = urlOf(item());
		const doc = {
			rooms: { garage: { photo: url } },
			pages: {
				home: [{ op: 'config', ref: 'kind:picture/1', config: { src: `${url}?size=screen` } }]
			},
			frame: [url, 'other'],
			note: 'not /ui/pictures/x'
		};
		expect(findUses(doc, url)).toEqual([
			['rooms', 'garage', 'photo'],
			['pages', 'home', 0, 'config', 'src'],
			['frame', 0]
		]);
		expect(stripUses(doc, url)).toEqual({
			rooms: { garage: {} },
			pages: { home: [{ op: 'config', ref: 'kind:picture/1', config: {} }] },
			frame: ['other'],
			note: 'not /ui/pictures/x'
		});
	});
});

describe('the library on disk', () => {
	let dir = '';
	beforeEach(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'hc-pics-'));
		process.env.HC_DATA_DIR = dir;
	});
	afterEach(async () => {
		delete process.env.HC_DATA_DIR;
		await rm(dir, { recursive: true, force: true });
	});

	it('keeps an upload as it arrives, by its kind, under a new name', async () => {
		const kept = await keepUpload(stream(MP4.slice(0, 6), MP4.slice(6), [9, 9, 9]));
		expect(kept).toMatchObject({ ok: true, ext: 'mp4', bytes: 19 });
		const files = await readdir(path.join(dir, 'pictures'));
		expect(files).toEqual([`${(kept as { id: string }).id}.mp4`]);
	});

	it('refuses what isn’t ours, and leaves nothing behind', async () => {
		const kept = await keepUpload(stream([...new TextEncoder().encode('<svg xmlns="x"></svg>')]));
		expect(kept).toMatchObject({ ok: false, status: 415 });
		expect(await readdir(path.join(dir, 'pictures'))).toEqual([]);
	});

	it('takes pictures from before the library in as everyone’s', async () => {
		await mkdir(path.join(dir, 'pictures'), { recursive: true });
		await writeFile(path.join(dir, 'pictures', `${'c'.repeat(24)}.png`), new Uint8Array(PNG));
		const lib = await readLibrary();
		expect(lib.items['c'.repeat(24)]).toMatchObject({ shared: true, owner: null, kind: 'picture' });
	});

	it('says where each is used, counting only others’ own pages, and takes it off them all', async () => {
		const it = item({ shared: true });
		const url = urlOf(it);
		await changeLibrary((lib) => {
			lib.items[it.id] = it;
			return true;
		});
		await docs().write('house', 'household', { rooms: { garage: { photo: url } } }, 0);
		await docs().write('display', 'hall', { frame: { pictures: [url] } }, 0);
		await docs().write('person', SAM, { photo: url }, 0);
		await docs().write('person', RILEY, { pages: { mine: [{ config: { src: url } }] } }, 0);

		const uses = (await usesOf([it], sam)).get(it.id)!;
		expect(uses.uses.map((u) => u.in).sort()).toEqual(['display', 'house', 'person']);
		expect(uses.elsewhere).toBe(1);

		expect(await takeOff(it)).toBe(4);
		expect((await docs().read('house', 'household'))?.rooms).toEqual({ garage: {} });
		expect((await docs().read('person', SAM))?.photo).toBeUndefined();
		expect(findUses(await docs().read('person', RILEY), url)).toEqual([]);
	});
});
