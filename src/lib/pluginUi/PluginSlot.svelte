<!--
	A plugin's own component, where it declared one: loads its module (once),
	creates its element, and hands it the `host` and, in a device panel, the
	device. If it can't be loaded, says so — the caller decides what shows
	instead.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { createHost } from './host.svelte.js';
	import { isStale, loadModule, type PluginUi, type UiSlot } from './uis.svelte.js';
	import type { PluginElement } from './types.js';

	let {
		pluginId,
		ui,
		slot,
		deviceId,
		element,
		form,
		config,
		onfail,
		onchange
	}: {
		pluginId: string;
		ui: PluginUi;
		slot: UiSlot;
		deviceId?: string;
		/** Another element of the same module than the slot's own (a card's settings). */
		element?: string;
		form?: 'compact' | 'standard' | 'large';
		config?: Record<string, unknown>;
		onfail?: (why: string) => void;
		/** Its `change` event's detail. */
		onchange?: (detail: Record<string, unknown>) => void;
	} = $props();

	let box = $state<HTMLDivElement | undefined>(undefined);
	let el = $state<PluginElement | undefined>(undefined);
	let failed = $state('');
	// The plugin was updated while the app was open: its old screens stay until a reload.
	const stale = $derived(isStale(element ?? slot.element, ui) && !!el);

	// Made again only for another plugin, element or build — not each time
	// the list of plugin screens is read again, which hands over equal but
	// new objects; anything else is told to the element below.
	const tag = $derived(element ?? slot.element);
	const build = $derived(ui.build);
	// A prop reads through to what the caller built it from (a whole device);
	// a derived only changes when the value does.
	const plugin = $derived(pluginId);

	$effect(() => {
		if (!box) return;
		void [plugin, tag, build];
		return untrack(() => mount(tag));
	});

	function mount(tag: string) {
		const listen = (e: Event) =>
			onchange?.((e as CustomEvent<Record<string, unknown>>).detail ?? {});
		let gone = false;
		failed = '';
		loadModule(pluginId, ui, tag)
			.then(() => {
				if (gone || !box) return;
				const made = document.createElement(tag) as PluginElement;
				made.host = createHost(pluginId);
				if (deviceId !== undefined) made.deviceId = deviceId;
				if (form !== undefined) made.form = form;
				if (config !== undefined) made.config = config;
				made.addEventListener('change', listen);
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
			el?.removeEventListener('change', listen);
			box?.replaceChildren();
			el = undefined;
		};
	}
	// A different device, size or settings: told, not recreated.
	$effect(() => {
		if (!el) return;
		if (deviceId !== undefined && el.deviceId !== deviceId) el.deviceId = deviceId;
		if (form !== undefined && el.form !== form) el.form = form;
		if (config !== undefined && el.config !== config) el.config = config;
	});
</script>

{#if stale}
	<p class="updated" role="status">
		This plugin was updated. <button type="button" onclick={() => location.reload()}
			>Reload to see its new screens</button
		>
	</p>
{/if}
<div class="slot" bind:this={box}></div>
{#if failed}<p class="quiet" role="status">{failed}</p>{/if}

<style>
	.slot {
		min-width: 0;
	}
	.updated {
		margin: 0 0 8px;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
	}
	.updated button {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
