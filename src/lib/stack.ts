/**
 * A stack (13 §13.2): one tall card holding several things, of any kind, a
 * line or a tile each. It's one of the app's own cards (`kind:stack/<n>`),
 * added with Add › Cards › Stack, and its settings are its card's `config`:
 * its name, how it draws them, how tall it is, their order, and the things.
 *
 * A thing in a stack is on the page once: its own card leaves its section
 * while it's in one (`stacked`). Its width is the card's size: Standard is
 * one card wide, Large two, until its own width says (one to four cards);
 * how many of its things go across is its own setting.
 */
import type { Change } from './layers.js';
import type { Options } from './options.js';

export const STACK_STYLES = ['list', 'pills', 'rockers', 'keypad', 'folded'] as const;
export type StackStyle = (typeof STACK_STYLES)[number];
export const STACK_HEIGHTS = ['fit', '1', '2', '3', '4', '5', '6'] as const;
export type StackHeight = (typeof STACK_HEIGHTS)[number];

export const STACK_BUILT_IN: Options = {
	name: '',
	style: 'list',
	height: 'fit',
	order: 'arranged',
	things: []
};

export interface Stack {
	name: string;
	style: StackStyle;
	height: StackHeight;
	/** Busy first: what's on, open or wet ahead of the rest. */
	busyFirst: boolean;
	/** `device:<id>` and `scene:<id>`, in the order they were put in. */
	things: string[];
	/** How many cards wide: one to four. */
	width: number;
	/** Its things side by side: one column, or two (rockers, twice that). */
	columns: 1 | 2;
}

const pick = <T extends string>(all: readonly T[], v: unknown, or: T): T =>
	(all as readonly unknown[]).includes(v) ? (v as T) : or;

/** What a thing in a stack can be: a device or a scene, never another card. */
export const stackable = (r: unknown): r is string =>
	typeof r === 'string' && /^(device|scene):.+/.test(r);

/**
 * A stack's settings, read safely: anything unknown is its default, and
 * nothing twice. `large`: its card's size was Large, which (before a width of
 * its own) meant two cards wide, its things in two columns.
 */
export function readStack(o: Options, large = false): Stack {
	const width = typeof o.width === 'number' ? Math.round(o.width) : NaN;
	const things = Array.isArray(o.things) ? [...new Set(o.things.filter(stackable))] : [];
	return {
		name: typeof o.name === 'string' ? o.name.trim() : '',
		style: pick(STACK_STYLES, o.style, 'list'),
		height: pick(STACK_HEIGHTS, o.height, 'fit'),
		busyFirst: o.order === 'busy',
		things,
		width: width >= 1 && width <= 4 ? width : large ? 2 : 1,
		columns: o.columns === 2 ? 2 : o.columns === 1 ? 1 : large ? 2 : 1
	};
}

export const isStackRef = (r: string) => r.startsWith('kind:stack/');

/**
 * Which stack each thing is in, from the changes a page shows: for each stack
 * on the page, the last `things` any layer set, else what its grouping put in
 * it. A thing two stacks name is in the one someone chose it for, over one a
 * grouping filled; between two alike, the first on the page.
 */
export function stacked(
	changes: Change[],
	stacks: { ref: string; things?: string[] }[]
): Map<string, string> {
	const things = new Map(stacks.map((s) => [s.ref, (s.things ?? []).filter(stackable)]));
	for (const c of changes)
		if (c.op === 'config' && things.has(c.ref) && Array.isArray(c.config.things))
			things.set(c.ref, readStack(c.config).things);
	const chosen = new Set(
		changes.flatMap((c) =>
			c.op === 'config' && things.has(c.ref) && Array.isArray(c.config.things) ? [c.ref] : []
		)
	);
	const order = [...things.keys()].sort((a, b) => Number(chosen.has(b)) - Number(chosen.has(a)));
	const out = new Map<string, string>();
	for (const s of order) for (const t of things.get(s)!) if (!out.has(t)) out.set(t, s);
	return out;
}

/** A line's or a tile's height in each style, with the gap after it. */
const ROW: Record<StackStyle, number> = {
	list: 44,
	folded: 44,
	pills: 42,
	keypad: 40,
	rockers: 72
};
/** Below the last line or tile: a keypad's plate has its own padding. */
const PAD: Record<StackStyle, number> = { list: 6, folded: 6, pills: 4, keypad: 28, rockers: 2 };
/** A Standard card's height and the grid's gap: one "card" of a stack's height. */
export const CARD_ROW = 116;
export const CARD_GAP = 10;

/** Things side by side: one column a card's width, rockers two. */
export const across = (style: StackStyle, columns: number) =>
	columns * (style === 'rockers' ? 2 : 1);

/**
 * How many card rows of the page's grid a stack takes: what it was set to, or
 * — fitting its things — enough for its heading and every line shown.
 */
export function stackRows(s: Stack, shown = s.things.length, folds = false): number {
	if (s.height !== 'fit') return Number(s.height);
	const lines = Math.max(1, Math.ceil(shown / across(s.style, s.columns)));
	const px = 52 + lines * ROW[s.style] + (folds ? 40 : 0) + PAD[s.style];
	return Math.max(1, Math.ceil((px + CARD_GAP) / (CARD_ROW + CARD_GAP)));
}

/** A fixed height in pixels, for a stack set to a number of cards; it scrolls inside past that. */
export const stackHeight = (rows: number) => rows * CARD_ROW + (rows - 1) * CARD_GAP;

/** A stack's settings before anyone sets any: what its grouping put in it, if anything. */
export const stackBase = (card: { things?: string[]; name?: string }): Options => ({
	...STACK_BUILT_IN,
	...(card.things?.length ? { things: card.things } : {}),
	...(card.name ? { name: card.name } : {})
});
