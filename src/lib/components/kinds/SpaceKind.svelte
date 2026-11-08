<!-- Empty room on a page (14 §6): nothing at all, but while it's being arranged. -->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import { view } from '#lib/view.svelte.js';

	let { page }: KindProps<'space'> = $props();
	const arranging = $derived(view.mode(page) !== null);
</script>

<div class="space" class:arranging aria-hidden={!arranging}>
	{#if arranging}Space{/if}
</div>

<style>
	.space {
		min-height: 40px;
	}
	.arranging {
		display: grid;
		place-items: center;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
		color: var(--ink-muted);
		font-size: 12px;
	}
</style>
