<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import NavShell from '$lib/components/app/NavShell.svelte';
	import { authState } from '$lib/stores/auth.svelte';

	let { children } = $props();
	const isLoginRoute = $derived(page.url.pathname === '/login');

	$effect(() => {
		if (browser) {
			void authState.init();
		}
	});

	$effect(() => {
		if (!browser || !authState.ready) return;
		if (!authState.isAuthenticated && !isLoginRoute) {
			void goto('/login');
		}
		if (authState.isAuthenticated && isLoginRoute) {
			void goto('/dashboard');
		}
	});
</script>

{#if !authState.ready}
	<div class="center">Loading HomeCore…</div>
{:else if isLoginRoute}
	{@render children?.()}
{:else if authState.isAuthenticated}
	<NavShell>
		{@render children?.()}
	</NavShell>
{:else}
	<div class="center">Redirecting to login…</div>
{/if}

<style>
	:global(:root) {
		--hc-bg: #f4f6f8;
		--hc-surface: #ffffff;
		--hc-surface-muted: #f8fafb;
		--hc-surface-soft: #f1f4f7;
		--hc-border: #d9e1e7;
		--hc-border-strong: #c4d0da;
		--hc-text: #14202b;
		--hc-text-muted: #617487;
		--hc-accent: #1565c0;
		--hc-accent-soft: #e8f1fb;
		--hc-success: #2e7d32;
		--hc-success-soft: #e8f5e9;
		--hc-warn: #b26a00;
		--hc-warn-soft: #fff3e0;
		--hc-danger: #c62828;
		--hc-danger-soft: #ffebee;
		--hc-shadow: none;
	}

	:global(body) {
		margin: 0;
		font-family:
			"Segoe UI", "Inter", "Helvetica Neue", sans-serif;
		background: var(--hc-bg);
		color: var(--hc-text);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(button),
	:global(.link-button),
	:global(.secondary-link) {
		font: inherit;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		box-shadow: none;
		padding: 0.55rem 0.8rem;
	}

	:global(button:hover),
	:global(.link-button:hover),
	:global(.secondary-link:hover) {
		border-color: var(--hc-border-strong);
		background: var(--hc-surface-muted);
	}

	:global(button:focus-visible),
	:global(a:focus-visible),
	:global(input:focus-visible),
	:global(select:focus-visible),
	:global(textarea:focus-visible) {
		outline: 2px solid color-mix(in srgb, var(--hc-accent) 40%, transparent);
		outline-offset: 2px;
	}

	:global(input),
	:global(select),
	:global(textarea) {
		font: inherit;
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface);
		color: var(--hc-text);
		box-shadow: none;
		padding: 0.6rem 0.72rem;
	}

	:global(.badge),
	:global(.tag),
	:global(.pill),
	:global(.live),
	:global(.meta-chip),
	:global(.footer-chip),
	:global(.inline-pill) {
		border-radius: 0.45rem;
		border: 1px solid var(--hc-border);
		background: var(--hc-surface-soft);
		color: var(--hc-text-muted);
		box-shadow: none;
	}

	:global(.panel) {
		background: var(--hc-surface);
		border: 1px solid var(--hc-border);
		box-shadow: none;
	}

	.center {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background: var(--hc-bg);
		font-size: 1.1rem;
	}
</style>
