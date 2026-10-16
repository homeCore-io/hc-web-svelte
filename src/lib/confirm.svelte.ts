/**
 * The in-page confirmation (08 §3): a dangerous action says what it will do,
 * in the page, not a browser dialog. One at a time; the app's root shows it.
 *
 *     if (!(await ask({ title: 'Remove the Kitchen panel?', go: 'Remove', danger: true }))) return;
 */
export interface Question {
	title: string;
	/** A sentence under the title. */
	body?: string;
	/** What is lost, one line each. */
	lost?: string[];
	/** The button that goes ahead — a verb: "Remove", "Restart". */
	go: string;
	/** Defaults to "Cancel". */
	stay?: string;
	danger?: boolean;
	/** A word to type before going ahead, for what can't be undone. */
	typed?: string;
}

class Asking {
	current = $state<Question | null>(null);
	#answer: ((yes: boolean) => void) | null = null;

	ask(q: Question): Promise<boolean> {
		this.#answer?.(false);
		this.current = q;
		return new Promise((resolve) => (this.#answer = resolve));
	}

	answer(yes: boolean) {
		const answer = this.#answer;
		this.#answer = null;
		this.current = null;
		answer?.(yes);
	}
}

export const asking = new Asking();
export const ask = (q: Question) => asking.ask(q);
