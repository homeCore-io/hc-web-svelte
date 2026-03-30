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
	:global(body) {
		margin: 0;
		font-family:
			"Segoe UI", "SF Pro Display", "Helvetica Neue", sans-serif;
		background: #eef2f7;
		color: #16202b;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.center {
		min-height: 100vh;
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at top left, rgba(13, 82, 147, 0.18), transparent 32%),
			linear-gradient(180deg, #eff4f8, #e7edf4);
		font-size: 1.1rem;
	}
</style>
