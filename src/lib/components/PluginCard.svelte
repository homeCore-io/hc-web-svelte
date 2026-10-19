<!--
	A plugin's own card added to a page (`dashboard.card`, ref
	`card:{plugin}/{element}/{n}`), drawn at its size with this page's settings
	for it. When the plugin isn't running, or the card won't load, a quiet
	stand-in says so — so it can still be found and taken off.
-->
<script lang="ts">
	import type { Form } from '#lib/layers.js';
	import { cardRef } from '#lib/layers.js';
	import { pluginLabel } from '#lib/inventory.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';

	let {
		cardId,
		form = 'standard',
		config = {}
	}: { cardId: string; form?: Form; config?: Record<string, unknown> } = $props();

	pluginUis.ensure();
	const parts = $derived(cardRef(cardId));
	const found = $derived(parts ? pluginUis.card(parts.pluginId, parts.element) : undefined);
	let failed = $state('');
</script>

<div class="plugin-card" class:large={form === 'large'}>
	{#if parts && found && !failed}
		<PluginSlot
			pluginId={parts.pluginId}
			ui={found.ui}
			slot={found.slot}
			{form}
			{config}
			onfail={(why) => (failed = why)}
		/>
	{:else}
		<div class="missing">
			<b>{found?.slot.label ?? 'A plugin’s card'}</b>
			<span
				>{failed ||
					(pluginUis.loaded
						? `${parts ? pluginLabel(parts.pluginId) : 'Its plugin'} isn’t running, or no longer has this card.`
						: 'Loading…')}</span
			>
		</div>
	{/if}
</div>

<style>
	.plugin-card {
		min-width: 0;
	}
	.plugin-card.large {
		grid-column: span 2;
	}
	.missing {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 88px;
		padding: 12px 14px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
		font-size: 13px;
	}
	.missing b {
		color: var(--ink);
		font-size: 14px;
	}
</style>
