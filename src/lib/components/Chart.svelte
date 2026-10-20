<!--
	One reading over the last day (or `span`, ending `end`), from homeCore's history: a line
	for a number, a band for on/off. Drawn as plain SVG — no chart library to ship. homeCore
	reads at most so many rows; when it stops short, the chart says so.
-->
<script lang="ts">
	import { placesOf, shownUnit, toShown } from '#lib/units.js';

	const DAY = 24 * 3600_000;
	let {
		deviceId,
		attr,
		label,
		unit,
		bool,
		current,
		span = DAY,
		end
	}: {
		deviceId: string;
		attr: string;
		label: string;
		unit?: string;
		bool: boolean;
		current?: unknown;
		/** How far back, in ms: a day unless said. */
		span?: number;
		/** When it ends, in ms since 1970: now unless said. */
		end?: number;
	} = $props();

	interface Point {
		t: number;
		v: number;
	}

	const spanText = $derived(span <= DAY ? '24 hours' : `${Math.round(span / DAY)} days`);
	const spanShort = $derived(span <= DAY ? '24 h' : `${Math.round(span / DAY)} d`);
	let points = $state<Point[] | null>(null);
	let failed = $state(false);
	/** homeCore read as many rows as it would and stopped: the start is missing. */
	let cut = $state(false);
	/** The end the drawing uses: the one asked for, or now when it was fetched. */
	let until = $state(Date.now());

	$effect(() => {
		const id = deviceId;
		const name = attr;
		const back = span;
		const stop = end ?? Date.now();
		let gone = false;
		points = null;
		failed = false;
		cut = false;
		until = stop;
		const q = new URLSearchParams({
			attribute: name,
			from: new Date(stop - back).toISOString(),
			// Enough rows for a busy sensor's week; homeCore thins them to 160.
			limit: String(back > DAY ? 5000 : 1000),
			max_points: '160'
		});
		if (end !== undefined) q.set('to', new Date(stop).toISOString());
		fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`)
			.then((r) => {
				if (!r.ok) return Promise.reject(r.status);
				if (!gone) cut = r.headers.get('X-Truncated') === 'true';
				return r.json();
			})
			.then((rows: { value: unknown; recorded_at: string }[]) => {
				if (gone) return;
				points = rows
					.map((r) => ({
						t: Date.parse(r.recorded_at),
						v: typeof r.value === 'boolean' ? (r.value ? 1 : 0) : Number(r.value)
					}))
					.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
					.sort((a, b) => a.t - b.t);
			})
			.catch(() => {
				if (!gone) failed = true;
			});
		return () => (gone = true);
	});

	const W = 320;
	const H = 72;
	const shape = $derived.by(() => {
		if (!points) return null;
		// Nothing recorded means nothing changed: it held its current value.
		const now = typeof current === 'boolean' ? (current ? 1 : 0) : Number(current);
		const series =
			points.length > 0 || !Number.isFinite(now) || end !== undefined
				? points
				: [{ t: until - span, v: now }];
		if (series.length === 0) return null;
		// In the person's units: a day of °C drawn and labelled in °F.
		return draw(bool ? series : series.map((p) => ({ t: p.t, v: toShown(p.v, unit) })));
	});

	function draw(points: Point[]) {
		const last = until;
		const start = last - span;
		const x = (t: number) => ((Math.max(t, start) - start) / span) * W;
		if (bool) {
			// Bands where it was true, each lasting until the next reading.
			const bands: { x: number; w: number }[] = [];
			points.forEach((p, i) => {
				if (p.v !== 1) return;
				const next = points[i + 1]?.t ?? last;
				bands.push({ x: x(p.t), w: Math.max(2, x(next) - x(p.t)) });
			});
			return { bands, line: '', min: 0, max: 1 };
		}
		const vs = points.map((p) => p.v);
		let min = Math.min(...vs);
		let max = Math.max(...vs);
		if (max - min < 1e-9) {
			min -= 1;
			max += 1;
		}
		const y = (v: number) => H - 6 - ((v - min) / (max - min)) * (H - 12);
		// A step line: a reading holds until the next one.
		let d = '';
		points.forEach((p, i) => {
			d += i === 0 ? `M${x(p.t)},${y(p.v)}` : `H${x(p.t)}V${y(p.v)}`;
		});
		d += `H${W}`;
		return { bands: [], line: d, min: Math.min(...vs), max: Math.max(...vs) };
	}
	const shownAs = $derived(shownUnit(unit));
	const fmt = (v: number) => {
		const p = placesOf(shownAs) ?? 1;
		return Number.isInteger(v) ? String(v) : v.toFixed(Math.max(1, p));
	};
	/** An end that isn't now, as a day: "Tue 14 Oct". */
	const day = (t: number) =>
		new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
	const past = $derived(end !== undefined);
</script>

<div class="chart">
	<div class="head">
		<span>{label}, {past ? `${spanText} to ${day(until)}` : `last ${spanText}`}</span>
		{#if shape && !bool}
			<span class="num range"
				>{fmt(shape.min) === fmt(shape.max)
					? fmt(shape.min)
					: `${fmt(shape.min)}–${fmt(shape.max)}`}{shownAs === '%'
					? '%'
					: shownAs
						? ` ${shownAs}`
						: ''}</span
			>
		{/if}
	</div>
	{#if failed}
		<p class="quiet">History isn't available.</p>
	{:else if points === null}
		<div class="placeholder"></div>
	{:else if shape === null}
		<p class="quiet">Nothing recorded in {past ? 'those' : 'the last'} {spanText}.</p>
	{:else}
		<svg
			viewBox={`0 0 ${W} ${H}`}
			preserveAspectRatio="none"
			role="img"
			aria-label={`${label} over the last ${spanText}`}
		>
			{#each shape.bands as b, i (i)}
				<rect x={b.x} y="8" width={b.w} height={H - 16} rx="3" />
			{/each}
			{#if shape.line}<path d={shape.line} />{/if}
		</svg>
		<div class="axis" aria-hidden="true">
			{#if past}<span>{day(until - span)}</span><span>{day(until)}</span>{:else}<span
					>{spanShort} ago</span
				><span>now</span>{/if}
		</div>
		{#if cut}
			<p class="quiet">
				homeCore stopped at as many readings as it reads at once, so the earliest part is missing.
			</p>
		{/if}
	{/if}
</div>

<style>
	.chart {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--ink-muted);
		font-weight: 600;
	}
	.range {
		font-weight: 400;
	}
	svg {
		width: 100%;
		height: 72px;
		display: block;
		border-radius: 10px;
		background: var(--surface-2);
	}
	path {
		fill: none;
		stroke: var(--track-on);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	rect {
		fill: var(--fill);
	}
	.placeholder {
		height: 72px;
		border-radius: 10px;
		background: var(--surface-2);
	}
	.axis {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
