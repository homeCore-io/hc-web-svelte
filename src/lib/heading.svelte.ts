/**
 * A page's own heading for the shell's header — a room's name, say — when
 * the address alone doesn't say it. A page sets it while it is shown, and
 * may say where "back" goes when that isn't the address's parent.
 */
export interface Back {
	href: string;
	label: string;
}

/** The line above the title, and its shorter form for a phone. */
export interface Kicker {
	long: string;
	short: string;
}

class Heading {
	text = $state<string | null>(null);
	// Raw, not deep state: `show`'s clean-up knows its own back by identity, and
	// a deep proxy is never identical to what was handed in — so a page's back
	// outlived it, and a list was left pointing back at itself.
	back = $state.raw<Back | null>(null);
	/** A small line above the title: Home's day and mode, in the room field; shorter on a phone. */
	kicker = $state<Kicker | null>(null);

	/** Use inside `$effect`: sets the heading, and clears it when the page goes. */
	show(text: string | null, back: Back | null = null): () => void {
		this.text = text;
		this.back = back;
		return () => {
			if (this.text === text) this.text = null;
			if (this.back === back) this.back = null;
		};
	}

	/** Use inside `$effect`: sets the line above the title, and clears it when the page goes. */
	showKicker(text: Kicker | null): () => void {
		this.kicker = text;
		return () => {
			if (this.kicker === text) this.kicker = null;
		};
	}
}

export const heading = new Heading();
