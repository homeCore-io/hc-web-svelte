<!--
	A plugin card's settings on a page: the plugin's own settings element
	(its `dashboard.card` slot's `settings`), in a dialog. What it reports is
	kept with the page (`config` change), in the household's or the person's
	layer — whichever is being arranged.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import type { PluginUi, UiSlot } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';

	let {
		page,
		cardId,
		pluginId,
		ui,
		slot,
		config,
		name,
		close
	}: {
		page: string;
		cardId: string;
		pluginId: string;
		ui: PluginUi;
		slot: UiSlot;
		config: Record<string, unknown>;
		name: string;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());
	let failed = $state('');
	function save(detail: Record<string, unknown>) {
		const next = detail.config;
		if (next && typeof next === 'object' && !Array.isArray(next))
			view.change(page, { op: 'config', ref: cardId, config: next as Record<string, unknown> });
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={`${name}: settings`}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<h2>{name}</h2>
			<button class="x" aria-label="Done" onclick={() => dialog?.close()}><X size={20} /></button>
		</header>
		{#if failed}
			<p class="quiet">{failed}</p>
		{:else}
			<PluginSlot
				{pluginId}
				{ui}
				{slot}
				element={slot.settings}
				{config}
				onchange={save}
				onfail={(why) => (failed = why)}
			/>
		{/if}
		<p class="quiet">Changes are kept as you make them.</p>
	</div>
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		padding: 0;
		border: none;
		border-radius: var(--radius);
		background: var(--sheet);
		color: var(--ink);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.35);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 17px;
	}
	.x {
		border: none;
		background: none;
		color: var(--ink-muted);
		padding: 4px;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
