/**
 * A chart to compare (13 §13.1, ApexCharts; H1): several sensors' readings
 * on one scale, as lines or as each day's low to high.
 */

export interface Point {
	t: number;
	v: number;
}

/** One scale for every series shown, with a little room above and below. */
export function scaleOf(series: readonly (readonly Point[])[]): { lo: number; hi: number } | null {
	const vs = series.flatMap((s) => s.map((p) => p.v));
	if (vs.length === 0) return null;
	const lo = Math.min(...vs);
	const hi = Math.max(...vs);
	const pad = Math.max((hi - lo) * 0.1, 1);
	return { lo: lo - pad, hi: hi + pad };
}

/** Each day's low and high, from `from` to `to`, by local day; days with nothing are left out. */
export function dailyRanges(
	points: readonly Point[],
	from: number,
	to: number
): { day: number; low: number; high: number }[] {
	const out = new Map<number, { low: number; high: number }>();
	for (const p of points) {
		if (p.t < from || p.t > to) continue;
		const d = new Date(p.t);
		const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const r = out.get(day);
		if (!r) out.set(day, { low: p.v, high: p.v });
		else {
			r.low = Math.min(r.low, p.v);
			r.high = Math.max(r.high, p.v);
		}
	}
	return [...out].sort((a, b) => a[0] - b[0]).map(([day, r]) => ({ day, ...r }));
}

/** A series' value nearest a moment, for the readout under the pointer. */
export function nearest(points: readonly Point[], t: number): Point | undefined {
	let best: Point | undefined;
	for (const p of points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
	return best;
}
