/**
 * Arranging a free page by pointer (14 §5): a card is dragged by cells, its
 * footprint showing where it lands and the cards it covers moving aside or
 * down as it goes; its corner sizes it by cells. A thing in a stack can be
 * dragged out of it onto the page, and a device or scene into a stack.
 *
 * Only on the twelve-column grid: narrower, the keyboard and a card's up and
 * down arrange it. Loaded while arranging, as the section dragging is.
 */
import { COLS, fit, land, type Box, type Placed } from '#lib/free.js';
import { within, type Range } from '#lib/freePage.js';

export interface CellsHost {
	readonly page: string;
	/** The page as laid out now, on twelve columns. */
	laid(): Placed[];
	/** How small and large a card can be (14 §7). */
	range(ref: string): Range | undefined;
	/** What it would be if let go here, and the footprint with its size; null when nothing is. */
	preview(next: Placed[] | null, foot: (Box & { label?: string }) | null): void;
	/** Let go: every card's place. `moved` is the card that moved, `sized` whether it was sized. */
	commit(next: Placed[], moved: string, sized: boolean): void;
	/** A click on the corner, without a drag: its next usual size. */
	stepSize(ref: string): void;
	/** Whether a thing can go in a stack: devices and scenes. */
	stackable(ref: string): boolean;
	/** The stack it would go in, shown as "Goes in here"; null for none. */
	taking(stack: string | null): void;
	dropInStack(ref: string, stack: string): void;
	/** Out of a stack, onto the page: its own card at `next`. */
	takeOut(thing: string, stack: string, next: Placed[]): void;
	/** Something to read out (the page's status line). */
	say(words: string): void;
	name(ref: string): string;
}

type Held =
	| { mode: 'card'; ref: string; box: Box; gx: number; gy: number }
	| { mode: 'out'; ref: string; stack: string; box: Box; gx: number; gy: number }
	| { mode: 'size'; ref: string; box: Box };

const SKIP = 'button, input, select, textarea, a, label, [contenteditable]';

