<!--
	Devices as cards on the grid (03 §6): two Standard cards across a phone,
	more as the screen widens; a Large card spans two.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { displayName } from '#lib/devices.js';
	import { kindOf } from '#lib/card.js';
	import { commands } from '#lib/commands.svelte.js';
	import DeviceCard from './DeviceCard.svelte';
	import SceneCard from './SceneCard.svelte';

	let { devices, large = [] }: { devices: CoreDevice[]; large?: string[] } = $props();

	const sceneAction = (d: CoreDevice) =>
		d.schema?.actions?.some((a) => a.id === 'activate') ? 'activate' : undefined;
</script>

<div class="grid">
	{#each devices as d (d.device_id)}
		{#if kindOf(d) === 'scene' && sceneAction(d)}
			<SceneCard name={displayName(d)} run={() => commands.act(d.device_id, 'activate')} />
		{:else}
			<DeviceCard device={d} form={large.includes(kindOf(d)) ? 'large' : 'standard'} />
		{/if}
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		align-items: start;
	}
	@media (min-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
	}
</style>
