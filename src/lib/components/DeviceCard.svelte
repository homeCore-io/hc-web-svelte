<!--
	A device's card: the plugin's own (`device.card`), when it carries one for
	this kind of device and this size and its class doesn't decline this
	device (`accepts`) — else, or if it won't load, the generic one
	(GenericDeviceCard).
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import type { Form } from '#lib/layers.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { deviceView } from '#lib/pluginUi/host.svelte.js';
	import type { CardElementClass } from '#lib/pluginUi/types.js';
	import { loadModule, pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import GenericDeviceCard from './GenericDeviceCard.svelte';

	let {
		device,
		form = 'standard',
		page,
		label
	}: {
		device: CoreDevice;
		form?: Form;
		page?: string;
		/** The name this page gives the card, if it was renamed there (M2). */
		label?: string;
	} = $props();

	pluginUis.ensure();
	const custom = $derived.by(() => {
		const found = pluginUis.find(device.plugin_id, 'device.card', device.device_type);
		const forms = found?.slot.forms ?? [];
		return found && (forms.length === 0 || forms.includes(form)) ? found : undefined;
	});
	let failed = $state(false);

	// The card's class may decline a device (`accepts`): that one keeps the
	// generic card. Known once its module is loaded — at once when it already is.
	let loaded = $state(0);
	const tag = $derived(custom?.slot.element);
	$effect(() => {
		if (!custom || !device.plugin_id || !tag || customElements.get(tag)) return;
		let gone = false;
		loadModule(device.plugin_id, custom.ui, tag)
			.then(() => !gone && loaded++)
			.catch(() => {});
		return () => (gone = true);
	});
	const declined = $derived.by(() => {
		void loaded;
		const cls = tag
			? (customElements.get(tag) as unknown as CardElementClass | undefined)
			: undefined;
		if (typeof cls?.accepts !== 'function') return false;
		try {
			return !cls.accepts(deviceView(device));
		} catch {
			return false;
		}
	});
</script>

{#if custom && !failed && !declined && device.plugin_id}
	<div class="plugin-card" class:large={form === 'large'}>
		<PluginSlot
			pluginId={device.plugin_id}
			ui={custom.ui}
			slot={custom.slot}
			deviceId={device.device_id}
			{form}
			onfail={() => (failed = true)}
		/>
	</div>
{:else}
	<GenericDeviceCard {device} {form} {page} {label} />
{/if}

<style>
	.plugin-card {
		min-width: 0;
	}
	/* Two columns, as a generic Large card takes. */
	.plugin-card.large {
		grid-column: span 2;
	}
</style>
