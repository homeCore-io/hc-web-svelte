import { describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DocStore } from './store.js';

async function fresh() {
	return new DocStore(await mkdtemp(path.join(tmpdir(), 'hc-store-')));
}

describe('the document store', () => {
	it('keeps a document as a readable JSON file, versioned', async () => {
		const store = await fresh();
		const r = await store.write('person', 'abc', { favourites: ['device:lamp'] }, 0);
		expect(r).toMatchObject({ ok: true, doc: { version: 1, favourites: ['device:lamp'] } });
		const text = await readFile(path.join(store.root, 'person', 'abc.json'), 'utf8');
		expect(JSON.parse(text).favourites).toEqual(['device:lamp']);
		expect(await store.read('person', 'abc')).toMatchObject({ version: 1 });
		expect(await store.read('person', 'nobody')).toBeUndefined();
	});

	it('refuses a write from a stale version, handing back what is there', async () => {
		const store = await fresh();
		await store.write('person', 'abc', { n: 1 }, 0);
		const stale = await store.write('person', 'abc', { n: 2 }, 0);
		expect(stale).toMatchObject({ ok: false, current: { n: 1, version: 1 } });
		expect(await store.write('person', 'abc', { n: 2 }, 1)).toMatchObject({
			ok: true,
			doc: { version: 2 }
		});
	});

	it('judges writes that arrive together one after the other', async () => {
		const store = await fresh();
		const results = await Promise.all([1, 2, 3].map((n) => store.write('person', 'abc', { n }, 0)));
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect((await store.read('person', 'abc'))?.version).toBe(1);
	});

	it('removes a document, after any write already on its way', async () => {
		const store = await fresh();
		const writing = store.write('person', 'abc', { n: 1 }, 0);
		const removed = store.remove('person', 'abc');
		await writing;
		expect(await removed).toBe(true);
		expect(await store.read('person', 'abc')).toBeUndefined();
		expect(await store.remove('person', 'abc')).toBe(false);
	});

	it('leaves no temporary files behind', async () => {
		const store = await fresh();
		await store.write('person', 'abc', { n: 1 }, 0);
		await store.write('person', 'abc', { n: 2 }, 1);
		expect(await readdir(path.join(store.root, 'person'))).toEqual(['abc.json']);
	});

	it('announces each write', async () => {
		const store = await fresh();
		/** @type {import('./store.js').Change[]} */
		const heard = [];
		const stop = store.listen((c) => heard.push(c));
		await store.write('person', 'abc', {}, 0);
		stop();
		await store.write('person', 'abc', {}, 1);
		expect(heard).toEqual([{ kind: 'person', id: 'abc', version: 1 }]);
	});

	it('names nothing outside its directory', async () => {
		const store = await fresh();
		await expect(store.read('person', '../../etc/passwd')).rejects.toThrow(/bad document name/);
		await expect(store.write('../x', 'abc', {}, 0)).rejects.toThrow(/bad document name/);
	});
});
