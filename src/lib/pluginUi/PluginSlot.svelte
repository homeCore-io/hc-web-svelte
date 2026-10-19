<!--
	A plugin's own component, where it declared one: loads its module (once),
	creates its element, and hands it the `host` and, in a device panel, the
	device. If it can't be loaded, says so — the caller decides what shows
	instead.
-->
<script lang="ts">
	import { createHost } from './host.svelte.js';
	import { loadModule, type PluginUi, type UiSlot } from './uis.svelte.js';
	import type { PluginElement } from './types.js';

	let {
		pluginId,
		ui,
		slot,
		deviceId,
		onfail
	}: {
		pluginId: string;
		ui: PluginUi;
		slot: UiSlot;
		deviceId?: string;
		onfail?: (why: string) => void;
	} = $props();

	let box = $state<HTMLDivElement | undefined>(undefined);
	let el = $state<PluginElement | undefined>(undefined);
	let failed = $state('');

	$effect(() => {
		if (!box) return;
		const tag = slot.element;
		let gone = false;
		failed = '';
		loadModule(pluginId, ui, tag)
			.then(() => {
				if (gone || !box) return;
				const made = document.createElement(tag) as PluginElement;
				made.host = createHost(pluginId);
				if (deviceId !== undefined) made.deviceId = deviceId;
				box.replaceChildren(made);
				el = made;
			})
			.catch((e: unknown) => {
				if (gone) return;
				failed = `Its screens didn’t load (${String((e as Error)?.message ?? e).slice(0, 160)}).`;
				onfail?.(failed);
			});
		return () => {
			gone = true;
			box?.replaceChildren();
			el = undefined;
		};
	});
	// A different device in the same panel: told, not recreated.
	$effect(() => {
		if (el && deviceId !== undefined && el.deviceId !== deviceId) el.deviceId = deviceId;
	});
</script>

<div class="slot" bind:this={box}></div>
{#if failed}<p class="quiet" role="status">{failed}</p>{/if}

<style>
	.slot {
		min-width: 0;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
