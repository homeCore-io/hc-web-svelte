<!--
	List and detail (08 §3): side by side where there's room; on a phone the
	list is the page until something is chosen, then the detail is.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { wide } from '#lib/wide.svelte.js';

	let {
		chosen,
		label,
		list,
		detail
	}: { chosen: boolean; label: string; list: Snippet; detail: Snippet } = $props();
</script>

<div class="ld" class:chosen>
	{#if wide.current || !chosen}
		<nav class="list" aria-label={label}>{@render list()}</nav>
	{/if}
	{#if wide.current || chosen}
		<div class="detail">{@render detail()}</div>
	{/if}
</div>

<style>
	.ld {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.list,
	.detail {
		min-width: 0;
	}
	@media (min-width: 900px) {
		.ld {
			display: grid;
			grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
			align-items: start;
			gap: var(--space-5);
		}
		.list {
			position: sticky;
			top: 84px;
			max-height: calc(100dvh - 120px);
			overflow: auto;
		}
	}
</style>
