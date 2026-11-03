<!--
	All batteries (13 §13.1, F2): every battery in the house, lowest first,
	for seeing every level before one is low. Low ones are alerts already;
	this is where the rest are.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { batteriesOf } from '#lib/batteries.js';
	import BatteryList from '#lib/components/BatteryList.svelte';

	$effect(() => heading.show('All batteries', { href: '/alerts', label: 'Alerts' }));
	const list = $derived.by(() => {
		void alerts.list;
		return batteriesOf(Object.values(devices.byId));
	});
</script>

<div class="stack">
	{#if !devices.loaded}
		<p class="quiet">Loading the house…</p>
	{:else if list.length === 0}
		<p class="quiet">Nothing in the house reports a battery.</p>
	{:else}
		<p class="quiet">
			{list.length} batteries, lowest first. Low is homeCore's judgment, the same as Alerts.
		</p>
		<BatteryList {list} />
	{/if}
</div>

<style>
	.stack {
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
