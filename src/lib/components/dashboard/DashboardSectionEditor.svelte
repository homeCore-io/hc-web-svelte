<script lang="ts">
	import type { DashboardEditorState } from '$lib/stores/dashboardEditor.svelte';
	import { titleCase } from '$lib/utils/formatting';

	let {
		editor,
		sectionId,
		onClose,
		onInspectWidget,
		onAddToSection
	}: {
		editor: DashboardEditorState;
		sectionId: string;
		onClose: () => void;
		onInspectWidget: (widgetId: string) => void;
		onAddToSection: (sectionId: string) => void;
	} = $props();

	const section = $derived(editor.dashboard.sections.find((entry) => entry.id === sectionId) ?? null);
	const sectionLayout = $derived(
		section ? editor.dashboard.layouts.find((layout) => layout.breakpoint === section.breakpoint) ?? null : null
	);
	const sectionCards = $derived.by(() => {
		if (!section || !sectionLayout) return [];
		return sectionLayout.placements
			.filter((placement) => placement.section_id === section.id)
			.sort((left, right) => {
				if (left.y !== right.y) return left.y - right.y;
				if (left.x !== right.x) return left.x - right.x;
				return left.widget_id.localeCompare(right.widget_id);
			})
			.map((placement) => {
				const widget = editor.dashboard.widgets.find((entry) => entry.id === placement.widget_id);
				return widget ? { widget, placement } : null;
			})
			.filter((value) => value !== null);
	});
	const sectionIndex = $derived(
		section ? editor.activeSections.findIndex((entry) => entry.id === section.id) : -1
	);

	function updateSectionNumber(
		sectionId: string,
		value: string,
		fallback: number,
		update: (sectionId: string, value: number) => void
	) {
		update(sectionId, Number(value || fallback));
	}
</script>

