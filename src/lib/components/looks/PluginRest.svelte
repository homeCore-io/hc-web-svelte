<!--
	A plugin's rest view for a display (13 §12.2): its element over the whole
	screen, given the house's things, until a touch or its own `wake` event.
	If its plugin no longer offers it, or it doesn't load, Lit's rest view
	shows instead (`fallback`).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { thingOf } from '#lib/looks/thing.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';

	let { id, wake, fallback }: { id: string; wake: () => void; fallback: Snippet } = $props();

	const plugin = $derived.by(() => {
		const found = pluginUis.look(id);
		return found?.slot.slot === 'look.piece' && found.slot.draws?.includes('rest')
			? found
			: undefined;
	});
	let failed = $state(false);
	const things = $derived(
		Object.values(devices.byId).map((d) => {
			const view = cardFor(d, clock.now);
			return thingOf(d, view, view.name, roomOf(d, rooms.list)?.name ?? '');
		})
	);
</script>

{#if plugin && !failed}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="rest" onclick={wake}>
		<PluginSlot
			pluginId={plugin.pluginId}
			ui={plugin.ui}
			slot={plugin.slot}
			props={{ things }}
			on={{ wake }}
			onfail={() => (failed = true)}
		/>
	</div>
{:else}
	{@render fallback()}
{/if}

<style>
	.rest {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: #07090c;
		overflow: hidden;
	}
</style>
