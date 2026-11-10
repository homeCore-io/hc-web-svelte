/**
 * The time, for "open for 5 min" and "offline · 3 h" — moved on every 30
 * seconds, which is finer than any of those say. A running timer counts in
 * seconds, so while one is on screen (`hold`) it moves every second.
 */
class Clock {
	now = $state(Date.now());
	#timer: ReturnType<typeof setInterval> | null = null;
	#held = 0;

	start(): void {
		this.#timer ??= this.#every();
	}

	/** Tick every second until the returned function is called. */
	hold(): () => void {
		this.#held += 1;
		if (this.#held === 1) this.#restart();
		let done = false;
		return () => {
			if (done) return;
			done = true;
			this.#held -= 1;
			if (this.#held === 0) this.#restart();
		};
	}

	#every(): ReturnType<typeof setInterval> {
		return setInterval(() => (this.now = Date.now()), this.#held > 0 ? 1_000 : 30_000);
	}

	#restart(): void {
		if (this.#timer === null) return;
		clearInterval(this.#timer);
		this.now = Date.now();
		this.#timer = this.#every();
	}
}

export const clock = new Clock();
