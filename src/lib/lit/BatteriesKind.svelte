<!-- A room's batteries (13 §13.1, F2): a piece listing every battery in it, lowest first. -->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import { devices } from '#lib/devices.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { batteriesOf } from '#lib/batteries.js';
	import BatteryList from '../components/BatteryList.svelte';

	let { card }: KindProps<'batteries'> = $props();
	// Live, and following homeCore's alerts on what's low.
	const list = $derived.by(() => {
		void alerts.list;
		return batteriesOf(card.devices.map((d) => devices.byId[d.device_id] ?? d));
	});
</script>

<div class="span-all"><BatteryList {list} /></div>
