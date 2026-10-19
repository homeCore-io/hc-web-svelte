<!--
	A plugin's own form for an automation step on its devices (the `rule.step`
	slot): loads its module, asks its class whether it `accepts` the step,
	and creates its element with the devices and the step. What it reports
	back is the whole step — taken only when it sets this plugin's devices.
	When it declines, can't load, or overreaches, the editor's generic form is
	shown instead (`onreject`).
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { createHost } from './host.svelte.js';
	import {
		loadModule,
		stepTargets as targets,
		type PluginUi,
		type StepClass,
		type UiSlot
	} from './uis.svelte.js';
	import type { PluginElement } from './types.js';

	type Json = Record<string, unknown>;
	let {
		pluginId,
		ui,
		slot,
		deviceIds,
		value,
		onchange,
		onreject
	}: {
		pluginId: string;
		ui: PluginUi;
		slot: UiSlot;
		deviceIds: string[];
		value: Json;
		onchange: (action: Json) => void;
		onreject: (why: string) => void;
	} = $props();

	let box = $state<HTMLDivElement | undefined>(undefined);
	let el = $state<PluginElement | undefined>(undefined);

	$effect(() => {
		if (!box) return;
		let gone = false;
		const listen = (e: Event) => {
			const action = (e as CustomEvent<{ action?: Json }>).detail?.action;
			const ids = targets(action);
			// Only its own devices: a plugin's form sets nothing else.
			if (!ids || !ids.every((id) => devices.byId[id]?.plugin_id === pluginId))
				return onreject('Its form tried to set something it doesn’t look after.');
			onchange(action!);
		};
		loadModule(pluginId, ui, slot.element)
			.then(() => {
				if (gone || !box) return;
				const cls = customElements.get(slot.element) as unknown as StepClass | undefined;
				if (cls?.accepts && !cls.accepts(value)) return onreject('It doesn’t say this step.');
				const made = document.createElement(slot.element) as PluginElement;
				made.host = createHost(pluginId);
				made.deviceIds = deviceIds;
				made.value = value;
				made.addEventListener('change', listen);
				box.replaceChildren(made);
				el = made;
			})
			.catch((e: unknown) => {
				if (!gone)
					onreject(`Its form didn’t load (${String((e as Error)?.message ?? e).slice(0, 120)}).`);
			});
		return () => {
			gone = true;
			el?.removeEventListener('change', listen);
			box?.replaceChildren();
			el = undefined;
		};
	});
	// A change made here, or elsewhere: told, not recreated.
	$effect(() => {
		if (!el) return;
		if (el.value !== value) el.value = value;
		if (el.deviceIds !== deviceIds) el.deviceIds = deviceIds;
	});
</script>

<div class="slot" bind:this={box}></div>

<style>
	.slot {
		min-width: 0;
	}
</style>
