<!--
	A device on a page: its card in the form it was given — or, for a plugin's
	scene, a button that runs it (C2). On a room's page the card carries its
	own Hide (`cardTools`).
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import { displayName } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import type { KindProps } from '#lib/kinds.js';
	import DeviceCard from '../DeviceCard.svelte';
	import SceneCard from '../SceneCard.svelte';

	let { card, form, label, page, cardTools }: KindProps<'device'> = $props();
	const d = $derived(card.device);
</script>

{#if card.scene}
	<SceneCard
		name={label ?? displayName(d)}
		run={() => commands.act(d.device_id, 'activate')}
		details={() => openDevice(d.device_id, here.url)}
	/>
{:else}
	<DeviceCard device={d} {form} page={cardTools ? page : undefined} {label} />
{/if}
