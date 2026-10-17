<!--
	A player's artwork in place of its icon (coverage pass): homeCore serves
	it same-origin. When there's none, or it won't load, the icon stays.
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from '#lib/card.js';

	let {
		src,
		icon,
		size,
		logo = false
	}: { src?: string; icon: IconName; size: number; logo?: boolean } = $props();
	let failed = $state<string | null>(null);
</script>

{#if src && failed !== src}
	<img {src} alt="" loading="lazy" class:logo onerror={() => (failed = src ?? null)} />
{:else}
	<Icon name={icon} {size} />
{/if}

<style>
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
		display: block;
	}
	/* A station's logo, whole, on a plain ground. */
	img.logo {
		object-fit: contain;
		padding: 3px;
		box-sizing: border-box;
		background: var(--surface);
	}
</style>
