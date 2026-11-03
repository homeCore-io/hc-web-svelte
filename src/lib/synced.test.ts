import { afterEach, describe, expect, it, vi } from 'vitest';
import { Synced } from './synced.svelte.js';

type Doc = { version: number; items?: string[] };
const push = (item: string) => (d: Doc) => ({ ...d, items: [...(d.items ?? []), item] });

/** A UI server that answers each PUT in turn: a status, or `'down'` for no answer. */
function server(answers: (number | 'down')[]) {
	const puts: Doc[] = [];
	let version = 0;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as Doc;
			puts.push(body);
			const answer = answers.shift() ?? 200;
			if (answer === 'down') throw new TypeError('network');
			if (answer !== 200) return new Response('{}', { status: answer });
			version += 1;
			return new Response(JSON.stringify({ ...body, version }), { status: 200 });
		})
	);
	return puts;
}

afterEach(() => vi.unstubAllGlobals());

describe('Synced', () => {
	it('keeps a change that failed to save, and saves it with the next', async () => {
		const puts = server(['down', 200]);
		const s = new Synced<Doc>('/ui/prefs', 'person');

		await s.change(push('a'));
		expect(s.trouble).not.toBeNull();
		expect(s.doc.items).toEqual(['a']);

		await s.change(push('b'));
		expect(puts.at(-1)?.items).toEqual(['a', 'b']);
		expect(s.saved.items).toEqual(['a', 'b']);
		expect(s.doc.items).toEqual(['a', 'b']);
		expect(s.trouble).toBeNull();
	});

	it('drops a change it has no right to make', async () => {
		server([403, 200]);
		const s = new Synced<Doc>('/ui/household', 'household');

		await s.change(push('a'));
		expect(s.trouble).toMatch(/ask an admin/);
		expect(s.doc.items).toBeUndefined();

		await s.change(push('b'));
		expect(s.saved.items).toEqual(['b']);
	});

	it('saves changes made together in one go', async () => {
		const puts = server([200, 200]);
		const s = new Synced<Doc>('/ui/prefs', 'person');

		await Promise.all([s.change(push('a')), s.change(push('b'))]);
		expect(puts).toHaveLength(1);
		expect(s.saved.items).toEqual(['a', 'b']);
	});
});
