<script lang="ts">
	import { dashboardsState } from '$lib/stores/dashboards.svelte';

	$effect(() => {
		if (!dashboardsState.items.length && !dashboardsState.loading) {
			void dashboardsState.load();
		}
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Dashboards</h1>
			<p>Saved HomeCore dashboards plus available starter templates.</p>
		</div>
	</div>

	{#if dashboardsState.error}
		<p class="error">{dashboardsState.error}</p>
	{:else if dashboardsState.loading && !dashboardsState.items.length}
		<p>Loading dashboards…</p>
	{:else}
		<div class="columns">
			<section class="panel">
				<h2>Saved</h2>
				{#if dashboardsState.items.length === 0}
					<p>No dashboards yet.</p>
				{:else}
					<div class="cards">
						{#each dashboardsState.items as dashboard}
							<a class="card" href={`/dashboards/${dashboard.id}`}>
								<div class="card-header">
									<strong>{dashboard.name}</strong>
									{#if dashboard.is_default}
										<span class="badge">Default</span>
									{/if}
								</div>
								<p>{dashboard.description ?? dashboard.id}</p>
							</a>
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

	.heading h1,
	.panel h2 {
		margin: 0;
	}

	.heading p {
		margin: 0.4rem 0 0;
		color: #607287;
	}

	.columns {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 1rem;
	}

	.panel {
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}

	.cards {
		margin-top: 1rem;
		display: grid;
		gap: 0.85rem;
	}

	.card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem;
		border-radius: 0.95rem;
		background: white;
		border: 1px solid #dbe5ef;
		color: inherit;
		text-decoration: none;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}

	p {
		margin: 0;
		color: #627488;
	}

	.badge {
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: #dceaf7;
		color: #16456d;
		font-size: 0.8rem;
	}

	.muted-card {
		background: #f6f8fb;
	}

	.error {
		color: #b53622;
	}

	@media (max-width: 960px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
</style>
