<script lang="ts">
	import DashboardWidget from '$lib/components/dashboard/DashboardWidget.svelte';
	import type { DashboardDefinition } from '$lib/models/dashboard';
	import { dashboardBreakpointForWidth, layoutForBreakpoint } from '$lib/models/dashboard';
	import type { DeviceState } from '$lib/models/device';
	import type { Scene } from '$lib/models/scene';
	import type { ModeState } from '$lib/models/mode';
	import type { HcEvent } from '$lib/models/event';

	let {
		dashboard,
		devices = [],
		scenes = [],
		modes = [],
		events = []
	}: {
		dashboard: DashboardDefinition;
		devices?: DeviceState[];
		scenes?: Scene[];
		modes?: ModeState[];
		events?: HcEvent[];
	} = $props();

	let width = $state(1280);
	const breakpoint = $derived(dashboardBreakpointForWidth(width));
	const layout = $derived(layoutForBreakpoint(dashboard, breakpoint));
	const widgetById = $derived(new Map(dashboard.widgets.map((widget) => [widget.id, widget])));
</script>

<svelte:window bind:innerWidth={width} />

{#if !layout}
	<p>No dashboard layout available.</p>
{:else}
	<div
		class="grid"
		style={`--columns:${layout.columns}; --row-height:${layout.row_height}px; --gap:${layout.gap}px;`}
	>
		{#each layout.placements as placement (placement.widget_id)}
			{@const widget = widgetById.get(placement.widget_id)}
			{#if widget}
				<div
					class="placement"
					style={`grid-column:${placement.x + 1} / span ${placement.w}; grid-row:${placement.y + 1} / span ${placement.h};`}
				>
					<DashboardWidget {dashboard} {layout} {widget} {devices} {scenes} {modes} {events} />
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		grid-auto-rows: var(--row-height);
		gap: var(--gap);
		align-items: stretch;
	}

	.placement {
		min-width: 0;
		min-height: 0;
	}
</style>
