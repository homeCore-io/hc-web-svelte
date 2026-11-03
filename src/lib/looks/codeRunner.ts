/**
 * Runs a made drawing's code (13 §6.4) away from the page: in a worker, with
 * a time limit. `draw(thing)` receives the thing's values and returns HTML;
 * a drawing that throws, or takes too long, is stopped and the card is drawn
 * as Classic draws it (§12.5). The page never waits on it.
 *
 * Only an admin may write such code (S4); this keeps a mistake in it from
 * stalling the screens of everyone who sees the look.
 */
import type { Vars } from './expr.js';

export type Drawn = { html: string } | { error: string };

const LIMIT_MS = 300;

const WORKER = `
const made = new Map();
self.onmessage = (e) => {
	const { id, code, thing } = e.data;
	try {
		let draw = made.get(code);
		if (!draw) {
			draw = new Function('thing', '"use strict";\\n' + code);
			made.set(code, draw);
		}
		const html = draw(Object.freeze({ ...thing }));
		self.postMessage({ id, html: html == null ? '' : String(html) });
	} catch (err) {
		self.postMessage({ id, error: String((err && err.message) || err) });
	}
};`;

let worker: Worker | null = null;
let next = 0;
const waiting = new Map<
	number,
	{ done: (d: Drawn) => void; timer: ReturnType<typeof setTimeout> }
>();

function start(): Worker {
	const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
	const w = new Worker(url);
	URL.revokeObjectURL(url);
	w.onmessage = (e: MessageEvent<{ id: number } & Drawn>) => {
		const job = waiting.get(e.data.id);
		if (!job) return;
		clearTimeout(job.timer);
		waiting.delete(e.data.id);
		const { id: _id, ...drawn } = e.data;
		job.done(drawn);
	};
	return w;
}

/** A stalled worker is stopped, and everything it was drawing falls back. */
function stop(why: string): void {
	worker?.terminate();
	worker = null;
	for (const [, job] of waiting) {
		clearTimeout(job.timer);
		job.done({ error: why });
	}
	waiting.clear();
}

/** Draw a thing with a drawing's code. */
export function drawWithCode(code: string, thing: Vars): Promise<Drawn> {
	if (typeof Worker === 'undefined') return Promise.resolve({ error: 'Can’t run code here' });
	worker ??= start();
	const id = next++;
	return new Promise((done) => {
		const timer = setTimeout(
			() => stop(`Took longer than ${LIMIT_MS} ms, so it was stopped`),
			LIMIT_MS
		);
		waiting.set(id, { done, timer });
		worker!.postMessage({ id, code, thing });
	});
}

/** CSS anyone may write: nothing in it can load anything from outside (§6.4). */
export const safeCss = (css: string): string =>
	css
		.replace(/@import[^;]*;?/gi, '')
		.replace(/url\s*\([^)]*\)/gi, 'none')
		.replace(/expression\s*\(/gi, '(');
