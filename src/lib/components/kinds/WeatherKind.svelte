<!--
	The weather from a weather device (G21): its temperature, its other main
	readings, and — where the device has one — a forecast. The house's
	weather station unless another device was chosen.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { WEATHER_BUILT_IN } from '#lib/options.js';
	import { stationOf, weatherOf } from '#lib/pieces.js';

	let { card, page, label, options }: KindProps<'weather'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'weather', card.ref, WEATHER_BUILT_IN));
	const station = $derived(stationOf(devices.byId, o.station));
	const w = $derived(station ? weatherOf(station, clock.now) : undefined);
	const deg = (n: number | undefined) => (n === undefined ? '—' : `${Math.round(n)}°`);
</script>

<article class="piece" aria-label={label ?? 'Weather'}>
	<div class="top">
		<h3>{label ?? 'Outside'}</h3>
		{#if w}<span class="from">{w.name}</span>{/if}
	</div>
	{#if !w}
		<p class="quiet">No weather station. Choose a device in its settings.</p>
	{:else}
		<div class="now">
			<span class="temp">{w.available ? deg(w.temperature) : '—'}</span>
			<span class="readings">
				{#each w.readings as r (r.label)}
					<span><span class="label">{r.label}</span> {r.text}</span>
				{/each}
				{#if !w.available}<span class="alert">Not reporting</span>{/if}
			</span>
		</div>
		{#if w.forecast.length > 0}
			<ol class="forecast" aria-label="Forecast">
				{#each w.forecast as d, i (i)}
					<li>
						<span class="day">{d.label}</span>
						<span class="hl">{deg(d.high)}<span class="low"> {deg(d.low)}</span></span>
						{#if d.condition}<span class="cond">{d.condition}</span>{/if}
						{#if d.rain !== undefined}<span class="rain">{Math.round(d.rain)}% rain</span>{/if}
					</li>
				{/each}
			</ol>
		{/if}
	{/if}
</article>

<style>
	.piece {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
		min-width: 0;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	.from {
		font-size: 12px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.now {
		display: flex;
		align-items: flex-end;
		gap: 14px;
		flex-wrap: wrap;
	}
	.temp {
		font-family: var(--font-num);
		font-size: 40px;
		line-height: 1;
	}
	.readings {
		display: flex;
		flex-direction: column;
		font-size: 13px;
		font-family: var(--font-num);
	}
	.label {
		font-family: inherit;
		color: var(--ink-muted);
	}
	.alert {
		color: var(--alert);
	}
	.forecast {
		list-style: none;
		margin: 0;
		padding: 10px 0 0;
		border-top: 1px solid var(--line);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
		gap: 8px;
	}
	.forecast li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		min-width: 0;
	}
	.day {
		font-weight: 700;
	}
	.hl {
		font-family: var(--font-num);
		font-size: 14px;
	}
	.low,
	.cond,
	.rain {
		color: var(--ink-muted);
	}
	.cond {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
