/**
 * Dragging while arranging (13 §9.2): the pointer work, loaded only while a
 * page is being arranged. It finds what's held by the page's own markers
 * (`data-ref` on a card, `data-sec` on a section, `data-sec-handle` on a
 * section's heading), says where it would land through `drag`, and on
 * letting go asks the page to make the same change its buttons make.
 *
 * A mouse picks up by pressing and moving; a touch by pressing and holding.
 * A floating copy follows the pointer; the page scrolls near the edges;
 * Escape, or letting go where nothing takes it, puts it back.
 */
import { drag } from '../drag.svelte.js';

export interface DragHost {
	page: string;
	/** Why a section won't take this card, or null when it will. */
	refuses(section: string, ref: string, kind: string, from: string): string | null;
	dropCard(ref: string, into: string, before: string | null): void;
	dropSection(id: string, before: string | null, column: string | undefined): void;
}

const HOLD_MS = 400;
const SLOP_TOUCH = 8;
const SLOP_MOUSE = 6;
const EDGE = 80;

/** Start listening on a page's root; returns how to stop. */
export function start(root: HTMLElement, host: DragHost): () => void {
	let pending: {
		x: number;
		y: number;
		id: number;
		touch: boolean;
		card?: HTMLElement;
		handle?: HTMLElement;
		timer?: ReturnType<typeof setTimeout>;
	} | null = null;
	let active: { card?: HTMLElement; section?: HTMLElement; from: string; kind: string } | null =
		null;
	let ghost: HTMLElement | null = null;
	let offset = { x: 0, y: 0 };
	let last = { x: 0, y: 0 };
	let scrolling = 0;

	const sectionOf = (el: Element | null) =>
		(el?.closest('[data-sec]') as HTMLElement | null) ?? null;

	function down(e: PointerEvent) {
		if (e.button !== 0 || active) return;
		const t = e.target as HTMLElement;
		// Buttons, fields and links keep their own jobs (the tools, the + slots, the corner).
		if (t.closest('button, a, input, select, textarea, label, [contenteditable]')) return;
		const handle = t.closest('[data-sec-handle]') as HTMLElement | null;
		const card = handle ? null : (t.closest('[data-ref]') as HTMLElement | null);
		if (card && card.dataset.list !== 'page') return;
		if (!card && !handle) return;
		const touch = e.pointerType === 'touch';
		pending = {
			x: e.clientX,
			y: e.clientY,
			id: e.pointerId,
			touch,
			card: card ?? undefined,
			handle: handle ?? undefined
		};
		if (touch) pending.timer = setTimeout(() => pending && begin(pending.x, pending.y), HOLD_MS);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	function begin(x: number, y: number) {
		if (!pending) return;
		const p = pending;
		pending = null;
		clearTimeout(p.timer);
		const from = p.handle ?? p.card!;
		const sec = sectionOf(from);
		if (!sec) return;
		drag.page = host.page;
		if (p.card) {
			active = { card: p.card, from: sec.dataset.sec!, kind: p.card.dataset.kind ?? '' };
			drag.ref = p.card.dataset.ref!;
			drag.said = `Picked up ${p.card.getAttribute('aria-label') ?? 'a card'}.`;
		} else {
			active = { section: sec, from: sec.dataset.sec!, kind: '' };
			drag.section = sec.dataset.sec!;
			drag.said = `Picked up the ${sec.getAttribute('aria-label') ?? 'section'}.`;
		}
		const lift = (p.card ?? p.handle)!;
		const r = lift.getBoundingClientRect();
		offset = { x: x - r.left, y: y - r.top };
		ghost = lift.cloneNode(true) as HTMLElement;
		ghost.removeAttribute('id');
		Object.assign(ghost.style, {
			position: 'fixed',
			left: `${r.left}px`,
			top: `${r.top}px`,
			width: `${r.width}px`,
			margin: '0',
			zIndex: '1000',
			pointerEvents: 'none',
			opacity: '0.92',
			transform: 'scale(1.03) rotate(-0.6deg)',
			boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
			borderRadius: '16px'
		});
		ghost.setAttribute('aria-hidden', 'true');
		document.body.append(ghost);
		if (p.touch) {
			window.addEventListener('touchmove', noScroll, { passive: false });
			navigator.vibrate?.(10);
		}
		window.addEventListener('keydown', escape);
		document.documentElement.dataset.dragging = '';
		last = { x, y };
		aim();
		scrolling = requestAnimationFrame(edge);
	}

	function move(e: PointerEvent) {
		if (pending && e.pointerId === pending.id) {
			const d = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
			if (pending.touch) {
				// Moving before the hold is a scroll: let it be.
				if (d > SLOP_TOUCH) stopPending();
			} else if (d > SLOP_MOUSE) begin(e.clientX, e.clientY);
			return;
		}
		if (!active) return;
		last = { x: e.clientX, y: e.clientY };
		if (ghost) {
			ghost.style.left = `${e.clientX - offset.x}px`;
			ghost.style.top = `${e.clientY - offset.y}px`;
		}
		aim();
	}

	/** Where it would land, from where the pointer is. */
	function aim() {
		if (!active) return;
		const under = document.elementFromPoint(last.x, last.y);
		const sec = sectionOf(under);
		if (!sec || !root.contains(sec)) return;
		const id = sec.dataset.sec!;
		if (active.card) {
			const ref = active.card.dataset.ref!;
			const why = host.refuses(id, ref, active.kind, active.from);
			if (why) {
				drag.refused = { section: id, why };
				drag.into = null;
				return;
			}
			drag.refused = null;
			drag.into = id;
			drag.before = beforeIn(sec, ref);
		} else if (active.section) {
			if (id === active.section.dataset.sec) return;
			const r = sec.getBoundingClientRect();
			const upper = last.y < r.top + r.height / 2;
			drag.column = sec.dataset.col;
			drag.sectionBefore = upper ? id : nextSection(sec);
		}
	}

	/** The card in a section that the held one would go in front of; null for the end. */
	function beforeIn(sec: HTMLElement, held: string): string | null {
		const cards = [...sec.querySelectorAll<HTMLElement>('[data-ref]')].filter(
			(c) => c.dataset.ref !== held && sectionOf(c) === sec
		);
		for (const c of cards) {
			const r = c.getBoundingClientRect();
			if (last.y < r.top) return c.dataset.ref!;
			if (last.y <= r.bottom && last.x < r.left + r.width / 2) return c.dataset.ref!;
		}
		return null;
	}

	function nextSection(sec: HTMLElement): string | null {
		let n = sec.nextElementSibling;
		while (n && !(n instanceof HTMLElement && n.dataset.sec)) n = n.nextElementSibling;
		return n instanceof HTMLElement ? (n.dataset.sec ?? null) : null;
	}

	/** Near the top or bottom, the page scrolls, and where it would land follows. */
	function edge() {
		if (!active) return;
		const dy = last.y < EDGE ? -14 : last.y > innerHeight - EDGE ? 14 : 0;
		if (dy) {
			scrollBy(0, dy);
			aim();
		}
		scrolling = requestAnimationFrame(edge);
	}

	function up(e: PointerEvent) {
		if (pending && e.pointerId === pending.id) return stopPending();
		if (!active) return;
		const a = active;
		if (a.card && drag.into && !drag.refused) {
			host.dropCard(a.card.dataset.ref!, drag.into, drag.before);
			swallowClick();
		} else if (a.section && drag.sectionBefore !== undefined) {
			host.dropSection(a.section.dataset.sec!, drag.sectionBefore, drag.column);
			swallowClick();
		} else drag.said = 'Put back where it was.';
		finish();
	}

	function cancel() {
		if (pending) return stopPending();
		if (active) drag.said = 'Put back where it was.';
		finish();
	}
	function escape(e: KeyboardEvent) {
		if (e.key === 'Escape') cancel();
	}
	const noScroll = (e: TouchEvent) => e.preventDefault();

	// The click that ends a drag isn't a tap on whatever it was let go over.
	function swallowClick() {
		const stop = (e: Event) => {
			e.stopPropagation();
			e.preventDefault();
		};
		window.addEventListener('click', stop, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
	}

	function stopPending() {
		if (pending) clearTimeout(pending.timer);
		pending = null;
		unlisten();
	}

	function finish() {
		active = null;
		ghost?.remove();
		ghost = null;
		cancelAnimationFrame(scrolling);
		window.removeEventListener('touchmove', noScroll);
		window.removeEventListener('keydown', escape);
		delete document.documentElement.dataset.dragging;
		drag.clear();
		unlisten();
	}

	function unlisten() {
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
		window.removeEventListener('pointercancel', cancel);
	}

	root.addEventListener('pointerdown', down);
	return () => {
		root.removeEventListener('pointerdown', down);
		stopPending();
		finish();
	};
}
