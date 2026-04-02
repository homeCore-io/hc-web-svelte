<script lang="ts">
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import { dashboardCardSpec } from '$lib/models/dashboardCards';
	import type { DashboardBreakpoint, DashboardWidgetType } from '$lib/models/dashboard';
	import type { DashboardEditorState } from '$lib/stores/dashboardEditor.svelte';

	let {
		editor,
		anchor = null,
		onClearAnchor
	}: {
		editor: DashboardEditorState;
		anchor?: {
			breakpoint: DashboardBreakpoint;
			x: number;
			y: number;
			label: string;
			section_id?: string | null;
		} | null;
		onClearAnchor?: (() => void) | undefined;
	} = $props();

	function beginCatalogDrag(event: DragEvent, type: DashboardWidgetType) {
		event.dataTransfer?.setData('application/x-homecore-dashboard-card', type);
		event.dataTransfer?.setData('text/plain', type);
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy';
		}
	}

	function addCard(type: DashboardWidgetType) {
		if (!anchor) {
			editor.addWidget(type);
			return;
		}

		const spec = dashboardCardSpec(type);
		editor.addWidgetAtBreakpoint(type, anchor.breakpoint, {
			x: anchor.x,
			y: anchor.y,
			w: spec.preferredWidth,
			h: spec.minHeight,
			section_id: anchor.section_id ?? null
		});
	}
</script>

<section class="panel">
	<div class="panel-header">
		<div>
			<p class="eyebrow">Composer</p>
			<h2>Add Card</h2>
		</div>
		<button type="button" class="toggle" onclick={() => editor.closeCatalog()}>
			Close
		</button>
	</div>

	<div class="panel-body">
		{#if anchor}
			<div class="anchor-banner">
				<div>
					<strong>{anchor.label}</strong>
					<span>Adding into the {anchor.breakpoint} layout at row {anchor.y + 1}.</span>
				</div>
				<button type="button" class="anchor-clear" onclick={() => onClearAnchor?.()}>
					Clear
				</button>
			</div>
		{:else}
			<p class="intro">
				Pick a card family, then place it on the canvas or add it directly into the active breakpoint.
			</p>
		{/if}
		<label class="search">
			<span>Search cards</span>
			<input
				type="search"
				placeholder="Entity, events, markdown…"
				value={editor.search}
				oninput={(event) => editor.setSearch((event.currentTarget as HTMLInputElement).value)}
			/>
		</label>

		<ul class="catalog-list">
			{#each editor.filteredCatalog as item (item.template.type)}
				<li>
					<div class="catalog-card">
						<div class={`icon tone-${item.spec.tone}`} aria-hidden="true">
							<MaterialIcon name={item.spec.icon} size={18} />
						</div>
						<div class="copy">
							<strong>{item.template.title}</strong>
							<span>{item.spec.family}</span>
							<small>{item.count} on dashboard</small>
						</div>
						<div class="card-actions">
							<button
								type="button"
								class="drag-button"
								draggable="true"
								aria-label={`Drag ${item.template.title} to canvas`}
								ondragstart={(event) => beginCatalogDrag(event, item.template.type)}
							>
								Drag
							</button>
							<button type="button" class="add-button" onclick={() => addCard(item.template.type)}>
								Add
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.panel {
		border-radius: 0.7rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		box-shadow: none;
		padding: 0.8rem;
		display: grid;
		gap: 0.7rem;
	}

	.panel-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.67rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: #8192a3;
	}

	h2 {
		margin: 0.08rem 0 0;
		font-size: 0.92rem;
	}

	.toggle,
	input {
		font: inherit;
	}

	.toggle {
		border: 1px solid var(--hc-border);
		border-radius: 0.45rem;
		background: var(--hc-surface);
		padding: 0.32rem 0.62rem;
		color: var(--hc-text-muted);
		font-size: 0.74rem;
	}

	.panel-body {
		display: grid;
		gap: 0.7rem;
	}

	.intro {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: #6b7e92;
	}

	.anchor-banner {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 0.65rem 0.72rem;
		border-radius: 0.5rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-success-soft);
	}

	.anchor-banner strong,
	.anchor-banner span {
		display: block;
	}

	.anchor-banner strong {
		font-size: 0.77rem;
		color: var(--hc-success);
	}

	.anchor-banner span {
		margin-top: 0.12rem;
		font-size: 0.74rem;
		color: var(--hc-text-muted);
	}

	.anchor-clear {
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		border-radius: 0.45rem;
		padding: 0.3rem 0.56rem;
		font: inherit;
		font-size: 0.72rem;
		flex: none;
	}

	.search {
		display: grid;
		gap: 0.28rem;
		font-size: 0.76rem;
		color: #728598;
	}

	input {
		padding: 0.58rem 0.68rem;
		border-radius: 0.45rem;
	}

	.catalog-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.45rem;
	}

	.catalog-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.6rem;
		align-items: start;
		padding: 0.58rem;
		border-radius: 0.5rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: inherit;
	}

	.card-actions {
		grid-column: 2;
		display: flex;
		gap: 0.35rem;
	}

	.add-button {
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		border-radius: 0.45rem;
		padding: 0.28rem 0.56rem;
		font: inherit;
		font-size: 0.72rem;
		flex: none;
	}

	.drag-button {
		border: 1px dashed var(--hc-border-strong);
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
		border-radius: 0.45rem;
		padding: 0.28rem 0.56rem;
		font: inherit;
		font-size: 0.72rem;
		flex: none;
	}

	.icon {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.45rem;
		display: grid;
		place-items: center;
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
		flex: none;
	}

	.copy {
		display: grid;
		gap: 0.08rem;
		min-width: 0;
		flex: 1;
	}

	.copy span,
	.copy small {
		color: #6a7d91;
	}

	.copy span {
		font-size: 0.78rem;
	}

	.copy small {
		font-size: 0.7rem;
	}

	.tone-good {
		background: rgba(223, 242, 231, 0.95);
		color: #1f6942;
	}

	.tone-warn {
		background: rgba(248, 238, 217, 0.98);
		color: #8b6217;
	}

	.tone-media {
		background: rgba(222, 237, 246, 0.98);
		color: #255f86;
	}
</style>
