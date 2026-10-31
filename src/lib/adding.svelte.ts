/**
 * The Add sheet (G-c), opened from Edit's or Customise's bar or a section's
 * "Add here": which page, which section it adds into — and, once something
 * that needs setting is added (a note, a chart), that card, so its page can
 * open its settings as it appears.
 */
class Adding {
	/** The page the sheet is open on, or none. */
	page = $state<string | null>(null);
	/** The section it adds into; none for where added things go (Pinned, Also here). */
	into = $state<string | undefined>(undefined);
	/** A card just added whose settings should open when it's drawn. */
	settle = $state<string | null>(null);

	open(page: string, into?: string): void {
		this.page = page;
		this.into = into;
	}

	close(): void {
		this.page = null;
		this.into = undefined;
	}
}

export const adding = new Adding();
