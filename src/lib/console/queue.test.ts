import { describe, expect, it } from 'vitest';
import { isAbort, Queue } from './queue.js';

/** A job that finishes when told. */
function held() {
	let finish: () => void = () => {};
	const done = new Promise<void>((r) => (finish = r));
	return { job: () => done, finish };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Queue', () => {
	it('runs at most its limit at once, the rest in turn', async () => {
		const q = new Queue(2);
		const jobs = [held(), held(), held()];
		const started: number[] = [];
		const all = jobs.map((j, i) =>
			q.run(() => {
				started.push(i);
				return j.job();
			})
		);
		await tick();
		expect(started).toEqual([0, 1]);
		expect(q.size).toEqual({ running: 2, waiting: 1 });
		jobs[0]!.finish();
		await tick();
		expect(started).toEqual([0, 1, 2]);
		jobs[1]!.finish();
		jobs[2]!.finish();
		await Promise.all(all);
		expect(q.size).toEqual({ running: 0, waiting: 0 });
	});

	it('never starts a job let go while it waits, and frees its turn', async () => {
		const q = new Queue(1);
		const first = held();
		const stop = new AbortController();
		let ran = false;
		const a = q.run(first.job);
		const b = q.run(async () => {
			ran = true;
		}, stop.signal);
		const c = q.run(async () => 'c');
		stop.abort();
		await expect(b).rejects.toSatisfy(isAbort);
		first.finish();
		await a;
		expect(await c).toBe('c');
		expect(ran).toBe(false);
	});

	it('refuses a job let go before it is asked', async () => {
		const q = new Queue(3);
		const stop = new AbortController();
		stop.abort();
		await expect(q.run(async () => 1, stop.signal)).rejects.toSatisfy(isAbort);
		expect(q.size).toEqual({ running: 0, waiting: 0 });
	});

	it('frees the place of a job that fails', async () => {
		const q = new Queue(1);
		await expect(q.run(() => Promise.reject(new Error('no')))).rejects.toThrow('no');
		expect(await q.run(async () => 2)).toBe(2);
	});
});
