<!-- A reading over time on a page (G-c): one sensor's temperature or humidity, from homeCore's history. -->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { CHART_BUILT_IN, chartSource, spanOf } from '#lib/options.js';
	import Chart from '../Chart.svelte';

	let { card, page, label, options }: KindProps<'chart'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'chart', card.ref, CHART_BUILT_IN));
	const src = $derived(chartSource(o));
	const d = $derived(src.id ? devices.byId[src.id] : undefined);
</script>

<article class="piece" aria-label={label ?? (d ? displayName(d) : 'Chart')}>
	<h3>{label ?? (d ? displayName(d) : 'Chart')}</h3>
	{#if !src.id}
		<p class="quiet">Choose a sensor in its settings.</p>
	{:else if !d}
		<p class="quiet">The sensor it charted is gone.</p>
	{:else}
		<Chart
			deviceId={d.device_id}
			attr={src.attr}
			label={src.attr === 'humidity' ? 'Humidity' : 'Temperature'}
			unit={d.schema?.attributes[src.attr]?.unit}
			bool={false}
			current={d.attributes[src.attr]}
			span={spanOf(o.span)}
		/>
	{/if}
</article>

<style>
	.piece {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
