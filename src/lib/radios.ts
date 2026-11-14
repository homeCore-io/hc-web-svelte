/**
 * Arrow keys for a group of radio buttons (role="radiogroup" holding
 * role="radio" buttons), as a radio group moves: the arrows and Home or End
 * pick the next one, the previous one, the first or the last, wrapping
 * round. Only the chosen one is a tab stop (tabindex 0); the rest take -1.
 */

/** Where a key moves from `i` of `n`, or undefined when it doesn't move. */
export function radioStep(key: string, i: number, n: number): number | undefined {
	if (n <= 0) return undefined;
	switch (key) {
		case 'ArrowRight':
		case 'ArrowDown':
			return (i + 1) % n;
		case 'ArrowLeft':
		case 'ArrowUp':
			return (i - 1 + n) % n;
		case 'Home':
			return 0;
		case 'End':
			return n - 1;
		default:
			return undefined;
	}
}

/** A radio group's keydown: moves to the next radio and picks it. */
export function radioKeys(e: KeyboardEvent): void {
	const group = e.currentTarget as HTMLElement;
	const all = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
	const at = all.indexOf(document.activeElement as HTMLElement);
	const to = radioStep(e.key, Math.max(at, 0), all.length);
	const next = to === undefined ? undefined : all[to];
	if (!next) return;
	e.preventDefault();
	next.focus();
	next.click();
}

/** A radio's tabindex: the chosen one, else the first when none is chosen. */
export const radioTab = (checked: boolean, first: boolean, anyChecked: boolean): 0 | -1 =>
	checked || (first && !anyChecked) ? 0 : -1;
