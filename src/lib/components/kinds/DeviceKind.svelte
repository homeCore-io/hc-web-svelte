<!--
	A device on a page: its card in the form it was given, with the settings
	that apply on this screen (G23) — or, for a plugin's scene, a button that
	runs it (C2). On a room's page the card carries its own Hide (`cardTools`).
	In the Lit look (12) a light, a switch or a scene is drawn by LitDevice,
	loaded only then.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import { displayName } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import type { KindProps } from '#lib/kinds.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { DEVICE_BUILT_IN, deviceKind } from '#lib/options.js';
	import DeviceCard from '../DeviceCard.svelte';
	import SceneCard from '../SceneCard.svelte';
	import { look } from '#lib/look.svelte.js';
	import { kindOf } from '#lib/card.js';

	// What Lit draws itself (lit/room.ts LAMPS), without loading Lit to ask.
	const LIT = new Set(['light', 'dimmer', 'group', 'switch', 'outlet']);

	let { card, form, label, page, cardTools, options }: KindProps<'device'> = $props();
	const d = $derived(card.device);
	const o = $derived(options ?? kindOptions.of(page, deviceKind(d), card.ref, DEVICE_BUILT_IN));
</script>

{#snippet today()}
	{#if card.scene}
		<SceneCard
			name={label ?? displayName(d)}
			run={() => commands.act(d.device_id, 'activate')}
			details={() => openDevice(d.device_id, here.url)}
		/>
	{:else}
		<DeviceCard
			device={d}
			{form}
			page={cardTools ? page : undefined}
			{label}
			options={o}
			layer={page ? { page, ref: card.ref } : undefined}
		/>
	{/if}
{/snippet}

{#if look.lit && (card.scene || LIT.has(kindOf(d)))}
	{#await import('#lib/lit/LitDevice.svelte') then { default: LitDevice }}
		<LitDevice {card} {label} options={o}>{@render today()}</LitDevice>
	{/await}
{:else}
	{@render today()}
{/if}
