<!-- A reading over time on a page (G-c): one sensor's temperature or humidity, from homeCore's history. -->
<script lang="ts">
	import { reading } from '#lib/card.js';
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
	const now = $derived(d?.schema ? reading(d.attributes, d.schema, src.attr) : undefined);
	const what = $derived(src.attr === 'humidity' ? 'Humidity' : 'Temperature');
</script>

<article class="piece" aria-label={label ?? (d ? displayName(d) : 'Chart')}>
	<div class="top">
		<span class="names">
			<h3>{label ?? (d ? displayName(d) : 'Chart')}</h3>
			{#if d}<span class="what">{what}</span>{/if}
		</span>
		{#if now}<span class="now num">{now}</span>{/if}
	</div>
	{#if !src.id}
		<p class="quiet">Choose a sensor in its settings.</p>
	{:else if !d}
		<p class="quiet">The sensor it charted is gone.</p>
	{:else}
		<Chart
			deviceId={d.device_id}
			attr={src.attr}
			label={what}
			unit={d.schema?.attributes[src.attr]?.unit}
			bool={false}
			current={d.attributes[src.attr]}
			span={spanOf(o.span)}
			compact
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
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
	}
	.names {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	.what {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.now {
		flex: none;
		white-space: nowrap;
		font-size: 22px;
		line-height: 1.1;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
