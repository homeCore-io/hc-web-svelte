<!--
	The Weather card with the time above it (13 §13.1, Clock Weather Card):
	the time and the day, the weather now, and the days ahead each with its
	low to high. Its sky moves gently where the look allows motion (H3) and
	stays still where it doesn't, or where a person asked for less motion.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.js';
	import { lookHere } from '#lib/look.svelte.js';
	import type { Weather } from '#lib/pieces.js';

	let { w, label }: { w: Weather; label: string } = $props();
	const look = lookHere();
	const moving = $derived(look.def.feel.motion !== 'still');

	const at = $derived(new Date(clock.now));
	const time = $derived(at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
	const date = $derived(
		at.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
	);
	// Today's entry: the forecast can start with yesterday.
	const today = $derived(w.forecast.find((d) => d.label === 'Today') ?? w.forecast[0]);
	// The sky from today's weather: sun, cloud, or rain.
	const sky = $derived.by(() => {
		const i = today?.icon ?? 'sun';
		if (['rain', 'drizzle', 'showers', 'hail', 'lightning', 'snow'].includes(i)) return 'rain';
		if (['cloud', 'fog'].includes(i)) return 'cloud';
		if (i === 'moon') return 'moon';
		return i === 'weather' ? 'part' : 'sun';
	});
	// Every day's bar on one scale, from the coldest low to the warmest high.
	const scale = $derived.by(() => {
		const lows = w.forecast.flatMap((d) => (d.low === undefined ? [] : [d.low]));
		const highs = w.forecast.flatMap((d) => (d.high === undefined ? [] : [d.high]));
		const lo = Math.min(...lows, ...highs);
		const hi = Math.max(...lows, ...highs);
		return { lo, span: Math.max(1, hi - lo) };
	});
	const deg = (n: number | undefined) => (n === undefined ? '—' : `${Math.round(n)}°`);
</script>

<article class="clock sky-{sky}" class:moving aria-label={label}>
	<span class="sun" aria-hidden="true"></span>
	<span class="cloud" aria-hidden="true"></span>
	<span class="drops" aria-hidden="true"></span>
	<div class="time"><span class="num">{time}</span><span class="date">{date}</span></div>
	<div class="now">
		<span class="temp num"
			>{#if w.available && w.temperature !== undefined}{Math.round(
					w.temperature
				)}°{:else}—{/if}</span
		>
		<span class="words">{today?.condition ?? w.name}</span>
	</div>
	{#if w.readings.length}
		<div class="readings">
			{#each w.readings.slice(0, 3) as r (r.label)}<span>{r.label} {r.text}</span>{/each}
		</div>
	{/if}
	{#if w.forecast.length}
		<ol class="days" aria-label="Forecast">
			{#each w.forecast.slice(0, 5) as d, i (i)}
				<li>
					<span class="day">{d.label}</span>
					<span class="lo num">{deg(d.low)}</span>
					<span class="bar"
						>{#if d.low !== undefined && d.high !== undefined}<span
								style:left={`${((d.low - scale.lo) / scale.span) * 100}%`}
								style:width={`${((d.high - d.low) / scale.span) * 100}%`}
							></span>{/if}</span
					>
					<span class="hi num">{deg(d.high)}</span>
				</li>
			{/each}
		</ol>
	{/if}
</article>

<style>
	.clock {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;
		border-radius: var(--feel-card-radius);
		border: 1px solid var(--card-line);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, #4a7ab8 22%, var(--surface)) 0%,
			var(--surface) 70%
		);
		color: var(--ink);
	}
	.num {
		font-family: var(--font-num);
	}
	.time,
	.now,
	.readings,
	.days {
		position: relative;
	}
	.time {
		display: flex;
		flex-direction: column;
	}
	.time .num {
		font-size: 48px;
		font-weight: 300;
		line-height: 1;
	}
	.date {
		font-size: 14px;
		color: var(--ink-muted);
	}
	.now {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.temp {
		font-size: 28px;
	}
	.words {
		font-size: 14px;
	}
	.readings {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.days {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 10px 0 0;
		list-style: none;
		border-top: 1px solid var(--line);
	}
	.days li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}
	.day {
		width: 44px;
		color: var(--ink-muted);
	}
	.lo,
	.hi {
		width: 36px;
	}
	.lo {
		text-align: right;
		color: var(--ink-muted);
	}
	.bar {
		position: relative;
		flex: 1;
		height: 6px;
		border-radius: 6px;
		background: var(--surface-2);
	}
	.bar span {
		position: absolute;
		top: 0;
		bottom: 0;
		border-radius: 6px;
		background: linear-gradient(90deg, var(--cool), var(--accent));
	}
	/* The sky: a sun, a cloud, rain; still unless the look allows motion. */
	.sun,
	.cloud,
	.drops {
		position: absolute;
		display: none;
	}
	.sun {
		right: 24px;
		top: 18px;
		width: 70px;
		height: 70px;
		border-radius: 999px;
		background: radial-gradient(
			circle,
			#ffd27a 30%,
			rgba(255, 210, 122, 0.25) 55%,
			transparent 70%
		);
	}
	.sky-moon .sun {
		background: radial-gradient(
			circle,
			#e8e4d8 28%,
			rgba(232, 228, 216, 0.18) 55%,
			transparent 70%
		);
	}
	.cloud {
		right: 12px;
		top: 46px;
		width: 96px;
		height: 34px;
		border-radius: 999px;
		background: rgba(220, 228, 240, 0.8);
		box-shadow: -26px 8px 0 -6px rgba(220, 228, 240, 0.8);
	}
	.drops {
		right: 20px;
		top: 80px;
		width: 80px;
		height: 40px;
		background: repeating-linear-gradient(
			105deg,
			transparent 0 8px,
			rgba(140, 180, 230, 0.55) 8px 10px
		);
		mask: linear-gradient(180deg, #000, transparent);
	}
	.sky-sun .sun,
	.sky-moon .sun,
	.sky-part .sun,
	.sky-part .cloud,
	.sky-cloud .cloud,
	.sky-rain .cloud,
	.sky-rain .drops {
		display: block;
	}
	.moving .sun {
		animation: glow 4s ease-in-out infinite;
	}
	.moving .cloud {
		animation: drift 9s ease-in-out infinite;
	}
	.moving .drops {
		animation: fall 1.2s linear infinite;
	}
	@keyframes glow {
		50% {
			opacity: 0.75;
		}
	}
	@keyframes drift {
		50% {
			transform: translateX(10px);
		}
	}
	@keyframes fall {
		to {
			background-position: 0 40px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.moving .sun,
		.moving .cloud,
		.moving .drops {
			animation: none;
		}
	}
</style>
