<script lang="ts">
	import { goto } from '$app/navigation';
	import { dashboardsState } from '$lib/stores/dashboards.svelte';
	import type { DashboardDefinition } from '$lib/models/dashboard';

	$effect(() => {
		if (!dashboardsState.loaded && !dashboardsState.loading) {
			void dashboardsState.load();
		}
	});

	let busyAction = $state<string | null>(null);
	let pageError = $state<string | null>(null);
	let pageNotice = $state<string | null>(null);
	let importOpen = $state(false);
	let importValue = $state('');

	async function runAction(action: string, task: () => Promise<void>) {
		busyAction = action;
		pageError = null;
		pageNotice = null;
		try {
			await task();
		} catch (error) {
			pageError = error instanceof Error ? error.message : 'Dashboard action failed';
		} finally {
			busyAction = null;
		}
	}

	async function createFromTemplate(templateId: string) {
		await runAction(`template:${templateId}`, async () => {
			const created = await dashboardsState.createFromTemplate(templateId);
			pageNotice = `Created ${created.name}`;
			await goto(`/dashboards/${created.id}`);
		});
	}

	async function duplicateDashboard(id: string) {
		await runAction(`duplicate:${id}`, async () => {
			const created = await dashboardsState.duplicate(id);
			pageNotice = `Duplicated ${created.name}`;
			await goto(`/dashboards/${created.id}`);
		});
	}

	async function setDefault(id: string) {
		await runAction(`default:${id}`, async () => {
			const updated = await dashboardsState.setDefault(id);
			pageNotice = `${updated.name} is now your default dashboard`;
		});
	}

	async function deleteDashboard(id: string, name: string) {
		const confirmed = window.confirm(`Delete dashboard "${name}"?`);
		if (!confirmed) return;
		await runAction(`delete:${id}`, async () => {
			await dashboardsState.delete(id);
			pageNotice = `Deleted ${name}`;
		});
	}

	async function exportDashboard(dashboard: DashboardDefinition) {
		await runAction(`export:${dashboard.id}`, async () => {
			const exported = await dashboardsState.export(dashboard.id);
			const text = JSON.stringify(exported, null, 2);
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				pageNotice = `Copied ${dashboard.name} JSON to the clipboard`;
			} else {
				importValue = text;
				importOpen = true;
				pageNotice = `Exported ${dashboard.name} JSON into the import dialog`;
			}
		});
	}

	async function importDashboard() {
		await runAction('import', async () => {
			const parsed = JSON.parse(importValue) as DashboardDefinition;
			const created = await dashboardsState.import(parsed);
			importValue = '';
			importOpen = false;
			pageNotice = `Imported ${created.name}`;
			await goto(`/dashboards/${created.id}`);
		});
	}

	async function reloadDashboardStore() {
		await runAction('reload-store', async () => {
			const result = await dashboardsState.reloadStore();
			pageNotice = `Reloaded dashboard store with ${result.dashboards_total} dashboard${result.dashboards_total === 1 ? '' : 's'}`;
		});
	}
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Dashboards</h1>
			<p>Saved HomeCore dashboards plus available starter templates.</p>
		</div>
		<div class="actions">
			<button type="button" class="secondary" onclick={() => (importOpen = true)}>Import</button>
			<button
				type="button"
				class="secondary"
				onclick={reloadDashboardStore}
				disabled={dashboardsState.loading || !!busyAction}
			>
				{busyAction === 'reload-store' ? 'Reloading Store…' : 'Reload Store'}
			</button>
			<button
				type="button"
				onclick={() => dashboardsState.load()}
				disabled={dashboardsState.loading || !!busyAction}
			>
				{dashboardsState.loading ? 'Refreshing…' : 'Refresh'}
			</button>
		</div>
	</div>

	{#if pageError || dashboardsState.error}
		<p class="error">{pageError ?? dashboardsState.error}</p>
	{/if}
	{#if pageNotice}
		<p class="notice">{pageNotice}</p>
	{/if}

	{#if importOpen}
		<section class="panel import-panel">
			<div class="card-header">
				<h2>Import Dashboard</h2>
				<button type="button" class="secondary" onclick={() => (importOpen = false)}>Close</button>
			</div>
			<p>Paste exported dashboard JSON. The imported copy will be owned by the current user.</p>
			<textarea bind:value={importValue} rows="14" placeholder="Paste dashboard JSON here"></textarea>
			<div class="actions">
				<button
					type="button"
					onclick={importDashboard}
					disabled={!importValue.trim() || busyAction === 'import'}
				>
					{busyAction === 'import' ? 'Importing…' : 'Import Dashboard'}
				</button>
			</div>
		</section>
	{/if}

	{#if dashboardsState.error && !dashboardsState.items.length}
		<p class="error">{dashboardsState.error}</p>
	{:else if dashboardsState.loading && !dashboardsState.items.length}
		<p>Loading dashboards…</p>
	{:else}
		<div class="columns">
			<section class="panel">
				<h2>Saved</h2>
				{#if dashboardsState.items.length === 0}
					<div class="empty-state">
						<strong>Clean workspace</strong>
						<p>No saved dashboards yet. Start from a template on the right, or import a dashboard JSON backup.</p>
					</div>
				{:else}
					<div class="cards">
						{#each dashboardsState.items as dashboard}
							<article class="card">
								<div class="card-header">
									<strong>{dashboard.name}</strong>
									{#if dashboard.is_default}
										<span class="badge">Default</span>
									{/if}
								</div>
								<p>{dashboard.description ?? dashboard.id}</p>
								<div class="tags">
									{#each dashboard.tags as tag}
										<span class="tag">{tag}</span>
									{/each}
								</div>
								<div class="card-actions">
									<a class="link-button" href={`/dashboards/${dashboard.id}`}>Open</a>
									<button
										type="button"
										class="secondary"
										onclick={() => duplicateDashboard(dashboard.id)}
										disabled={busyAction === `duplicate:${dashboard.id}`}
									>
										{busyAction === `duplicate:${dashboard.id}` ? 'Duplicating…' : 'Duplicate'}
									</button>
									<button
										type="button"
										class="secondary"
										onclick={() => exportDashboard(dashboard)}
										disabled={busyAction === `export:${dashboard.id}`}
									>
										{busyAction === `export:${dashboard.id}` ? 'Exporting…' : 'Export'}
									</button>
									{#if !dashboard.is_default}
										<button
											type="button"
											class="secondary"
											onclick={() => setDefault(dashboard.id)}
											disabled={busyAction === `default:${dashboard.id}`}
										>
											{busyAction === `default:${dashboard.id}` ? 'Saving…' : 'Set Default'}
										</button>
									{/if}
									<button
										type="button"
										class="danger"
										onclick={() => deleteDashboard(dashboard.id, dashboard.name)}
										disabled={busyAction === `delete:${dashboard.id}`}
									>
										{busyAction === `delete:${dashboard.id}` ? 'Deleting…' : 'Delete'}
									</button>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>

			<section class="panel">
				<h2>Templates</h2>
				<div class="cards">
					{#each dashboardsState.templates as template}
						<div class="card muted-card">
							<strong>{template.name}</strong>
							<p>{template.description ?? template.id}</p>
							<div class="card-actions">
								<button
									type="button"
									onclick={() => createFromTemplate(template.id)}
									disabled={busyAction === `template:${template.id}`}
								>
									{busyAction === `template:${template.id}` ? 'Creating…' : 'Create From Template'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</section>

<style>
	.page {
		display: grid;
		gap: 1.25rem;
	}

	.heading,
	.actions,
	.card-actions,
	.tags {
		display: flex;
		gap: 0.75rem;
	}

	.heading {
		justify-content: space-between;
		align-items: start;
	}

	.heading h1,
	.panel h2 {
		margin: 0;
	}

	.heading p {
		margin: 0.4rem 0 0;
		color: var(--hc-text-muted);
	}

	.columns {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 1rem;
	}

	.panel {
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		border-radius: 0.7rem;
		padding: 1rem;
	}

	.cards {
		margin-top: 1rem;
		display: grid;
		gap: 0.85rem;
	}

	.card {
		display: grid;
		gap: 0.6rem;
		padding: 1rem;
		border-radius: 0.55rem;
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}

	p {
		margin: 0;
		color: var(--hc-text-muted);
	}

	.badge {
		padding: 0.2rem 0.55rem;
		border-radius: 0.4rem;
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
		font-size: 0.8rem;
	}

	.tag,
	.notice {
		padding: 0.22rem 0.55rem;
		border-radius: 0.4rem;
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
		font-size: 0.8rem;
	}

	.muted-card {
		background: var(--hc-surface-soft);
	}

	.empty-state {
		margin-top: 1rem;
		display: grid;
		gap: 0.45rem;
		padding: 1rem;
		border-radius: 0.55rem;
		background: var(--hc-surface-soft);
		border: 1px solid var(--hc-border);
	}

	.error { color: var(--hc-danger); }

	.notice {
		background: var(--hc-success-soft);
		color: var(--hc-success);
		width: fit-content;
	}

	button,
	.link-button {
		text-decoration: none;
	}

	.secondary {
		background: var(--hc-surface);
		color: var(--hc-text);
	}

	.danger {
		background: var(--hc-danger-soft);
		color: var(--hc-danger);
		border-color: color-mix(in srgb, var(--hc-danger) 20%, var(--hc-border));
	}

	textarea {
		width: 100%;
		border-radius: 0.45rem;
		font: 0.9rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
		resize: vertical;
	}

	.import-panel {
		gap: 0.9rem;
		display: grid;
	}

	@media (max-width: 960px) {
		.columns {
			grid-template-columns: 1fr;
		}

		.heading,
		.actions,
		.card-actions {
			flex-wrap: wrap;
		}
	}
</style>
