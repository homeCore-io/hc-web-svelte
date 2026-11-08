import { describe, expect, it } from 'vitest';
import { end, entries, header, padding } from './tar.js';
import { bodyRefused, MAX_BODY_BYTES } from './bodyLimit.js';

const enc = new TextEncoder();

/** A tar of these files, sent in pieces of `chunk` bytes. */
function tarStream(files: [string, Uint8Array][], chunk = 700): ReadableStream<Uint8Array> {
	const parts: Uint8Array[] = [];
	for (const [n, b] of files) parts.push(header(n, b.length), b, padding(b.length));
	parts.push(end());
	const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
	let at = 0;
	for (const p of parts) {
		all.set(p, at);
		at += p.length;
	}
	let sent = 0;
	return new ReadableStream({
		pull(c) {
			if (sent >= all.length) return c.close();
			c.enqueue(all.slice(sent, sent + chunk));
			sent += chunk;
		}
	});
}

async function read(stream: ReadableStream<Uint8Array>, skip: string[] = []) {
	const out: Record<string, string> = {};
	for await (const e of entries(stream)) {
		if (skip.includes(e.name)) continue;
		const parts: Uint8Array[] = [];
		for await (const p of e.body()) parts.push(p);
		out[e.name] = Buffer.concat(parts).toString('utf8');
	}
	return out;
}

describe('tar', () => {
	const big = 'x'.repeat(70_000);
	const files: [string, Uint8Array][] = [
		['docs.json', enc.encode('{"format":"hc-web-backup"}')],
		['pictures/a.png', enc.encode(big)],
		['pictures/empty.png', new Uint8Array(0)],
		['pictures/b.png', enc.encode('B')]
	];

	it('reads back what it wrote, in any size of pieces', async () => {
		for (const chunk of [1, 511, 512, 4096, 1 << 20]) {
			const got = await read(tarStream(files, chunk));
			expect(Object.keys(got)).toEqual(files.map(([n]) => n));
			expect(got['pictures/a.png']).toBe(big);
			expect(got['pictures/b.png']).toBe('B');
		}
	});

	it('passes over a file not read', async () => {
		const got = await read(tarStream(files), ['pictures/a.png']);
		expect(got['pictures/b.png']).toBe('B');
	});

	it('refuses what isn’t one, or is cut short', async () => {
		const junk = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(enc.encode('{"not":"a tar"}'.padEnd(1024, ' ')));
				c.close();
			}
		});
		await expect(read(junk)).rejects.toThrow();
		const whole = tarStream(files, 1 << 20);
		const reader = whole.getReader();
		const first = (await reader.read()).value!;
		const cut = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(first.slice(0, 2000));
				c.close();
			}
		});
		await expect(read(cut)).rejects.toThrow();
	});
});

describe('the body limit', () => {
	const h = (o: Record<string, string>) => new Headers(o);
	it('holds the app’s own routes to 8 MB, but not the two that stream files', () => {
		const over = h({ 'content-length': String(MAX_BODY_BYTES + 1) });
		expect(bodyRefused('PUT', '/ui/doc/house/household', over)?.status).toBe(413);
		expect(bodyRefused('POST', '/ui/pictures', over)).toBeUndefined();
		expect(bodyRefused('POST', '/ui/backup', over)).toBeUndefined();
		expect(
			bodyRefused('PUT', '/ui/doc/house/household', h({ 'content-length': '100' }))
		).toBeUndefined();
		expect(bodyRefused('GET', '/ui/me', over)).toBeUndefined();
		expect(bodyRefused('POST', '/ui/x', h({ 'transfer-encoding': 'chunked' }))?.status).toBe(411);
	});
});
