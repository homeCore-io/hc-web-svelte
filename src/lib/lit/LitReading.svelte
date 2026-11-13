<!--
	A reading in the Lit look (12): the value now, with a faint line of the
	last day behind it, from homeCore's history. A sensor that keeps its own
	safe range (a freezer probe) shows where it sits in it. Drawn with its
	`band` (13 §13.1, F1), its usual range over the week before is shaded
	behind today's line, with today's high and low marked.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import { openDevice } from '#lib/popup.js';
	import { shownUnit } from '#lib/units.js';
	import { shownReading, type Reading } from './room.js';
	import { bandOf } from '#lib/looks/band.js';

	let { r, band = false }: { r: Reading; band?: boolean } = $props();

	const DAY = 24 * 3600 * 1000;
	const W = 300;
	const H = 64;
	const id = $derived(r.card.device.device_id);
	let points = $state<{ t: number; v: number }[]>([]);

	$effect(() => {
		const q = new URLSearchParams({
			attribute: r.attr,
			from: new Date(Date.now() - (band ? 8 : 1) * DAY).toISOString(),
			limit: band ? '5000' : '1000',
			max_points: band ? '400' : '60'
		});
		let gone = false;
		fetch(`/api/v1/devices/${encodeURIComponent(id)}/history?${q}`)
			.then((res) => (res.ok ? res.json() : []))
			.then((rows: { value: unknown; recorded_at: string }[]) => {
				if (gone) return;
				points = rows
					.map((x) => ({ t: Date.parse(x.recorded_at), v: Number(x.value) }))
					.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
					.sort((a, b) => a.t - b.t);
			})
			.catch(() => {});
		return () => (gone = true);
	});

	const a = $derived(r.card.device.attributes ?? {});
	const temp = $derived(r.attr === 'temperature');
	// In the person's units, from the device's own: an Ecowitt's °F is not converted twice.
	const show = (v: number) => shownReading(r, v);
	const unit = $derived(temp ? (shownUnit('°C') ?? '°') : '%');
	const now = $derived(typeof a[r.attr] === 'number' ? show(a[r.attr] as number) : undefined);
	const humidity = $derived(
		temp && typeof a.humidity === 'number' ? Math.round(a.humidity) : undefined
	);

	// Today, and with the band, the week before's usual range (in the person's units).
	const banded = $derived(band ? bandOf(points, Date.now()) : null);
	const usual = $derived(
		banded?.usual ? { low: show(banded.usual.low), high: show(banded.usual.high) } : null
	);
	const path = $derived.by(() => {
		const today = band ? (banded?.today ?? []) : points;
		if (today.length < 2) return null;
		const vs = today.map((p) => show(p.v));
		const lo = Math.min(...vs, ...(usual ? [usual.low] : []));
		const hi = Math.max(...vs, ...(usual ? [usual.high] : []));
		const pad = Math.max((hi - lo) * 0.25, 0.5);
		const start = Date.now() - DAY;
		const x = (t: number) => ((Math.max(t, start) - start) / DAY) * W;
		const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H;
		const line = today
			.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(show(p.v)).toFixed(1)}`)
			.join(' ');
		const mark = (p: { t: number; v: number }) => ({ x: x(p.t), y: y(show(p.v)) });
		return {
			line,
			area: `${line} L${W},${H} L0,${H} Z`,
			lo: Math.min(...vs),
			hi: Math.max(...vs),
			usual: usual ? { top: y(usual.high), bottom: y(usual.low) } : null,
			high: banded ? mark(banded.high) : null,
			low: banded ? mark(banded.low) : null
		};
	});

	// Where now sits in the device's own range, on a scale with room either side.
	const gauge = $derived.by(() => {
		if (!r.range || now === undefined) return null;
		const low = show(r.range.low);
		const high = show(r.range.high);
		const span = high - low;
		const from = low - span * 0.4;
		const to = high + span * 0.4;
		const at = (v: number) => Math.max(0, Math.min(100, ((v - from) / (to - from)) * 100));
		return {
			low,
			high,
			lowAt: at(low),
			highAt: at(high),
			nowAt: at(now),
			ok: now >= low && now <= high
		};
	});
	const round = (v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString());
</script>

<button class="reading" onclick={() => openDevice(id, here.url)} aria-label={`${r.name}: details`}>
	{#if path && !band && !gauge}
		<svg class="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
			<path class="area" d={path.area}></path>
			<path class="line" d={path.line}></path>
		</svg>
	{/if}
	<span class="top">
		<b>{r.name}</b>
		<span class="now"
			>{now === undefined
				? '—'
				: `${round(now)}${temp ? '°' : '%'}`}{#if humidity !== undefined}<small>
					{humidity}%</small
				>{/if}</span
		>
	</span>
	{#if band && path}
		<!-- Its own strip: the usual range, today's line, today's high and low. -->
		<span class="chart" aria-hidden="true">
			<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
				{#if path.usual}
					<rect
						class="usual"
						x="0"
						y={path.usual.top}
						width={W}
						height={Math.max(1, path.usual.bottom - path.usual.top)}
					></rect>
				{/if}
				<path class="line" class:out={!!gauge && !gauge.ok} d={path.line}></path>
			</svg>
			{#if path.high && path.low}
				<span
					class="dot high"
					style:left={`${(path.high.x / W) * 100}%`}
					style:top={`${(path.high.y / H) * 100}%`}
				></span>
				<span
					class="dot low"
					style:left={`${(path.low.x / W) * 100}%`}
					style:top={`${(path.low.y / H) * 100}%`}
				></span>
			{/if}
		</span>
		<span class="sub"
			>Today {round(path.lo)} to {round(path.hi)}{temp ? '°' : '%'}{#if usual}{' · '}usual {round(
					usual.low
				)} to {round(usual.high)}{temp ? '°' : '%'}{/if}{#if gauge && !gauge.ok}
				<em> · out of its range</em>{/if}</span
		>
	{:else if gauge}
		<span
			class="gauge"
			aria-label={`${round(now!)}${unit}, ${gauge.ok ? 'in' : 'outside'} its range of ${round(gauge.low)} to ${round(gauge.high)}`}
		>
			<span
				class="band"
				style:left={`${gauge.lowAt}%`}
				style:width={`${gauge.highAt - gauge.lowAt}%`}
			></span>
			<span class="mark" class:bad={!gauge.ok} style:left={`${gauge.nowAt}%`}></span>
		</span>
		<span class="sub"
			>{gauge.ok ? 'In range' : 'Out of range'} · warns below {round(gauge.low)}° or above {round(
				gauge.high
			)}°</span
		>
	{:else if path}
		<span class="sub">Last 24 h · {round(path.lo)}° to {round(path.hi)}{temp ? '°' : '%'}</span>
	{:else}
		<span class="sub">{r.view.stateLine}</span>
	{/if}
</button>

<style>
	.reading {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 84px;
		padding: 14px 16px;
		border-radius: var(--feel-card-radius);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		text-align: left;
	}
	.spark {
		position: absolute;
		inset: auto 0 0;
		width: 100%;
		height: 64px;
	}
	.chart {
		position: relative;
		height: 48px;
		margin: 2px 0;
	}
	.chart svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.usual {
		fill: color-mix(in srgb, var(--accent) 14%, transparent);
		stroke: color-mix(in srgb, var(--accent) 45%, transparent);
		stroke-dasharray: 4 4;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.line.out {
		stroke: var(--alert);
	}
	.dot {
		position: absolute;
		width: 7px;
		height: 7px;
		margin: -3.5px;
		border-radius: 999px;
		background: var(--ink);
	}
	.dot.low {
		background: var(--surface);
		border: 1.5px solid var(--ink);
		box-sizing: border-box;
	}
	em {
		font-style: normal;
		color: var(--alert);
	}
	.area {
		fill: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.line {
		fill: none;
		stroke: color-mix(in srgb, var(--accent) 70%, transparent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.top {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
	}
	.now {
		font-family: var(--font-num);
		font-size: 22px;
		white-space: nowrap;
	}
	.now small {
		font-size: 14px;
		color: var(--ink-muted);
	}
	.sub {
		position: relative;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.gauge {
		position: relative;
		height: 22px;
		margin-top: 4px;
	}
	.gauge::before {
		content: '';
		position: absolute;
		inset: 8px 0;
		border-radius: 6px;
		background: var(--surface-2);
	}
	.band {
		position: absolute;
		top: 8px;
		bottom: 8px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.mark {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 4px;
		margin-left: -2px;
		border-radius: 4px;
		background: var(--ink);
	}
	.mark.bad {
		background: var(--alert);
	}
</style>
