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

/** Moves focus among `box`'s menu items for an arrow, Home or End key; true when it did. */
export function moveInMenu(e: KeyboardEvent, box: HTMLElement): boolean {
	const items = [...box.querySelectorAll<HTMLElement>('[role="menuitem"]')];
	const to = nextItem(e.key, items.indexOf(document.activeElement as HTMLElement), items.length);
	if (to === null) return false;
	e.preventDefault();
	items[to]?.focus();
	return true;
}

/** Use on a menu as it opens: puts focus on its first item. */
export function focusFirst(box: HTMLElement): void {
	box.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
}
