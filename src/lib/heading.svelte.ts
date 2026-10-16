/**
 * A page's own heading for the shell's header — a room's name, say — when
 * the address alone doesn't say it. A page sets it while it is shown, and
 * may say where "back" goes when that isn't the address's parent.
 */
export interface Back {
	href: string;
	label: string;
}

class Heading {
	text = $state<string | null>(null);
	back = $state<Back | null>(null);

	/** Use inside `$effect`: sets the heading, and clears it when the page goes. */
	show(text: string | null, back: Back | null = null): () => void {
		this.text = text;
		this.back = back;
		return () => {
			if (this.text === text) this.text = null;
			if (this.back === back) this.back = null;
		};
	}
}

export const heading = new Heading();
