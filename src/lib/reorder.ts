/**
 * Reordering a short list by dragging a row's grip (13 §11: "drag to
 * reorder"), as in the look editor's sections. Rows are the list's
 * `[data-item]` children; a row is picked up by its `[data-grip]`, by mouse
 * or touch, and the list is told each time the held row passes another, so
 * it moves as the pointer does. Arrow buttons beside it stay the way to do
 * it by keyboard.
 */
export interface Reorder {
	move: (from: number, to: number) => void;
}

export function reorder(list: HTMLElement, given: Reorder) {
	let opts = given;
	let held: { index: number; pointer: number; row: HTMLElement } | null = null;
	const rows = () => [...list.querySelectorAll<HTMLElement>(':scope > [data-item]')];

	function down(e: PointerEvent) {
		const grip = (e.target as HTMLElement).closest<HTMLElement>('[data-grip]');
		const row = grip?.closest<HTMLElement>('[data-item]');
		if (!grip || !row || row.parentElement !== list || e.button !== 0) return;
		held = { index: rows().indexOf(row), pointer: e.pointerId, row };
		grip.setPointerCapture(e.pointerId);
		row.classList.add('lifted');
		e.preventDefault();
	}
	function move(e: PointerEvent) {
		if (!held || e.pointerId !== held.pointer) return;
		const all = rows();
		let to = all.length - 1;
		for (let i = 0; i < all.length; i++) {
			const r = all[i]!.getBoundingClientRect();
			if (e.clientY < r.top + r.height / 2) {
				to = i;
				break;
			}
		}
		if (to !== held.index) {
			opts.move(held.index, to);
			held.index = to;
		}
	}
	function up(e: PointerEvent) {
		if (!held || e.pointerId !== held.pointer) return;
		held.row.classList.remove('lifted');
		held = null;
	}

	list.addEventListener('pointerdown', down);
	list.addEventListener('pointermove', move);
	list.addEventListener('pointerup', up);
	list.addEventListener('pointercancel', up);
	return {
		update(next: Reorder) {
			opts = next;
		},
		destroy() {
			list.removeEventListener('pointerdown', down);
			list.removeEventListener('pointermove', move);
			list.removeEventListener('pointerup', up);
			list.removeEventListener('pointercancel', up);
		}
	};
}

/** A list with one item moved from one place to another. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
	const out = [...list];
	const [item] = out.splice(from, 1);
	if (item !== undefined) out.splice(to, 0, item);
	return out;
}
