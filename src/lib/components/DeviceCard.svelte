<!--
	A device's card: the plugin's own (`device.card`), when it carries one for
	this kind of device and this size — else, or if it won't load, the
	generic one (GenericDeviceCard).
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import type { Form } from '#lib/layers.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
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
</script>

{#if custom && !failed && device.plugin_id}
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
