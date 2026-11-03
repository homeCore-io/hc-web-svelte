/**
 * What dragging decides (13 §9.2, 9.4), apart from the pointer: whether a
 * section takes what's held, and which card it would go in front of.
 */

/** What refusing needs to know of a section. */
export interface Taker {
	id: string;
	title: string;
	favourites?: boolean;
	fixed?: boolean;
	bare?: boolean;
	accepts?: boolean;
}

/** Why a section won't take a card of this kind from `from` (`''`: the Add sheet); null when it will. */
export function refusal(s: Taker | undefined, kind: string, from: string): string | null {
	if (!s) return 'Not here';
	if (s.favourites) return 'Favorites holds only starred things';
	if (s.fixed || s.bare) return `${s.title} keeps its own`;
	if (kind === 'room' && s.id !== from) return 'A room stays among the rooms';
	if (s.id === 'rooms' && kind !== 'room') return 'Rooms holds only rooms';
	if (!s.accepts && s.id !== from) return `${s.title} takes only its own`;
	return null;
}

/** A card's place on screen. */
export interface Spot {
	ref: string;
	top: number;
	bottom: number;
	left: number;
	width: number;
}

/**
 * The card a held one would go in front of, from where the pointer is: the
 * first that's below it, or on its row and right of it. Null for the end.
 */
export function beforeAt(cards: Spot[], x: number, y: number): string | null {
	for (const c of cards) {
		if (y < c.top) return c.ref;
		if (y <= c.bottom && x < c.left + c.width / 2) return c.ref;
	}
	return null;
}
