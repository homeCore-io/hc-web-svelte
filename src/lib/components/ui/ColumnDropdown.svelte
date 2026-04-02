<script lang="ts">
	type ColumnOption<T extends string> = {
		id: T;
		label: string;
	};

	let {
		title = 'Column selection',
		allColumns,
		visibleColumns = $bindable()
	}: {
		title?: string;
		allColumns: ColumnOption<string>[];
		visibleColumns: string[];
	} = $props();

	function toggleColumn(column: string) {
		if (visibleColumns.includes(column)) {
			if (visibleColumns.length === 1) return;
			visibleColumns = visibleColumns.filter((value) => value !== column);
			return;
		}
		visibleColumns = [...visibleColumns, column];
	}
</script>

<div class="column-editor">
	<div>
		<strong>Columns</strong>
		<p>Use the dropdown to show or hide columns. Drag table headers to reorder them.</p>
	</div>
	<details class="column-dropdown">
		<summary>{title}</summary>
		<div class="column-menu">
			{#each allColumns as column}
				<label class="column-option">
					<input
						type="checkbox"
						checked={visibleColumns.includes(column.id)}
						onchange={() => toggleColumn(column.id)}
						disabled={visibleColumns.length === 1 && visibleColumns.includes(column.id)}
					/>
					<span>{column.label}</span>
				</label>
			{/each}
		</div>
	</details>
</div>

<style>
	.column-editor { display: grid; gap: 0.75rem; }
	.column-editor p { margin: 0.2rem 0 0; color: var(--hc-text-muted); font-size: 0.84rem; }
	.column-dropdown summary {
		width: fit-content;
		list-style: none;
		cursor: pointer;
		padding: 0.48rem 0.72rem;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
	}
	.column-dropdown[open] summary { margin-bottom: 0.6rem; }
	.column-menu {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.25rem 0.75rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--hc-border);
		border-radius: 0.55rem;
		background: var(--hc-surface-soft);
		max-width: min(100%, 34rem);
	}
	.column-option {
		display: flex;
		gap: 0.45rem;
		align-items: center;
		font-size: 0.84rem;
		line-height: 1.2;
		color: var(--hc-text);
		padding: 0.15rem 0;
	}
	.column-option input { margin: 0; min-width: 0; flex: 0 0 auto; }
</style>
