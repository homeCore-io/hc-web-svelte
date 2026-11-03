<!--
	A chart to compare (13 §13.1, ApexCharts; H1): several sensors' readings
	on one scale, as lines or as each day's low to high, from homeCore's
	history. Tap a sensor to hide it; the pointer reads every one at a moment.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { shownUnit, toShown } from '#lib/units.js';
	import { dailyRanges, nearest, scaleOf, type Point } from '#lib/compare.js';

	let {
		ids,
		attr,
		span,
		style
	}: { ids: string[]; attr: 'temperature' | 'humidity'; span: number; style: 'lines' | 'range' } =
		$props();

	const COLORS = ['var(--accent)', 'var(--cool)', 'var(--alert)', '#6fd39a', '#c78bff', '#ff9ad1'];
	const MAX = 6;
	const W = 600;
	const H = 200;
	const temp = $derived(attr === 'temperature');
	const show = (v: number) => (temp ? toShown(v, '°C') : v);
	const unit = $derived(temp ? (shownUnit('°C') ?? '°') : '%');
	const fmt = (v: number) =>
		`${Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v)}${temp ? '°' : '%'}`;

	let data = $state<Record<string, Point[]>>({});
	let hidden = $state<Record<string, boolean>>({});
	let at = $state<number | null>(null);
	const shownIds = $derived(ids.slice(0, MAX));

	$effect(() => {
		const want = shownIds;
		const from = new Date(Date.now() - span).toISOString();
		let gone = false;
		void Promise.all(
			want.map(async (id) => {
				const q = new URLSearchParams({ attribute: attr, from, limit: '5000', max_points: '200' });
				const res = await fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`).catch(
					() => null
				);
				const rows = res?.ok
					? ((await res.json()) as { value: unknown; recorded_at: string }[])
					: [];
				const pts = rows
					.map((x) => ({ t: Date.parse(x.recorded_at), v: Number(x.value) }))
					.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
					.sort((a, b) => a.t - b.t);
				return [id, pts] as const;
			})
		).then((all) => {
			if (!gone) data = Object.fromEntries(all);
		});
		return () => (gone = true);
	});

	const now = $derived(Date.now());
	const from = $derived(now - span);
	const series = $derived(
		shownIds.map((id, i) => ({
			id,
			color: COLORS[i % COLORS.length]!,
			name: devices.byId[id] ? displayName(devices.byId[id]!) : 'A sensor that’s gone',
			pts: (data[id] ?? []).map((p) => ({ t: p.t, v: show(p.v) })),
			now: devices.byId[id]?.attributes?.[attr]
		}))
	);
	const visible = $derived(series.filter((s) => !hidden[s.id]));
	const scale = $derived(scaleOf(visible.map((s) => s.pts)));
	const x = (t: number) => ((t - from) / span) * W;
	const y = (v: number) => (scale ? H - ((v - scale.lo) / (scale.hi - scale.lo)) * H : H / 2);
	const lines = $derived(
		style === 'lines'
			? visible.map((s) => ({
					color: s.color,
					d: s.pts
						.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
						.join(' ')
				}))
			: []
	);
	const bars = $derived.by(() => {
		if (style !== 'range') return [];
		const dayW = (24 * 3600_000 * W) / span;
		const w = Math.max(2, (dayW / (visible.length + 1)) * 0.8);
		return visible.flatMap((s, si) =>
			dailyRanges(s.pts, from, now).map((r) => ({
				color: s.color,
				x: x(r.day) + (si + 0.5) * (dayW / (visible.length + 1)),
				w,
				y: y(r.high),
				h: Math.max(2, y(r.low) - y(r.high))
			}))
		);
	});
	const readout = $derived(
		at === null
			? null
			: {
					x: x(at),
					when: new Date(at).toLocaleString([], {
						weekday: span > 24 * 3600_000 ? 'short' : undefined,
						hour: 'numeric',
						minute: '2-digit'
					}),
					values: visible.flatMap((s) => {
						const p = nearest(s.pts, at!);
						return p ? [{ color: s.color, name: s.name, v: fmt(p.v) }] : [];
					})
				}
	);
	function move(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		at = from + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * span;
	}
</script>

<div class="compare">
	<div class="legend">
		{#each series as s (s.id)}
			<button
				class:off={hidden[s.id]}
				aria-pressed={!hidden[s.id]}
				onclick={() => (hidden = { ...hidden, [s.id]: !hidden[s.id] })}
				><span class="swatch" style:background={s.color}
				></span>{s.name}{#if typeof s.now === 'number'}<span class="num">{fmt(show(s.now))}</span
					>{/if}</button
			>
		{/each}
	</div>
	{#if ids.length > MAX}<p class="quiet">The first {MAX} of {ids.length}.</p>{/if}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="plot" onpointermove={move} onpointerleave={() => (at = null)}>
		<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
			{#each [0.25, 0.5, 0.75] as f (f)}<line class="grid" x1="0" x2={W} y1={H * f} y2={H * f}
				></line>{/each}
			{#each bars as b, i (i)}<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill={b.color}
				></rect>{/each}
			{#each lines as l, i (i)}<path d={l.d} stroke={l.color}></path>{/each}
			{#if readout}<line class="cross" x1={readout.x} x2={readout.x} y1="0" y2={H}></line>{/if}
		</svg>
		{#if scale}
			<span class="axis top num">{fmt(scale.hi)}</span>
			<span class="axis bottom num">{fmt(scale.lo)}</span>
		{:else}
			<span class="empty">No history for {temp ? 'these temperatures' : 'this humidity'} yet.</span>
		{/if}
		{#if readout && readout.values.length}
			<div class="tip" class:flip={readout.x > W * 0.6} style:left={`${(readout.x / W) * 100}%`}>
				<b>{readout.when}</b>
				{#each readout.values as v (v.name)}<span
						><span class="swatch" style:background={v.color}></span>{v.name}<span class="num"
							>{v.v}</span
						></span
					>{/each}
			</div>
		{/if}
	</div>
	<span class="sr-only">Readings in {unit}.</span>
</div>

<style>
	.compare {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.legend button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font-size: 12.5px;
	}
	.legend button.off {
		color: var(--ink-muted);
	}
	.legend button.off .swatch {
		opacity: 0.25;
	}
	.swatch {
		width: 10px;
		height: 10px;
		flex: none;
		border-radius: 3px;
	}
	.num {
		font-family: var(--font-num);
	}
	.plot {
		position: relative;
		height: 200px;
		cursor: crosshair;
		touch-action: pan-y;
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.grid {
		stroke: var(--line);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	path {
		fill: none;
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	rect {
		opacity: 0.85;
	}
	.cross {
		stroke: var(--ink-muted);
		stroke-dasharray: 3 3;
		vector-effect: non-scaling-stroke;
	}
	.axis {
		position: absolute;
		left: 0;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.axis.top {
		top: 0;
	}
	.axis.bottom {
		bottom: 0;
	}
	.empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.tip {
		position: absolute;
		top: 6px;
		transform: translateX(10px);
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
	}
	.tip.flip {
		transform: translateX(calc(-100% - 10px));
	}
	.tip span {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.tip .num {
		margin-left: auto;
	}
	.quiet {
		margin: 0;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
</style>
