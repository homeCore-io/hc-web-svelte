/**
 * The time, for "open for 5 min" and "offline · 3 h" — moved on every 30
 * seconds, which is finer than any of those say.
 */
class Clock {
	now = $state(Date.now());
	#timer: ReturnType<typeof setInterval> | null = null;

	start(): void {
		this.#timer ??= setInterval(() => (this.now = Date.now()), 30_000);
	}
}

export const clock = new Clock();
