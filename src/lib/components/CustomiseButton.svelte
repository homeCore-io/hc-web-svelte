<!--
	The way into Customise mode for a page (N6).
-->
<script lang="ts">
	import Sliders from '@lucide/svelte/icons/sliders-horizontal';
	import { customise } from '#lib/customise.svelte.js';

	let { page }: { page: string } = $props();
</script>

{#if !customise.on(page)}
	<button class="customise" onclick={() => (customise.page = page)}>
		<Sliders size={16} aria-hidden="true" />
		Customise
	</button>
{/if}

<style>
	.customise {
		align-self: flex-end;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 600;
	}
</style>
