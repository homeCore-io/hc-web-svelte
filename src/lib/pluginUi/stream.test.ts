import { describe, expect, it, vi } from 'vitest';
import { SseReader, startStream, type StreamDeps } from './stream.js';
import type { StreamEvent } from './types.js';

describe('SseReader', () => {
	it('reads messages split across chunks, and skips keep-alives', () => {
		const r = new SseReader();
		expect(r.push('event: stream\ndata: {"a"')).toEqual([]);
		expect(r.push(':1}\n\n: keep-alive\n\nevent: stream\r\ndata: x\r\ndata: y\r\n\r\n')).toEqual([
			{ event: 'stream', data: '{"a":1}' },
			{ event: 'stream', data: 'x\ny' }
		]);
	});
});

const sse = (events: object[]) =>
	events.map((e) => `event: stream\ndata: ${JSON.stringify(e)}\n\n`).join('');

/** A response whose body arrives in the chunks given. */
function body(...chunks: string[]): Response {
	const enc = new TextEncoder();
	return new Response(
		new ReadableStream<Uint8Array>({
			start(c) {
				for (const x of chunks) c.enqueue(enc.encode(x));
				c.close();
			}
		}),
		{ status: 200, headers: { 'content-type': 'text/event-stream' } }
	);
}

function deps(over: Partial<StreamDeps>): StreamDeps {
	return {
		fetch: vi.fn(async () => body()),
		run: vi.fn(async () => ({
			ok: true as const,
			data: { kind: 'stream' as const, request_id: 'r1' }
		})),
		cancel: vi.fn(async () => ({ ok: true as const, data: null })),
		...over
	};
}

describe('startStream', () => {
	it('starts, hands over every event, and ends on complete', async () => {
		const seen: StreamEvent[] = [];
		const d = deps({
			fetch: vi.fn(async () =>
				body(
					sse([{ stage: 'progress', message: 'Hi', ts: '1' }]).slice(0, 20),
					sse([{ stage: 'progress', message: 'Hi', ts: '1' }]).slice(20),
					sse([{ stage: 'complete', data: { n: 2 }, ts: '2' }])
				)
			)
		});
		const h = startStream('plugin.mcp', 'chat', { text: 'hi' }, (e) => seen.push(e), d);
		const end = await h.done;
		expect(end).toEqual({ stage: 'complete', data: { n: 2 }, ts: '2', request_id: 'r1' });
		expect(seen.map((e) => e.stage)).toEqual(['started', 'progress', 'complete']);
		expect(h.requestId).toBe('r1');
		expect(d.run).toHaveBeenCalledWith('plugin.mcp', 'chat', { text: 'hi' });
		const [url, init] = (d.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
		expect(url).toBe('/api/v1/plugins/plugin.mcp/command/r1/stream');
		expect(String(url)).not.toContain('token');
		expect((init as RequestInit).headers).toEqual({ accept: 'text/event-stream' });
	});

	it('says busy when homeCore refuses a second run', async () => {
		const seen: StreamEvent[] = [];
		const d = deps({
			run: vi.fn(async () => ({
				ok: true as const,
				data: { kind: 'busy' as const, request_id: 'r0' }
			}))
		});
		const end = await startStream('p', 'chat', {}, (e) => seen.push(e), d).done;
		expect(end.stage).toBe('busy');
		expect(end.request_id).toBe('r0');
		expect(seen).toHaveLength(1);
		expect(d.fetch).not.toHaveBeenCalled();
	});

	it('ends with the answer of an action that answers at once', async () => {
		const d = deps({
			run: vi.fn(async () => ({
				ok: true as const,
				data: { kind: 'reply' as const, reply: { status: 'ok' } }
			}))
		});
		expect(await startStream('p', 'x', {}, () => {}, d).done).toEqual({
			stage: 'complete',
			data: { status: 'ok' }
		});
	});

	it('ends with error when homeCore says no', async () => {
		const d = deps({ run: vi.fn(async () => ({ ok: false as const, error: 'No.' })) });
		expect(await startStream('p', 'x', {}, () => {}, d).done).toEqual({
			stage: 'error',
			message: 'No.'
		});
	});

	it('opens a dropped stream again without repeating what it saw', async () => {
		const first = sse([{ stage: 'progress', message: 'a', ts: '1' }]);
		const both =
			first +
			sse([
				{ stage: 'progress', message: 'b', ts: '2' },
				{ stage: 'error', message: 'x', ts: '3' }
			]);
		let n = 0;
		const d = deps({ fetch: vi.fn(async () => body(n++ === 0 ? first : both)) });
		const seen: string[] = [];
		vi.useFakeTimers();
		const h = startStream('p', 'x', {}, (e) => seen.push(`${e.stage}:${e.message ?? ''}`), d);
		await vi.runAllTimersAsync();
		vi.useRealTimers();
		expect((await h.done).stage).toBe('error');
		expect(seen).toEqual(['started:', 'progress:a', 'progress:b', 'error:x']);
	});

	it('cancels through the plugin, once its run has started', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const d = deps({
			run: vi.fn(async () => {
				await gate;
				return { ok: true as const, data: { kind: 'stream' as const, request_id: 'r9' } };
			}),
			fetch: vi.fn(async () => body(sse([{ stage: 'canceled', ts: '1' }])))
		});
		const h = startStream('p', 'chat', {}, () => {}, d);
		h.cancel();
		expect(d.cancel).not.toHaveBeenCalled();
		release();
		expect((await h.done).stage).toBe('canceled');
		expect(d.cancel).toHaveBeenCalledWith('p', 'r9');
	});
});
