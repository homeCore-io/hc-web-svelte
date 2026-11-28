import { beforeEach, describe, expect, it, vi } from 'vitest';

// The live stream, by hand: what a frame would bring.
let frame: ((f: unknown) => void) | null = null;
vi.mock('./live.svelte.js', () => ({
	live: {
		listen: (fn: (f: unknown) => void) => {
			frame = fn;
			return () => {};
		}
	}
}));

const { rotations } = await import('./rotations.svelte.js');

const rot = (id: string, now: string) => ({
	id,
	name: `Rotation ${id}`,
	device_id: 'd',
	choices: [],
	order: 'in_turn',
	advance: 'each_use',
	now: { current_name: now }
});
const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });

describe('rotations, kept current', () => {
	beforeEach(() => vi.unstubAllGlobals());

	it('a slow load doesn’t undo what a play brought since', async () => {
		let answerLoad: (r: Response) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string, init?: RequestInit) => {
				if (url === '/api/v1/rotations' && !init?.method)
					return new Promise<Response>((r) => (answerLoad = r));
				if (url.endsWith('/play')) return Promise.resolve(json({ played: 'Jazz', missing: [] }));
				return Promise.resolve(json(rot('a', 'Jazz')));
			})
		);
		const loading = rotations.load();
		await rotations.play('a');
		await vi.waitFor(() => expect(rotations.byId('a')?.now?.current_name).toBe('Jazz'));
		// The load answers now, with what it read before the play.
		answerLoad(json([rot('a', 'Chill'), rot('b', 'Folk')]));
		await loading;
		expect(rotations.byId('a')?.now?.current_name).toBe('Jazz');
		expect(rotations.byId('b')?.now?.current_name).toBe('Folk');
	});

	it('loads again when the live connection comes back', async () => {
		const get = vi.fn(() => Promise.resolve(json([rot('c', 'Now')])));
		vi.stubGlobal('fetch', get);
		await rotations.load();
		const before = get.mock.calls.length;
		frame?.({ type: 'snapshot' });
		await vi.waitFor(() => expect(get.mock.calls.length).toBe(before + 1));
		await vi.waitFor(() => expect(rotations.byId('c')).toBeDefined());
	});
});
