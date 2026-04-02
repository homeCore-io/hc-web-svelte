<script lang="ts">
	let {
		search = $bindable(''),
		searchPlaceholder = 'Search',
		expanded = $bindable(false),
		showSearch = true,
		panelClass = '',
		children
	}: {
		search?: string;
		searchPlaceholder?: string;
		expanded?: boolean;
		showSearch?: boolean;
		panelClass?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class={`toolbar panel ${panelClass}`.trim()}>
	<div class="toolbar-row toolbar-top">
		{#if showSearch}
			<input bind:value={search} placeholder={searchPlaceholder} />
		{/if}
		<button type="button" class="secondary" onclick={() => (expanded = !expanded)}>
			{expanded ? 'Hide options' : 'Show options'}
		</button>
	</div>

	{#if expanded}
		<div class="toolbar-body">
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.panel {
		border-radius: 0.7rem;
		padding: 0.85rem;
	}
	.toolbar { display: grid; gap: 1rem; }
	.toolbar-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
	.toolbar-top { justify-content: space-between; align-items: stretch; }
	.toolbar-body { display: grid; gap: 1rem; }
	input {
		min-width: min(360px, 100%);
		flex: 1;
	}
	@media (max-width: 900px) {
		input { min-width: 100%; }
		.toolbar-top { justify-content: start; }
	}
</style>
