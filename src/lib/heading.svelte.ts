/**
 * A page's own heading for the shell's header — a room's name, say — when
 * the address alone doesn't say it. A page sets it while it is shown.
 */
class Heading {
	text = $state<string | null>(null);

	/** Use inside `$effect`: sets the heading, and clears it when the page goes. */
	show(text: string | null): () => void {
		this.text = text;
		return () => {
			if (this.text === text) this.text = null;
		};
	}
}

export const heading = new Heading();
