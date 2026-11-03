import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extensionFile, listExtensions, readManifest } from './extensions.js';

const dial = { id: 'dial', kind: 'rive', label: 'Animated', draws: 'climate', file: 't.riv' };

describe('UI extensions', () => {
	it('keeps the elements it can use', () => {
		const ext = readManifest('hc-thermostat', {
			id: 'hc-thermostat',
			name: 'Thermostat',
			elements: [
				dial,
				{ ...dial }, // the same id again
				{ ...dial, id: 'b', kind: 'lottie' },
				{ ...dial, id: 'c', file: '../x.riv' },
				{ ...dial, id: 'd', label: ' ' }
			]
		});
		expect(typeof ext === 'string' ? ext : ext.elements.map((e) => e.id)).toEqual(['dial']);
	});

	it('refuses a manifest for another folder, or with nothing to use', () => {
		expect(readManifest('a', { id: 'b', elements: [dial] })).toMatch(/folder is a/);
		expect(readManifest('a', { id: 'a', elements: [] })).toMatch(/no elements/);
	});

	it('lists the folder and serves only the files a manifest names', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'hc-ext-'));
		await mkdir(path.join(dir, 'hc-thermostat'));
		await writeFile(
			path.join(dir, 'hc-thermostat', 'extension.json'),
			JSON.stringify({ id: 'hc-thermostat', elements: [dial] })
		);
		await writeFile(path.join(dir, 'hc-thermostat', 't.riv'), 'RIVE');
		await writeFile(path.join(dir, 'hc-thermostat', 'other.riv'), 'RIVE');
		await mkdir(path.join(dir, 'broken'));
		await writeFile(path.join(dir, 'broken', 'extension.json'), '{');

		expect((await listExtensions(dir)).map((x) => x.id)).toEqual(['hc-thermostat']);
		expect(await extensionFile('hc-thermostat', 't.riv', dir)).toEqual(
			new TextEncoder().encode('RIVE')
		);
		expect(await extensionFile('hc-thermostat', 'other.riv', dir)).toBeUndefined();
		expect(await extensionFile('..', 't.riv', dir)).toBeUndefined();
		expect(await listExtensions(path.join(dir, 'none'))).toEqual([]);
	});
});
