import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	extensionFile,
	filePath,
	listExtensions,
	readManifest,
	readOptions
} from './extensions.js';

const dial = { id: 'dial', kind: 'rive', label: 'Animated', draws: 'climate', file: 't.riv' };
const gauge = {
	id: 'gauge',
	kind: 'code',
	label: 'Gauge',
	draws: 'readings',
	module: 'gauge.js',
	element: 'hc-x-gauge'
};

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
				{ ...dial, id: 'd', label: ' ' },
				gauge,
				{ ...gauge, id: 'e', module: 'gauge.css' },
				{ ...gauge, id: 'f', element: 'NoHyphen' },
				{ ...dial, id: 'g', file: 'art/dial.riv' }
			]
		});
		expect(typeof ext === 'string' ? ext : ext.elements.map((e) => e.id)).toEqual([
			'dial',
			'gauge',
			'g'
		]);
	});

	it('refuses a manifest for another folder, or with nothing to use', () => {
		expect(readManifest('a', { id: 'b', elements: [dial] })).toMatch(/folder is a/);
		expect(readManifest('a', { id: 'a', elements: [] })).toMatch(/no elements/);
		expect(readManifest('a', { id: 'a', values: 2, elements: [dial] })).toMatch(/newer app/);
		expect(typeof readManifest('a', { id: 'a', values: 1, elements: [dial] })).toBe('object');
	});

	it('serves files of known types from inside its folder, never hidden ones or through links', async () => {
		const dir = await mkdtemp(path.join(tmpdir(), 'hc-ext-'));
		const x = path.join(dir, 'hc-gauges');
		await mkdir(path.join(x, 'art'), { recursive: true });
		await writeFile(
			path.join(x, 'extension.json'),
			JSON.stringify({ id: 'hc-gauges', elements: [gauge] })
		);
		await writeFile(path.join(x, 'gauge.js'), 'export {}');
		await writeFile(path.join(x, 'art', 'face.svg'), '<svg/>');
		await writeFile(path.join(x, '.installed.json'), '{}');
		await writeFile(path.join(x, 'notes.exe'), 'MZ');
		await writeFile(path.join(dir, 'secret.txt'), 'outside');
		await symlink(path.join(dir, 'secret.txt'), path.join(x, 'link.txt'));
		await mkdir(path.join(dir, 'broken'));
		await writeFile(path.join(dir, 'broken', 'extension.json'), '{');

		expect((await listExtensions(dir)).map((e) => e.id)).toEqual(['hc-gauges']);
		expect((await extensionFile('hc-gauges', 'gauge.js', dir))?.type).toBe('text/javascript');
		expect((await extensionFile('hc-gauges', 'art/face.svg', dir))?.type).toBe('image/svg+xml');
		expect(await extensionFile('hc-gauges', '.installed.json', dir)).toBeUndefined();
		expect(await extensionFile('hc-gauges', 'notes.exe', dir)).toBeUndefined();
		expect(await extensionFile('hc-gauges', 'link.txt', dir)).toBeUndefined();
		expect(await extensionFile('hc-gauges', '../secret.txt', dir)).toBeUndefined();
		expect(await extensionFile('..', 'secret.txt', dir)).toBeUndefined();
		expect(await listExtensions(path.join(dir, 'none'))).toEqual([]);
		expect(filePath('art/a.riv')).toBe(true);
		expect(filePath('a/../b.riv')).toBe(false);
	});

	it('reads the options a drawing offers: on or off, with a name and a label', () => {
		expect(
			readOptions([
				{ id: 'pulse', label: 'Pulse while it works', type: 'boolean', default: true },
				{ id: 'glow', label: 'Glow', type: 'boolean', default: false },
				{ id: 'glow', label: 'Again', type: 'boolean' },
				{ id: 'Size', label: 'Size', type: 'boolean' },
				{ id: 'speed', label: 'Speed', type: 'number' },
				{ id: 'quiet', label: ' ', type: 'boolean' }
			])
		).toEqual([
			{ id: 'pulse', label: 'Pulse while it works', type: 'boolean', default: true },
			{ id: 'glow', label: 'Glow', type: 'boolean', default: false }
		]);
		expect(readOptions('no')).toBeUndefined();
		const ext = readManifest('a', {
			id: 'a',
			elements: [{ ...dial, options: [{ id: 'pulse', label: 'Pulse', type: 'boolean' }] }]
		});
		expect(typeof ext === 'string' ? ext : ext.elements[0]!.options).toEqual([
			{ id: 'pulse', label: 'Pulse', type: 'boolean', default: true }
		]);
	});
});
