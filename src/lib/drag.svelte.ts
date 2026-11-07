/**
 * Dragging while arranging (13 §9): what is held and where it would land, so
 * the page can show "Goes here" there and dim what won't take it. The
 * pointer work is drag/controller.ts, loaded only while arranging; this is
 * only the state it shares with the page.
 */
class Drag {
	/** The page it's happening on. */
	page = $state<string | null>(null);
	/** A card held, by ref; or a section held, by id. */
	ref = $state<string | null>(null);
	section = $state<string | null>(null);
	/** Where a held card would land: its section, and the card it goes before (null: the end). */
	into = $state<string | null>(null);
	before = $state<string | null>(null);
	/** A stack a held thing would go in (13 §13.2). */
	stack = $state<string | null>(null);
	/** Where a held section would land: before this one (null: the end of its column). */
	sectionBefore = $state<string | null | undefined>(undefined);
	/** The column a held section would land in (Home's room field, a Lit room). */
	column = $state<string | undefined>(undefined);
	/** A section that won't take what's held, and why. */
	refused = $state<{ section: string; why: string } | null>(null);
	/** What just happened, for a screen reader and the line under the bar. */
	said = $state('');

	get active(): boolean {
		return this.ref !== null || this.section !== null;
	}

	clear(): void {
		this.ref = null;
		this.section = null;
		this.into = null;
		this.stack = null;
		this.before = null;
		this.sectionBefore = undefined;
		this.column = undefined;
		this.refused = null;
	}
}

export const drag = new Drag();
