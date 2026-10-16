<!--
	Devices as cards on the grid (03 §6): two Standard cards across a phone,
	more as the screen widens; a Large card spans two. With a `page`, its
	layers apply (M2) — the household's, then this person's: order, what was
	hidden, forms and names — and while arranging, the tools to change them.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { displayName } from '#lib/devices.js';
	import { kindOf } from '#lib/card.js';
	import { apply, ref, type Form } from '#lib/layers.js';
	import { commands } from '#lib/commands.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { page as here } from '$app/state';
	import { openDevice } from '#lib/popup.js';
	import DeviceCard from './DeviceCard.svelte';
	import SceneCard from './SceneCard.svelte';
	import Arrange from './Arrange.svelte';

	let {
		devices,
		large = [],
		page,
		added = false
	}: {
		devices: CoreDevice[];
		large?: string[];
		page?: string;
		/** These cards were added to the page, not generated on it. */
		added?: boolean;
	} = $props();

	const layered = $derived(
		apply(devices, (d) => ref.device(d.device_id), page ? view.changes(page) : [])
	);
	const arranging = $derived(page !== undefined && view.mode(page) !== null);
	const nameOf = (d: CoreDevice) => layered.name(ref.device(d.device_id));
	const list = $derived(arranging ? [...layered.shown, ...layered.hidden] : layered.shown);
	const shownRefs = $derived(layered.shown.map((d) => ref.device(d.device_id)));
	const hiddenSet = $derived(new Set(layered.hidden));

	const isScene = (d: CoreDevice) =>
		kindOf(d) === 'scene' && (d.schema?.actions?.some((a) => a.id === 'activate') ?? false);
	const formOf = (d: CoreDevice): Form =>
		layered.form(ref.device(d.device_id)) ?? (large.includes(kindOf(d)) ? 'large' : 'standard');
</script>

<div class="grid">
	{#each list as d (d.device_id)}
		{@const form = formOf(d)}
		<Arrange
			page={page ?? ''}
			ref={ref.device(d.device_id)}
			name={nameOf(d) ?? displayName(d)}
			shown={shownRefs}
			hidden={hiddenSet.has(d)}
			form={isScene(d) ? undefined : form}
			wide={form === 'large'}
			{added}
			renamed={nameOf(d) !== undefined}
		>
			{#if isScene(d)}
				<SceneCard
					name={nameOf(d) ?? displayName(d)}
					run={() => commands.act(d.device_id, 'activate')}
					details={() => openDevice(d.device_id, here.url)}
				/>
			{:else}
				<DeviceCard device={d} {form} {page} label={nameOf(d)} />
			{/if}
		</Arrange>
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