export function start(root: HTMLElement, host: CellsHost): () => void {
	const grid = () => root.querySelector<HTMLElement>('.cells');

	/** The grid's measures: its columns, its row tracks, its gaps. */
	function measure() {
		const g = grid();
		if (!g) return null;
		const cs = getComputedStyle(g);
		const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
		if (cols !== COLS) return null;
		const rect = g.getBoundingClientRect();
		const cgap = parseFloat(cs.columnGap) || 0;
		const rgap = parseFloat(cs.rowGap) || 0;
		const rows = cs.gridTemplateRows
			.split(' ')
			.map(parseFloat)
			.filter((n) => !Number.isNaN(n));
		const colW = (rect.width - cgap * (COLS - 1)) / COLS;
		return { rect, cgap, rgap, rows, colW };
	}
	type M = NonNullable<ReturnType<typeof measure>>;

	/** The cell under a point; rows past the last are 56 pixels, as an empty row is. */
	function cellAt(m: M, px: number, py: number) {
		const x = Math.floor((px - m.rect.left + m.cgap / 2) / (m.colW + m.cgap));
		let top = m.rect.top;
		let y = 0;
		for (;;) {
			const h = m.rows[y] ?? 56;
			if (py < top + h + m.rgap / 2 || y > 400) break;
			top += h + m.rgap;
			y++;
		}
		return { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, y) };
	}

	const boxOf = (ref: string) => host.laid().find((p) => p.ref === ref);

	/**
	 * Where the page's stacks are as the drag starts: the preview moves them
	 * aside as a card passes, so they're found where they were.
	 */
	let stacks: { ref: string; r: DOMRect }[] = [];
	const findStacks = () =>
		[...root.querySelectorAll<HTMLElement>('.slot[data-stack]')].map((el) => ({
			ref: el.dataset.ref!,
			r: el.getBoundingClientRect()
		}));

	/** A stack's slot under a point, other than `not`. */
	function stackUnder(px: number, py: number, not?: string): string | null {
		const y = py + scrollY;
		for (const { ref, r } of stacks)
			if (ref !== not && px >= r.left && px <= r.right && y >= r.top && y <= r.bottom) return ref;
		return null;
	}

	/** A line of a stack under a point: its contents are inert, so found by where it is. */
	function lineUnder(slot: HTMLElement, px: number, py: number): string | null {
		for (const el of slot.querySelectorAll<HTMLElement>('[data-thing]')) {
			const r = el.getBoundingClientRect();
			if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom)
				return el.dataset.thing ?? null;
		}
		return null;
	}

	let held: Held | null = null;
	let x0 = 0;
	let y0 = 0;
	let started = false;
	let way = 0;
	let lastX = 0;
	let next: Placed[] | null = null;
	let into: string | null = null;

	function reset() {
		held = null;
		started = false;
		next = null;
		into = null;
		way = 0;
		host.preview(null, null);
		host.taking(null);
		delete document.documentElement.dataset.dragging;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0 || held) return;
		const t = e.target as HTMLElement;
		const slot = t.closest<HTMLElement>('.slot[data-ref]');
		if (!slot || !root.contains(slot)) return;
		const m = measure();
		if (!m) return;
		const ref = slot.dataset.ref!;
		const box = boxOf(ref);
		if (!box) return;
		if (t.closest('.resize')) {
			held = { mode: 'size', ref, box };
			e.preventDefault();
			e.stopPropagation();
		} else {
			if (t.closest(SKIP)) return;
			const c = cellAt(m, e.clientX, e.clientY);
			const thing = slot.dataset.stack !== undefined ? lineUnder(slot, e.clientX, e.clientY) : null;
			held = thing
				? { mode: 'out', ref: thing, stack: ref, box: { x: 0, y: 0, w: 2, h: 2 }, gx: 0, gy: 0 }
				: { mode: 'card', ref, box, gx: c.x - box.x, gy: c.y - box.y };
			// No text selected as it's dragged; it takes focus, so its tools show.
			e.preventDefault();
			slot.querySelector<HTMLElement>('.arrange')?.focus({ preventScroll: true });
		}
		x0 = lastX = e.clientX;
		y0 = e.clientY;
		addEventListener('pointermove', move);
		addEventListener('pointerup', up);
		addEventListener('pointercancel', cancel);
		addEventListener('keydown', key);
	}

	function move(e: PointerEvent) {
		if (!held) return;
		if (!started) {
			if (Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
			started = true;
			// Kept in page terms, so a scroll while dragging doesn't move them.
			stacks = findStacks().map(({ ref, r }) => ({
				ref,
				r: new DOMRect(r.x, r.y + scrollY, r.width, r.height)
			}));
			document.documentElement.dataset.dragging = '';
			if (held.mode !== 'size') host.say(`Picked up ${host.name(held.ref)}.`);
		}
		e.preventDefault();
		if (e.clientX !== lastX) way = Math.sign(e.clientX - lastX);
		lastX = e.clientX;
		const m = measure();
		if (!m) return;
		const laid = host.laid();

		if (held.mode === 'size') {
			const stepX = m.colW + m.cgap;
			const stepY = 56 + m.rgap;
			const to = fit({
				...held.box,
				w: held.box.w + Math.round((e.clientX - x0) / stepX),
				h: held.box.h + Math.round((e.clientY - y0) / stepY)
			});
			const r = host.range(held.ref);
			if (r) Object.assign(to, within(r, to));
			to.w = Math.min(to.w, COLS - held.box.x);
			to.x = held.box.x;
			next = land(laid, held.ref, to, 1);
			host.preview(next, { ...to, label: `${to.w} × ${to.h}` });
			return;
		}

		// Over a stack it can go in, or still over the one it came out of: no place.
		const stack =
			held.mode === 'card' && host.stackable(held.ref)
				? stackUnder(e.clientX, e.clientY, held.ref)
				: held.mode === 'out'
					? stackUnder(e.clientX, e.clientY) === held.stack
						? held.stack
						: null
					: null;
		into = held.mode === 'card' ? stack : null;
		host.taking(into);
		if (stack) {
			next = null;
			host.preview(null, null);
			return;
		}
		const c = cellAt(m, e.clientX, e.clientY);
		const to = fit({ x: c.x - held.gx, y: c.y - held.gy, w: held.box.w, h: held.box.h });
		next = land(laid, held.ref, to, way);
		host.preview(next, to);
	}

	function up() {
		const h = held;
		const n = next;
		const s = into;
		const was = started;
		stop();
		if (!h) return;
		if (!was) {
			if (h.mode === 'size') host.stepSize(h.ref);
			return;
		}
		if (h.mode === 'card' && s) host.dropInStack(h.ref, s);
		else if (h.mode === 'out' && n) host.takeOut(h.ref, h.stack, n);
		else if (n) host.commit(n, h.ref, h.mode === 'size');
	}

	function cancel() {
		const was = started && held;
		stop();
		if (was) host.say('Put back.');
	}

	function key(e: KeyboardEvent) {
		if (e.key === 'Escape') cancel();
	}

	function stop() {
		removeEventListener('pointermove', move);
		removeEventListener('pointerup', up);
		removeEventListener('pointercancel', cancel);
		removeEventListener('keydown', key);
		reset();
	}

	// Before a card's own corner handler, so the corner sizes by cells here.
	root.addEventListener('pointerdown', down, true);
	return () => {
		root.removeEventListener('pointerdown', down, true);
		stop();
	};
}
