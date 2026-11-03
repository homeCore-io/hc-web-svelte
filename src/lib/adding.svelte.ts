/**
 * The Add sheet (G-c, G-f), opened from Edit's or Customise's bar, a section's
 * "Add here", or a + between two cards: which page, which section and spot it
 * adds into, and, once something that needs setting is added (a note, a
 * chart), that card, so its page can open its settings as it appears.
 */
class Adding {
	/** The page the sheet is open on, or none. */
	page = $state<string | null>(null);
	/** The section it adds into; none for where added things go (Pinned, Also here). */
	into = $state<string | undefined>(undefined);
	/**
	 * The card it adds in front of, or `null` for the section's end. It stays
	 * put as things are added, so each goes after the one added before it.
	 */
	before = $state<string | null>(null);
	/** A card just added whose settings should open when it's drawn. */
	settle = $state<string | null>(null);
	/** The card just added, so the page can bring it into view and mark it. */
	added = $state<string | null>(null);

	open(page: string, into?: string, before: string | null = null): void {
		this.page = page;
		this.into = into;
		this.before = before;
	}

	/** Another spot, the sheet staying open: a + on the page, or the sheet's own choice. */
	spot(into: string, before: string | null): void {
		this.into = into;
		this.before = before;
	}

	close(): void {
		this.page = null;
		this.into = undefined;
		this.before = null;
	}
}

export const adding = new Adding();
