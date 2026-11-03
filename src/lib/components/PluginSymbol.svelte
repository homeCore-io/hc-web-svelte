<!--
	A plugin's symbol (13 §12, `look.symbol`): its element, told which symbol
	to draw, at the size of the icon it stands in for. While it loads, or if
	its plugin no longer offers it, the plain symbol shows (`children`).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';

	let { id, size, children }: { id: string; size: number; children: Snippet } = $props();

	pluginUis.ensure();
	const name = $derived(id.split('#')[1] ?? '');
	const plugin = $derived.by(() => {
		const found = pluginUis.look(id);
		return found?.slot.slot === 'look.symbol' && found.slot.symbols?.includes(name)
			? found
			: undefined;
	});
	let failed = $state(false);
</script>

{#if plugin && !failed}
	<span class="symbol" style:font-size={`${size}px`} aria-hidden="true">
		<PluginSlot
			pluginId={plugin.pluginId}
			ui={plugin.ui}
			slot={plugin.slot}
			props={{ name }}
			quiet
			onfail={() => (failed = true)}
		/>
	</span>
{:else}
	{@render children()}
{/if}

<style>
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 1em;
		height: 1em;
		line-height: 1;
	}
</style>
