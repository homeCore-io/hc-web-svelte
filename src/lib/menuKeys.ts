/**
 * Arrow keys in a menu (role="menu"): Up and Down move between its items and
 * wrap round, Home and End go to the first and last.
 */

/** Where focus goes from item `at` of `count` for `key`, or null when the key isn't a move. */
export function nextItem(key: string, at: number, count: number): number | null {
	if (count === 0) return null;
	switch (key) {
		case 'ArrowDown':
			return at < 0 ? 0 : (at + 1) % count;
		case 'ArrowUp':
			return at < 0 ? count - 1 : (at - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/** A menu's items that are shown: one may be hidden at some widths. */
const itemsOf = (box: HTMLElement): HTMLElement[] =>
	[...box.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
		(el) => el.getClientRects().length > 0
	);

/** Moves focus among `box`'s menu items for an arrow, Home or End key; true when it did. */
export function moveInMenu(e: KeyboardEvent, box: HTMLElement): boolean {
	const items = itemsOf(box);
	const to = nextItem(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);
	if (to === null) return false;
	e.preventDefault();
	items[to]?.focus();
	return true;
}

/** Use on a menu as it opens: puts focus on its first item. */
export function focusFirst(box: HTMLElement): void {
	itemsOf(box)[0]?.focus();
}

/** Where a row of tabs (role="tablist") goes from tab `at` of `count` for `key`, or null. */
export function nextTab(key: string, at: number, count: number): number | null {
	if (count === 0 || at < 0) return null;
	switch (key) {
		case 'ArrowRight':
			return (at + 1) % count;
		case 'ArrowLeft':
			return (at - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/**
 * Arrow keys in a group of radio buttons (role="radiogroup"): the group is one
 * Tab stop, and an arrow picks the next or previous choice, as a radio does.
 */
export function moveInRadios(e: KeyboardEvent): void {
	const by =
		e.key === 'ArrowRight' || e.key === 'ArrowDown'
			? 1
			: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
				? -1
				: 0;
	if (by === 0) return;
	const group = e.currentTarget as HTMLElement;
	const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
	const at = radios.indexOf(document.activeElement as HTMLButtonElement);
	if (radios.length === 0 || at < 0) return;
	e.preventDefault();
	const next = radios[(at + by + radios.length) % radios.length]!;
	next.focus();
	next.click();
}
