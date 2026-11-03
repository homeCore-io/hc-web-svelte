/**
 * A reading's band (13 §13.1, F1): today's high and low, and its usual range
 * over the week before, shaded behind today's line so a day out of the
 * ordinary shows at a glance. "Usual" is the middle 80% of that week's
 * values, so one odd reading doesn't stretch it.
 */

export interface Point {
	t: number;
	v: number;
}

export interface Band {
	/** Today: the last 24 hours. */
	today: Point[];
	high: Point;
	low: Point;
	/** The week before, its middle 80%; none until it has enough to say. */
	usual: { low: number; high: number } | null;
}

const DAY = 24 * 3600 * 1000;
/** Fewer than this many readings in the week before says nothing usual. */
const ENOUGH = 12;

const quantile = (sorted: number[], q: number): number => {
	const at = (sorted.length - 1) * q;
	const lo = Math.floor(at);
	const hi = Math.ceil(at);
	return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
};

export function bandOf(points: readonly Point[], now: number): Band | null {
	const today = points.filter((p) => p.t > now - DAY && p.t <= now);
	if (today.length === 0) return null;
	const high = today.reduce((a, b) => (b.v > a.v ? b : a));
	const low = today.reduce((a, b) => (b.v < a.v ? b : a));
	const week = points
		.filter((p) => p.t <= now - DAY && p.t > now - 8 * DAY)
		.map((p) => p.v)
		.sort((a, b) => a - b);
	const usual =
		week.length >= ENOUGH ? { low: quantile(week, 0.1), high: quantile(week, 0.9) } : null;
	return { today, high, low, usual };
}
