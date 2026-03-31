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
		background: rgba(255,255,255,0.8);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}
	.toolbar { display: grid; gap: 1rem; }
	.toolbar-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
	.toolbar-top { justify-content: space-between; align-items: stretch; }
	.toolbar-body { display: grid; gap: 1rem; }
	input {
		padding: 0.72rem 0.85rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
		min-width: min(360px, 100%);
		flex: 1;
	}
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
		font: inherit;
	}
	.secondary { background: #e6eef7; color: #173b61; }
	@media (max-width: 900px) {
		input { min-width: 100%; }
		.toolbar-top { justify-content: start; }
	}
</style>
