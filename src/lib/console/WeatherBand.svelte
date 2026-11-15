<!--
	The weather band on Home (weather.ts): now, with today's high and low,
	the wind and a warning or a freeze tonight; the next 24 hours as a line
	with the chance of rain under it; and the next three days, seven at a
	tap, each its low to its high on one scale. Each part shows only when it
	has something to say, and the band only when one does. With no forecast
	it is now alone, small.

	People who may change the house's content choose where now comes from
	in its "From" menu, for the household. On the phone the 24 hours and the
	week open under a link. How much is open is kept on the screen
	(weatherChoice.ts).
-->
<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { HomeNow } from './homeNow.svelte.js';
	import { CHART, dayRowsOf, type NowSource } from './weather.js';
	import { setWeatherOpen, weatherOpen } from './weatherChoice.js';

	let { h, phone = false }: { h: HomeNow; phone?: boolean } = $props();

	const band = $derived(h.weather);
	const n = $derived(band?.now);

	// Three days or the week; on the phone, the 24 hours and the week together.
	let week = $state(weatherOpen('week'));
	let more = $state(weatherOpen('phone'));
	const toggleWeek = () => {
		week = !week;
		setWeatherOpen('week', week);
	};
	const toggleMore = () => {
		more = !more;
		setWeatherOpen('phone', more);
	};
	const all = $derived(phone ? more : week);
	const rows = $derived(band ? dayRowsOf(band.days, all ? 7 : 3, n?.value) : []);
	const hours = $derived(phone && !more ? undefined : band?.hours);
	const fewest = $derived(Math.min(7, band?.days.length ?? 0));
	// The chart is drawn to its width, a pixel a unit, so its words and its
	// height stay the same however wide it is: its lines are stretched across.
	let chartWidth = $state(0);
	const wide = $derived(chartWidth || CHART.w);
	const stretch = $derived(wide / CHART.w);

	// "From Weather Station" under the temperature when it isn't the service's.
	const fromWord = $derived(n?.from ?? 'the weather service');
	const pick = (e: Event & { currentTarget: HTMLSelectElement }) =>
		void h.chooseNow(e.currentTarget.value as NowSource);
	// The icon's color: the sun warm, rain and snow cool.
	const tint = (icon: string | undefined) =>
		icon === 'sun' || icon === 'moon'
			? 'sun'
			: icon && /rain|drizzle|showers|snow|hail|lightning/.test(icon)
				? 'wet'
				: '';
</script>

