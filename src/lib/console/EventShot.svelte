<!--
	An event's still (cameras.ts): the picture the plugin took as it began,
	from its files, 16:9. The plugin keeps only its newest few per camera, so
	an older event's may be gone: then it says so.
-->
<script lang="ts">
	import { fileUrl } from './cameras.js';

	let { plugin, path }: { plugin: string | undefined; path: string | undefined } = $props();

	const src = $derived(path ? fileUrl(plugin, path) : undefined);
	let gone = $state<string | undefined>(undefined);
</script>

<span class="shot">
	{#if src && gone !== src}
		<img {src} alt="" loading="lazy" onerror={() => (gone = src)} />
	{:else}
		<small>{src ? 'Still not kept' : 'No still'}</small>
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
