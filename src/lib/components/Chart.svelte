<!--
	One reading over the last day, from homeCore's history: a line for a number,
	a band for on/off. Drawn as plain SVG — no chart library to ship.
-->
<script lang="ts">
	let {
		deviceId,
		attr,
		label,
		unit,
		bool,
		current
	}: {
		deviceId: string;
		attr: string;
		label: string;
		unit?: string;
		bool: boolean;
		current?: unknown;
	} = $props();

	interface Point {
		t: number;
		v: number;
	}

	const DAY = 24 * 3600_000;
	let points = $state<Point[] | null>(null);
	let failed = $state(false);

	$effect(() => {
		const id = deviceId;
		const name = attr;
		let gone = false;
		points = null;
		failed = false;
		const from = new Date(Date.now() - DAY).toISOString();
		fetch(
			`/api/v1/devices/${encodeURIComponent(id)}/history?attribute=${encodeURIComponent(name)}&from=${encodeURIComponent(from)}&max_points=160`
		)
			.then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
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
			points.length > 0 || !Number.isFinite(now) ? points : [{ t: Date.now() - DAY, v: now }];
		return series.length === 0 ? null : draw(series);
	});

	function draw(points: Point[]) {
		const end = Date.now();
		const start = end - DAY;
		const x = (t: number) => ((Math.max(t, start) - start) / DAY) * W;
		if (bool) {
			// Bands where it was true, each lasting until the next reading.
			const bands: { x: number; w: number }[] = [];
			points.forEach((p, i) => {
				if (p.v !== 1) return;
				const next = points[i + 1]?.t ?? end;
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
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
</script>

<div class="chart">
	<div class="head">
		<span>{label}, last 24 hours</span>
		{#if shape && !bool}
			<span class="num range"
				>{fmt(shape.min) === fmt(shape.max)
					? fmt(shape.min)
					: `${fmt(shape.min)}–${fmt(shape.max)}`}{unit === '%'
					? '%'
					: unit
						? ` ${unit}`
						: ''}</span
			>
		{/if}
	</div>
	{#if failed}
		<p class="quiet">History isn't available.</p>
	{:else if points === null}
		<div class="placeholder"></div>
	{:else if shape === null}
		<p class="quiet">Nothing recorded in the last day.</p>
	{:else}
		<svg
			viewBox={`0 0 ${W} ${H}`}
			preserveAspectRatio="none"
			role="img"
			aria-label={`${label} over the last 24 hours`}
		>
			{#each shape.bands as b, i (i)}
				<rect x={b.x} y="8" width={b.w} height={H - 16} rx="3" />
			{/each}
			{#if shape.line}<path d={shape.line} />{/if}
		</svg>
		<div class="axis" aria-hidden="true"><span>24 h ago</span><span>now</span></div>
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
