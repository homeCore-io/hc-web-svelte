/**
 * At most a few requests at a time, the rest waiting their turn: the cameras'
 * history and stills are asked for this way, so a page of six cameras does
 * not send core two dozen at once. A job whose `signal` is aborted while it
 * waits never starts; one already running is told by the same signal.
 */
export class Queue {
	#max: number;
	#running = 0;
	#waiting: (() => void)[] = [];

	constructor(max: number) {
		this.#max = Math.max(1, max);
	}

	/** How many run now, and how many wait. */
	get size(): { running: number; waiting: number } {
		return { running: this.#running, waiting: this.#waiting.length };
	}

	/** Runs `job` when a place is free; rejects with an AbortError if `signal` aborts first. */
	async run<T>(job: () => Promise<T>, signal?: AbortSignal): Promise<T> {
		await this.#turn(signal);
		try {
			return await job();
		} finally {
			this.#running--;
			this.#next();
		}
	}

	#turn(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) return Promise.reject(aborted());
		if (this.#running < this.#max) {
			this.#running++;
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			const go = () => {
				signal?.removeEventListener('abort', drop);
				this.#running++;
				resolve();
			};
			const drop = () => {
				this.#waiting = this.#waiting.filter((w) => w !== go);
				reject(aborted());
			};
			signal?.addEventListener('abort', drop, { once: true });
			this.#waiting.push(go);
		});
	}

	#next() {
		if (this.#running < this.#max) this.#waiting.shift()?.();
	}
}

const aborted = () => new DOMException('The request was let go.', 'AbortError');

/** Whether an error is a request let go on purpose. */
export const isAbort = (e: unknown): boolean =>
	e instanceof DOMException && e.name === 'AbortError';
