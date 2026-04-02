<script lang="ts">
	import { authState } from '$lib/stores/auth.svelte';
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';

	type NavItem = {
		href: string;
		label: string;
		icon: 'dashboard' | 'devices' | 'scenes' | 'modes' | 'events' | 'automation';
	};

	const items: NavItem[] = [
		{ href: '/dashboards', label: 'Dashboards', icon: 'dashboard' },
		{ href: '/devices', label: 'Devices', icon: 'devices' },
		{ href: '/scenes', label: 'Scenes', icon: 'scenes' },
		{ href: '/modes', label: 'Modes', icon: 'modes' },
		{ href: '/events', label: 'Events', icon: 'events' },
		{ href: '/automations', label: 'Automations', icon: 'automation' }
	];

	let { children } = $props();
</script>

<div class="shell">
	<aside class="sidebar">
		<div>
			<h1><a class="home-link" href="/dashboard">HomeCore</a></h1>
			<p>Svelte web client</p>
		</div>

		<nav>
			{#each items as item}
				<a href={item.href}>
					<MaterialIcon name={item.icon} size={18} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>

	<div class="main">
		<header class="topbar">
			<div>
				<strong>{authState.user?.username ?? 'Anonymous'}</strong>
				{#if authState.user?.role}
					<span class="muted">{authState.user.role}</span>
				{/if}
			</div>

			<button type="button" onclick={() => authState.logout()}>Logout</button>
		</header>

		<main class="content">
			{@render children?.()}
		</main>
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		min-height: 100vh;
		background: var(--hc-bg);
		color: var(--hc-text);
	}

	.sidebar {
		padding: 1.2rem;
		background: #ffffff;
		color: var(--hc-text);
		border-right: 1px solid var(--hc-border);
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.sidebar h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.home-link {
		color: inherit;
		text-decoration: none;
	}

	.home-link:hover {
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}

	.sidebar p {
		margin: 0.25rem 0 0;
		color: var(--hc-text-muted);
	}

	.sidebar nav {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sidebar a {
		color: var(--hc-text-muted);
		text-decoration: none;
		padding: 0.58rem 0.68rem;
		border-radius: 0.65rem;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		border: 1px solid transparent;
	}

	.sidebar a:hover {
		background: var(--hc-surface-muted);
		border-color: var(--hc-border);
		color: var(--hc-text);
	}

	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1.2rem;
		background: var(--hc-surface);
		border-bottom: 1px solid var(--hc-border);
	}

	.content {
		padding: 1.2rem;
	}

	.muted {
		margin-left: 0.5rem;
		color: #5f6f82;
		font-size: 0.9rem;
	}

	button {
		padding: 0.5rem 0.75rem;
		background: var(--hc-danger-soft);
		color: var(--hc-danger);
		cursor: pointer;
		border: 1px solid color-mix(in srgb, var(--hc-danger) 18%, var(--hc-border));
	}

	@media (max-width: 900px) {
		.shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			padding-bottom: 1rem;
		}

		.sidebar nav {
			flex-direction: row;
			flex-wrap: wrap;
		}
	}
</style>
