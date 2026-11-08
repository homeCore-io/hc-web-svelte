/**
 * A page's sections as what the free grid lays out (14 §4, §6): each heading
 * a full-width card, then its cards one by one. A section a look draws as one
 * box (a list, swatches, a panel, folded) is placed whole, its heading with it.
 */
import type { Form, Layered } from './layers.js';
import { sectionRef, type Card, type Layout, type ShownSection } from './page.js';
import { COLS, type Item } from './free.js';

/** A card's usual size in cells (14 §7), by its form. */
export const FORM_CELLS: Record<Form, { w: number; h: number }> = {
	compact: { w: 2, h: 1 },
	standard: { w: 2, h: 2 },
	large: { w: 4, h: 3 }
};

/** Laid out one by one; any other layout is drawn whole. */
const ONE_BY_ONE: Layout[] = ['grid', 'row'];

export type Piece =
	| { kind: 'heading'; section: ShownSection }
	| { kind: 'whole'; section: ShownSection }
	| { kind: 'card'; section: ShownSection; card: Card; g: Layered<Card> };

/** A section drawn as one card: how tall to start it, before its contents say. */
const WHOLE_ROWS = 2;

/**
 * What the page lays out, in its sections' order, and what each is. `cells`
 * says a card's size; `drawn` whether a section shows at all.
 */
export function piecesOf(
	sections: ShownSection[],
	cells: (card: Card, g: Layered<Card>, layout: Layout) => { w: number; h: number },
	drawn: (s: ShownSection) => boolean
): { items: Item[]; pieces: Map<string, Piece> } {
	const items: Item[] = [];
	const pieces = new Map<string, Piece>();
	for (const s of sections) {
		if (!drawn(s) || s.hidden) continue;
		const sec = s.section;
		const ref = sectionRef(sec.id);
		if (!ONE_BY_ONE.includes(s.layout) || sec.bare || sec.lead) {
			items.push({ ref, w: COLS, h: WHOLE_ROWS, breaks: true });
			pieces.set(ref, { kind: 'whole', section: s });
			continue;
		}
		if (!sec.headless) {
			items.push({ ref, w: COLS, h: 1, breaks: true });
			pieces.set(ref, { kind: 'heading', section: s });
		}
		let first = sec.headless;
		for (const g of s.groups)
			for (const card of g.shown) {
				if (pieces.has(card.ref)) continue;
				const size = cells(card, g, s.layout);
				items.push({ ref: card.ref, ...size, breaks: first || undefined });
				first = false;
				pieces.set(card.ref, { kind: 'card', section: s, card, g });
			}
	}
	return { items, pieces };
}
