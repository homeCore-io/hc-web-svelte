/**
 * The console's look on a phone (the PhonePlan board): which of its pages an
 * address is, which of the four sections along the bottom it belongs to, and
 * how a room's faders and a lamp's bars are laid across a narrow screen.
 *
 * Pure: the phone's pages draw what this decides.
 */
import type { CoreDevice } from '#lib/devices.js';
import { viewOf, type ViewId } from '../everywhere.js';

export { PHONE_MAX, PHONE_QUERY } from './width.js';

/** The four sections along the bottom. */
export type Section = 'home' | 'rooms' | 'everywhere' | 'cameras';

/** A page the phone draws its own way; anything else is drawn as it is, in a plain frame. */
export type PhonePage =
	| { kind: 'home' }
	| { kind: 'rooms' }
	| { kind: 'room'; id: string }
	| { kind: 'everywhere'; view: ViewId }
	| { kind: 'cameras' };

/** The page at `pathname`, when the phone draws it its own way. */
export function phonePageOf(pathname: string): PhonePage | undefined {
	if (pathname === '/') return { kind: 'home' };
	if (pathname === '/rooms') return { kind: 'rooms' };
	if (pathname === '/cameras') return { kind: 'cameras' };
	const room = /^\/rooms\/([^/]+)$/.exec(pathname);
	// The devices in no room are a page of the standard kind.
	if (room && room[1] !== 'none') return { kind: 'room', id: decodeURIComponent(room[1]!) };
	const ev = /^\/everywhere\/([^/]+)$/.exec(pathname);
	const view = ev ? viewOf(ev[1]) : undefined;
	if (view) return { kind: 'everywhere', view };
	return undefined;
}

/** The section an address belongs to, lit along the bottom; none for the rest. */
export function sectionOf(pathname: string): Section | undefined {
	if (pathname === '/') return 'home';
	if (pathname === '/rooms' || pathname.startsWith('/rooms/')) return 'rooms';
	if (pathname.startsWith('/everywhere/')) return 'everywhere';
	if (pathname === '/cameras') return 'cameras';
	return undefined;
}

/** The narrowest a fader may be on the phone, its pill a thumb's width. */
export const FADER_MIN = 64;
/** The gap between faders. */
export const FADER_GAP = 8;

/**
 * How many faders sit across a row `width` pixels wide, `n` in all, each
 * at least `FADER_MIN`: every one where they fit, else as many as do, the
 * rest wrapping to rows below. Never fewer than one.
 */
export function fadersAcross(n: number, width: number): number {
	if (n <= 0) return 1;
	const fit = Math.max(1, Math.floor((width + FADER_GAP) / (FADER_MIN + FADER_GAP)));
	if (n <= fit) return n;
	// Rows as even as they can be: seven at five across is four and three.
	const rows = Math.ceil(n / fit);
	return Math.ceil(n / rows);
}

/** A level from where a finger is along a bar, 0 to 100, at whole steps. */
export function levelAt(x: number, left: number, width: number): number {
	if (width <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round(((x - left) / width) * 100)));
}

/** How far a sheet must be pulled down before letting go closes it. */
export const PULL_CLOSE = 90;

/** Whether a pull down by `dy` pixels, at `speed` pixels a millisecond, closes a sheet. */
export const pullCloses = (dy: number, speed = 0): boolean =>
	dy > PULL_CLOSE || (dy > 30 && speed > 0.6);

/** A light's white, warm to cool, as its schema declares it: the attribute, in kelvin. */
export interface Warmth {
	attr: string;
	/** The warmest and the coolest it goes. */
	warm: number;
	cool: number;
	/** Where it is now, when it says. */
	now?: number;
	step: number;
}

/** A light's warm-to-cool white, when it has one it can be set to. */
export function warmthOf(d: Pick<CoreDevice, 'attributes' | 'schema'>): Warmth | undefined {
	for (const [attr, spec] of Object.entries(d.schema?.attributes ?? {})) {
		if (spec.kind !== 'color_temp' || spec.writable !== true) continue;
		if (spec.min === undefined || spec.max === undefined || spec.max <= spec.min) continue;
		// Kelvin, the way homeCore keeps it; mireds run the other way.
		const mired = /mire?d/i.test(spec.unit ?? '');
		const v = d.attributes?.[attr];
		const now = typeof v === 'number' ? v : undefined;
		return {
			attr,
			warm: mired ? spec.max : spec.min,
			cool: mired ? spec.min : spec.max,
			now,
			step: spec.step ?? (mired ? 1 : 50)
		};
	}
	return undefined;
}

/** Where a white sits along the strip, 0 (warm) to 1 (cool). */
export function whiteAt(w: Warmth, v = w.now): number | undefined {
	if (v === undefined) return undefined;
	return Math.max(0, Math.min(1, (v - w.warm) / (w.cool - w.warm)));
}

/** The white at a place along the strip, 0 (warm) to 1 (cool), at the light's steps. */
export function whiteFor(w: Warmth, at: number): number {
	const v = w.warm + Math.max(0, Math.min(1, at)) * (w.cool - w.warm);
	const lo = Math.min(w.warm, w.cool);
	const hi = Math.max(w.warm, w.cool);
	return Math.max(lo, Math.min(hi, Math.round(v / w.step) * w.step));
}
