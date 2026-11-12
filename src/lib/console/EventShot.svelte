<!--
	An event's still (cameras.ts), 16:9: the app's own copy, kept a week
	(server/stills.js), else the picture the plugin took as it began, from
	its files. The plugin keeps only its newest few per camera, so with no
	copy an older event's may be gone: then it says so.
-->
<script lang="ts">
	import { stillsOf, type CamEvent } from './cameras.js';

	let { plugin, event }: { plugin: string | undefined; event: CamEvent } = $props();

	const all = $derived(stillsOf(event, plugin));
	/** Places that wouldn't load: the next is tried. */
	let gone = $state<Record<string, true>>({});
	const src = $derived(all.find((u) => !gone[u]));
</script>

<span class="shot">
	{#if src}
		<img {src} alt="" loading="lazy" onerror={() => (gone = { ...gone, [src]: true })} />
	{:else}
		<small>{all.length > 0 ? 'Still not kept' : 'No still'}</small>
	{/if}
</span>

<style>
	.shot {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #05060a;
		overflow: hidden;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	small {
		font-size: 10.5px;
		color: #7d8594;
	}
</style>