<section class="panel">
	<div class="panel-header">
		<div>
			<p class="eyebrow">Section Editor</p>
			<h2>{section ? titleCase(section.title) : 'Section'}</h2>
		</div>
		<button type="button" class="toggle" onclick={onClose}>
			Close
		</button>
	</div>

	{#if section}
		<div class="panel-body">
			<div class="hero">
				<div>
					<strong>{titleCase(section.title)}</strong>
					<p>
						{titleCase(section.breakpoint)} layout · {titleCase(section.layout_policy)} mode · {sectionCards.length}
						{sectionCards.length === 1 ? ' card' : ' cards'}
					</p>
				</div>
				<div class="hero-pills">
					<span>Order {sectionIndex + 1}</span>
					<span>Anchor row {section.y}</span>
				</div>
			</div>

			<section class="section">
				<div class="section-head">
					<strong>Section</strong>
					<span>This drawer owns section structure. Use the canvas to select regions and add cards.</span>
				</div>
				<div class="section-body">
					<label class="field">
						<span>Title</span>
						<input
							type="text"
							value={section.title}
							oninput={(event) =>
								editor.renameSection(section.id, (event.currentTarget as HTMLInputElement).value)}
						/>
					</label>
					<label class="field">
						<span>Anchor Row</span>
						<input
							type="number"
							min="0"
							value={String(section.y)}
							oninput={(event) =>
								updateSectionNumber(
									section.id,
									(event.currentTarget as HTMLInputElement).value,
									0,
									(id, next) => editor.updateSectionY(id, next)
								)}
						/>
					</label>
					<label class="field">
						<span>Layout Mode</span>
						<select
							value={section.layout_policy}
							onchange={(event) =>
								editor.updateSectionLayoutPolicy(
									section.id,
									(event.currentTarget as HTMLSelectElement).value as 'grid' | 'stack' | 'row'
								)}
						>
							<option value="grid">Grid</option>
							<option value="stack">Stack</option>
							<option value="row">Row</option>
						</select>
					</label>
					<label class="field">
						<span>Minimum Rows</span>
						<input
							type="number"
							min="1"
							value={String(section.min_h)}
							oninput={(event) =>
								updateSectionNumber(
									section.id,
									(event.currentTarget as HTMLInputElement).value,
									1,
									(id, next) => editor.updateSectionMinH(id, next)
								)}
						/>
					</label>
					<label class="field checkbox-field">
						<span>Visibility</span>
						<label class="checkline">
							<input
								type="checkbox"
								checked={!section.hidden}
								onchange={(event) =>
									editor.updateSectionHidden(
										section.id,
										!(event.currentTarget as HTMLInputElement).checked
									)}
							/>
							<span>Visible on dashboard</span>
						</label>
					</label>
					<div class="action-row">
						<button
							type="button"
							class="secondary-button"
							onclick={() => onAddToSection(section.id)}
						>
							Add Card
						</button>
						<button
							type="button"
							class="secondary-button"
							onclick={() => editor.toggleSectionCollapsed(section.id)}
						>
							{editor.isSectionCollapsed(section.id) ? 'Expand' : 'Collapse'}
						</button>
						<button
							type="button"
							class="danger-button"
							onclick={() => {
								editor.deleteSection(section.id);
								onClose();
							}}
						>
							Delete Section
						</button>
					</div>
					<div class="subsection">
						<div class="section-head compact-head">
							<strong>Structure</strong>
							<span>Adjust the section’s order and anchor without going back to the canvas.</span>
						</div>
						<div class="inline-actions">
							<button
								type="button"
								class="secondary-button"
								disabled={sectionIndex <= 0}
								onclick={() => editor.moveSection(section.id, -1)}
							>
								Move Earlier
							</button>
							<button
								type="button"
								class="secondary-button"
								disabled={sectionIndex >= editor.activeSections.length - 1}
								onclick={() => editor.moveSection(section.id, 1)}
							>
								Move Later
							</button>
							<button
								type="button"
								class="secondary-button"
								onclick={() => editor.nudgeSectionY(section.id, -1)}
							>
								Raise Row
							</button>
							<button
								type="button"
								class="secondary-button"
								onclick={() => editor.nudgeSectionY(section.id, 1)}
							>
								Lower Row
							</button>
						</div>
					</div>
				</div>
			</section>

			<section class="section">
				<div class="section-head">
					<strong>Cards</strong>
					<span>Open a card from here when you want detail editing.</span>
				</div>
				<div class="section-body">
					{#if sectionCards.length === 0}
						<p class="empty">This section is empty. Add a card into it from the composer.</p>
					{:else if editor.isSectionCollapsed(section.id)}
						<p class="empty">This section is collapsed in the composer canvas.</p>
					{:else}
						<div class="card-list">
							{#each sectionCards as card (card.widget.id)}
								<div class="card-row">
									<div class="card-copy">
										<strong>{card.widget.title}</strong>
										<p>{titleCase(card.widget.type)} · x {card.placement.x} · y {card.placement.y}</p>
									</div>
									<div class="card-actions">
										<button
											type="button"
											class="link-button"
											onclick={() => editor.select(card.widget.id)}
										>
											Select
										</button>
										<button
											type="button"
											class="link-button"
											onclick={() => onInspectWidget(card.widget.id)}
										>
											Inspect
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</section>

<style>
	.panel {
		border-radius: 0.7rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
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
	.secondary-button,
	.link-button,
	.danger-button {
		font: inherit;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
	}

	.toggle {
		padding: 0.32rem 0.62rem;
		font-size: 0.74rem;
	}

	.secondary-button,
	.link-button,
	.danger-button {
		padding: 0.38rem 0.68rem;
		font-size: 0.74rem;
	}

	.link-button {
		padding: 0.26rem 0.54rem;
		font-size: 0.7rem;
	}

	.danger-button {
		border-color: #e1b7b0;
		color: #9c3527;
		background: #fff8f7;
	}

	.panel-body {
		display: grid;
		gap: 0.65rem;
	}

	.hero {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		align-items: center;
		padding: 0.7rem;
		border-radius: 0.5rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.hero strong {
		display: block;
	}

	.hero p,
	.empty {
		margin: 0.08rem 0 0;
		color: #718396;
		font-size: 0.78rem;
	}

	.hero-pills,
	.action-row,
	.card-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.hero-pills span {
		padding: 0.22rem 0.46rem;
		border-radius: 0.4rem;
		background: var(--hc-surface);
		color: var(--hc-text-muted);
		font-size: 0.68rem;
	}

	.section {
		border-radius: 0.5rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		padding: 0.68rem;
	}

	.subsection {
		border-top: 1px solid #e7edf2;
		padding-top: 0.62rem;
		display: grid;
		gap: 0.5rem;
	}

	.section-head {
		display: grid;
		gap: 0.12rem;
		margin-bottom: 0.62rem;
	}

	.section-head strong {
		font-size: 0.82rem;
		color: #314d66;
	}

	.section-head span {
		font-size: 0.74rem;
		color: #75889a;
	}

	.section-body {
		display: grid;
		gap: 0.62rem;
	}

	.field {
		display: grid;
		gap: 0.28rem;
	}

	.checkbox-field {
		gap: 0.5rem;
	}

	.field span {
		font-size: 0.72rem;
		color: var(--hc-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	input,
	select {
		font: inherit;
		padding: 0.56rem 0.64rem;
		border-radius: 0.45rem;
	}

	.checkline {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.78rem;
		color: var(--hc-text-muted);
	}

	.card-list {
		display: grid;
		gap: 0.45rem;
	}

	.compact-head {
		margin-bottom: 0;
	}

	.inline-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.card-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem;
		border-radius: 0.45rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.card-copy strong {
		display: block;
		font-size: 0.8rem;
	}

	.card-copy p {
		margin: 0.14rem 0 0;
		color: #6f8194;
		font-size: 0.74rem;
	}

	@media (max-width: 720px) {
		.hero,
		.card-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
