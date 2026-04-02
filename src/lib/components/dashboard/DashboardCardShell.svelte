<script lang="ts">
	import type { DashboardCardTone } from '$lib/models/dashboard';
	import type { DashboardCardSize } from '$lib/models/dashboardCards';
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import type { MaterialIconName } from '$lib/components/ui/MaterialIcon.svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle = null,
		eyebrow = null,
		icon = 'dashboard',
		tone = 'neutral',
		size = 'md',
		compact = false,
		contentClass = '',
		children,
		meta,
		footer
	}: {
		title: string;
		subtitle?: string | null;
		eyebrow?: string | null;
		icon?: MaterialIconName;
		tone?: DashboardCardTone;
		size?: DashboardCardSize;
		compact?: boolean;
		contentClass?: string;
		children: Snippet;
		meta?: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<article class={`card tone-${tone} size-${size} ${compact ? 'compact' : ''}`}>
	<header class="card-header">
		<div class="heading">
			<div class="icon-wrap" aria-hidden="true">
				<MaterialIcon name={icon} size={20} class="icon" />
			</div>
			<div class="copy">
				{#if eyebrow}
					<p class="eyebrow">{eyebrow}</p>
				{/if}
				<h2>{title}</h2>
				{#if subtitle}
					<p class="subtitle">{subtitle}</p>
				{/if}
			</div>
		</div>
		<div class="header-meta">
			{@render meta?.()}
		</div>
	</header>

	<div class={`card-content ${contentClass}`.trim()}>
		{@render children()}
	</div>

	{#if !compact}
		<footer class="card-footer">
			{@render footer?.()}
		</footer>
	{/if}
</article>

<style>
	.card {
		--card-border: var(--hc-border, #dbe3ea);
		--card-shadow: none;
		--card-surface: var(--hc-surface, #ffffff);
		--card-muted: var(--hc-text-muted, #627487);
		--tone-surface: rgba(75, 110, 145, 0.08);
		--tone-ink: #2b5278;
		height: 100%;
		padding: 0.9rem;
		border-radius: 0.6rem;
		background: var(--card-surface);
		border: 1px solid var(--card-border);
		box-shadow: var(--card-shadow);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 0.9rem;
		overflow: hidden;
	}

	.compact {
		gap: 0.75rem;
	}

	.card-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.heading {
		display: flex;
		align-items: start;
		gap: 0.8rem;
		min-width: 0;
	}

	.icon-wrap {
		flex: none;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 0.45rem;
		display: grid;
		place-items: center;
		background: var(--tone-surface);
		color: var(--tone-ink);
	}

	.copy {
		min-width: 0;
	}

	.eyebrow,
	.subtitle {
		margin: 0;
		color: var(--card-muted);
	}

	.eyebrow {
		font-size: 0.74rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	h2 {
		margin: 0.12rem 0 0;
		font-size: 1rem;
		line-height: 1.2;
	}

	.subtitle {
		margin-top: 0.22rem;
		font-size: 0.84rem;
	}

	.header-meta,
	.card-footer:empty {
		display: none;
	}

	.header-meta:not(:empty),
	.card-footer:not(:empty) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		justify-content: end;
	}

	.card-content {
		min-height: 0;
	}

	.card-footer {
		padding-top: 0.15rem;
		border-top: 1px solid rgba(220, 228, 236, 0.8);
	}

	.tone-neutral {
		--tone-surface: rgba(79, 113, 145, 0.12);
		--tone-ink: #2f5577;
	}

	.tone-good {
		--tone-surface: rgba(60, 143, 89, 0.14);
		--tone-ink: #2e7d52;
	}

	.tone-warn {
		--tone-surface: rgba(189, 131, 48, 0.16);
		--tone-ink: #916119;
	}

	.tone-media {
		--tone-surface: rgba(54, 126, 171, 0.16);
		--tone-ink: #22618b;
	}

	.tone-danger {
		--tone-surface: rgba(180, 83, 67, 0.16);
		--tone-ink: #9a3527;
	}

	.size-xs {
		padding: 0.72rem;
	}

	.size-lg,
	.size-xl {
		padding: 0.96rem;
	}
</style>
