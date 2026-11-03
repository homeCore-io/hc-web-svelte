<!--
	A reading over time on a page (G-c): one sensor's temperature or humidity,
	from homeCore's history; or several to compare (13 §13.1, H1): this
	room's readings, or any chosen.
-->
<script lang="ts">
	import { reading } from '#lib/card.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { CHART_BUILT_IN, chartSource, compareSource, spanOf } from '#lib/options.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import Chart from '../Chart.svelte';

	let { card, page, label, options }: KindProps<'chart'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'chart', card.ref, CHART_BUILT_IN));
	const src = $derived(chartSource(o));
	const d = $derived(src.id ? devices.byId[src.id] : undefined);
	const now = $derived(d?.schema ? reading(d.attributes, d.schema, src.attr) : undefined);
	const what = $derived(src.attr === 'humidity' ? 'Humidity' : 'Temperature');

	// Comparing: the sensors chosen, or this room's that have the reading.
	const comparing = $derived(o.drawing === 'compare');
	const cmp = $derived(compareSource(o));
	const room = $derived(page.startsWith('room:') ? page.slice(5) : null);
	const cmpIds = $derived(
		cmp.ids !== 'room'
			? cmp.ids
			: room
				? Object.values(devices.byId)
						.filter(
							(x) =>
								typeof x.attributes?.[cmp.attr] === 'number' && roomOf(x, rooms.list)?.id === room
						)
						.map((x) => x.device_id)
				: []
	);
</script>

{#if comparing}
	<article class="piece" aria-label={label ?? 'Chart'}>
		<div class="top">
			<span class="names">
				<h3>{label ?? (cmp.attr === 'humidity' ? 'Humidity' : 'Temperatures')}</h3>
				<span class="what">{cmp.ids === 'room' ? 'This room’s readings' : 'To compare'}</span>
			</span>
		</div>
		{#if cmpIds.length === 0}
			<p class="quiet">
				{cmp.ids === 'room' && !room
					? 'On Home, choose the sensors in its settings.'
					: 'Nothing here reads that yet. Choose sensors in its settings.'}
			</p>
		{:else}
			{#await import('../CompareChart.svelte') then { default: CompareChart }}
				<CompareChart
					ids={cmpIds}
					attr={cmp.attr}
					span={spanOf(o.span)}
					style={o.style === 'range' ? 'range' : 'lines'}
				/>
			{/await}
		{/if}
	</article>
{:else}
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
{/if}

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