{#if band}
	<section
		class="wx"
		class:full={band.full}
		class:phone
		class:hashours={!!hours}
		class:hasdays={rows.length > 0}
		aria-label="Weather"
	>
		{#if n}
			<div class="now">
				<div class="nowtop">
					{#if n.icon}<span class="sky {tint(n.icon)}"
							><Icon name={n.icon} size={phone ? 36 : 40} /></span
						>{/if}
					<span class="big">{n.temp}</span>
					<span class="cond">
						{#if n.condition}<b>{n.condition}</b>{/if}
						{#if phone && (n.high || n.low)}<span
								>{[n.high && `H ${n.high}`, n.low && `L ${n.low}`].filter(Boolean).join(' ')}</span
							>{:else if n.feels}<span>{n.feels}</span>{/if}
					</span>
				</div>
				{#if h.mayChooseNow}
					<span class="from pickable"
						>From {fromWord}<select
							aria-label="Current conditions from"
							value={h.nowSource}
							onchange={pick}
						>
							{#each h.nowChoices as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
						</select></span
					>
				{:else if n.from}
					<span class="from">From {n.from}</span>
				{/if}
				{#if !phone && (n.high || n.low || n.wind || n.humidity)}
					<p class="facts">
						{#if n.high || n.low}<span
								>{#if n.high}H <b>{n.high}</b>{/if}
								{#if n.low}L <b>{n.low}</b>{/if}</span
							>{/if}
						{#if n.wind}<span>Wind <b>{n.wind}</b></span>{/if}
						{#if n.humidity}<span>Humidity <b>{n.humidity}</b></span>{/if}
					</p>
				{/if}
				{#if n.note}<p class="note" class:red={n.note.tone === 'red'}>{n.note.text}</p>{/if}
			</div>
		{/if}

		{#if hours}
			<div class="hours" bind:clientWidth={chartWidth}>
				<h3 class="sect">Next 24 hours</h3>
				<svg viewBox="0 0 {wide} {CHART.h}" role="img" aria-label={hours.label}>
					<g transform="scale({stretch} 1)">
						<path class="floor" d="M0 {CHART.floor}h{CHART.w}" />
						<g class="bars">
							{#each hours.bars as b (b.x)}<rect x={b.x} y={b.y} width={b.w} height={b.h} />{/each}
						</g>
						<path class="line" d={hours.path} />
					</g>
					<circle class="dot" cx={hours.dot.x * stretch} cy={hours.dot.y} r="4.5" />
					{#each hours.marks as m (m.text + m.x)}<text
							x={m.x * stretch}
							y={m.y}
							text-anchor={m.anchor}
							class:rain={m.rain}>{m.text}</text
						>{/each}
				</svg>
				<div class="ticks" aria-hidden="true">
					{#each hours.ticks as t (t.at)}<span
							class:minor={t.minor}
							class:first={t.at === 0}
							style:left="{t.at}%">{t.text}</span
						>{/each}
				</div>
			</div>
		{/if}

		{#if rows.length > 0}
			<div class="days">
				{#if !phone}
					<div class="sect">
						<h3>{week ? 'This week' : 'Next 3 days'}</h3>
						{#if band.days.length > 3}<button
								type="button"
								class="more"
								aria-expanded={week}
								onclick={toggleWeek}>{week ? 'Show 3 days' : `Show ${fewest} days`}</button
							>{/if}
					</div>
				{/if}
				<ol class="rows">
					{#each rows as r (r.label)}
						<li class="r" class:today={r.label === 'Today'}>
							<b>{r.label}</b>
							<span class="sky {tint(r.icon)}" title={r.condition}
								>{#if r.icon}<Icon name={r.icon} size={phone ? 18 : 20} />{/if}</span
							>
							<span class="lo">{r.low ?? ''}</span>
							<span class="pp">{r.rain ?? ''}</span>
							<span class="span" aria-hidden="true"
								>{#if r.bar}<i style:left="{r.bar.left}%" style:right="{r.bar.right}%"
									></i>{/if}{#if r.dot !== undefined}<s style:left="{r.dot}%"></s>{/if}</span
							>
							<span class="hi">{r.high ?? ''}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}

		{#if phone && (band.hours || band.days.length > 3)}
			<button type="button" class="more wide" aria-expanded={more} onclick={toggleMore}
				>{more
					? 'Show less'
					: band.hours
						? `Next 24 hours and ${fewest} days`
						: `Show ${fewest} days`}</button
			>
		{/if}
	</section>
{/if}

<style>
	.wx {
		position: relative;
		display: grid;
		grid-template-columns: minmax(200px, 0.8fr) minmax(0, 1.3fr) minmax(0, 1.1fr);
		grid-template-areas: 'now hours days';
		gap: 18px;
		align-items: start;
		margin: 0 28px 10px;
		padding: 14px 16px;
		border-radius: 18px;
		background:
			linear-gradient(160deg, rgba(90, 120, 255, 0.1), rgba(255, 170, 80, 0.08)),
			color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: inset 0 0 0 1px var(--con-edge, var(--line));
	}
	.wx > div {
		min-width: 0;
	}
	.now {
		grid-area: now;
		display: grid;
		gap: 6px;
		align-content: start;
	}
	.hours {
		grid-area: hours;
	}
	.days {
		grid-area: days;
	}
	/* Fewer parts, fewer columns. */
	.wx:not(.hashours) {
		grid-template-columns: minmax(200px, 0.8fr) minmax(0, 1.6fr);
		grid-template-areas: 'now days';
	}
	.wx:not(.hasdays) {
		grid-template-columns: minmax(200px, 0.8fr) minmax(0, 2fr);
		grid-template-areas: 'now hours';
	}
	/* Now alone, with no forecast: a small block, as Home's outside once was. */
	.wx:not(.full) {
		display: flex;
		width: fit-content;
		padding: 10px 16px;
	}

	.nowtop {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.sky {
		display: grid;
		place-items: center;
		color: color-mix(in srgb, var(--ink) 70%, transparent);
	}
	.sky.sun {
		color: var(--track-on);
	}
	.sky.wet {
		color: var(--cool);
	}
	.big {
		font-size: 46px;
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.cond {
		display: flex;
		flex-direction: column;
		min-width: 0;
		white-space: nowrap;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.cond b {
		font-size: 16px;
		color: var(--ink);
	}
	.from {
		position: relative;
		justify-self: start;
		font-size: 12px;
		color: var(--ink-muted);
	}
	/* The menu sits over its words, unseen: tapping "From …" opens it. */
	.from.pickable {
		color: var(--accent);
		font-weight: 600;
		cursor: pointer;
	}
	.from.pickable::after {
		content: ' ▾';
		font-size: 10px;
	}
	.from select {
		position: absolute;
		inset: 0;
		width: 100%;
		opacity: 0;
		cursor: pointer;
		font: inherit;
	}
	.from:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 4px;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin: 0;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.facts b {
		color: var(--ink);
		font-weight: 600;
	}
	.note {
		margin: 0;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--accent);
	}
	.note.red {
		color: var(--alert);
	}

	/* ---- the next 24 hours ---- */
	.sect {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.sect h3 {
		margin: 0;
		font: inherit;
	}
	.more {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: 600 12.5px var(--font);
		letter-spacing: 0;
		text-transform: none;
		cursor: pointer;
	}
	svg {
		display: block;
		width: 100%;
		height: 86px;
		overflow: visible;
	}
	.floor {
		stroke: var(--con-edge, var(--line));
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.bars {
		fill: var(--cool);
		opacity: 0.4;
	}
	.line {
		fill: none;
		stroke: var(--track-on);
		stroke-width: 3;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.dot {
		fill: var(--track-on);
	}
	text {
		font: 500 12px var(--font);
		fill: var(--ink-muted);
	}

	text.rain {
		fill: var(--cool);
		font-weight: 600;
	}
	.ticks {
		position: relative;
		height: 16px;
		margin-top: 2px;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.ticks span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
	}
	.ticks span.first {
		transform: none;
	}

	/* ---- the next days ---- */
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}
	.r {
		display: grid;
		grid-template-columns: 50px 24px 36px 34px minmax(40px, 1fr) 36px;
		gap: 8px;
		align-items: center;
		padding: 3px 4px;
		border-radius: 8px;
		font-size: 13px;
	}
	.r.today {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}
	.r b {
		font-weight: 700;
	}
	.lo {
		text-align: right;
		color: var(--ink-muted);
	}
	.pp {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--cool);
	}
	.hi {
		font-weight: 700;
	}
	.span {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
	}
	.span i {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--cool), var(--track-on));
	}
	.span s {
		position: absolute;
		top: -3px;
		width: 8px;
		height: 8px;
		margin-left: -6px;
		border-radius: 50%;
		background: var(--ink);
		border: 2px solid var(--surface);
	}

	/* ---- narrower Homes (Home's container) ---- */
	/* An iPad in landscape: the three still side by side, the hours every six. */
	@container home (max-width: 900px) {
		.wx {
			grid-template-columns: minmax(190px, 0.8fr) minmax(0, 1.1fr) minmax(0, 1.3fr);
			gap: 14px;
			padding: 12px 14px;
		}
		.big {
			font-size: 40px;
		}
		.ticks .minor {
			display: none;
		}
		.r {
			grid-template-columns: 42px 22px 32px 30px minmax(30px, 1fr) 32px;
			gap: 6px;
		}
	}
	/* An iPad upright: now beside the days, the 24 hours under both. */
	@container home (max-width: 720px) {
		.wx.full {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			grid-template-areas: 'now days' 'hours hours';
		}
		.wx.full:not(.hasdays) {
			grid-template-areas: 'now now' 'hours hours';
		}
		.wx.full:not(.hashours) {
			grid-template-areas: 'now days';
		}
		.ticks .minor {
			display: inline;
		}
	}
	/* Narrower still: one above the other. */
	@container home (max-width: 560px) {
		.wx {
			margin: 0 16px 10px;
		}
		.wx.full {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'now' 'days' 'hours';
		}
		.wx.full:not(.hasdays) {
			grid-template-areas: 'now' 'hours';
		}
		.wx.full:not(.hashours) {
			grid-template-areas: 'now' 'days';
		}
		.ticks .minor {
			display: none;
		}
	}
	/* A shorter window: a slimmer band, as the greeting is. */
	@media (max-height: 820px) {
		.wx {
			padding-top: 10px;
			padding-bottom: 10px;
		}
	}

	/* ---- the phone: now, then the days, the rest under the link ---- */
	.wx.phone {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin: 12px 16px 0;
		padding: 14px;
	}
	.phone .days {
		order: 1;
	}
	.phone .hours {
		order: 2;
	}
	.phone .wide {
		order: 3;
	}
	.phone .big {
		font-size: 42px;
	}
	.phone .r {
		grid-template-columns: 46px 22px 34px 32px minmax(40px, 1fr) 34px;
		gap: 6px;
	}
	.phone .ticks .minor {
		display: none;
	}
	.wide {
		align-self: flex-start;
		min-height: 32px;
	}
</style>
