<script lang="ts">
	import { authState } from '$lib/stores/auth.svelte';

	type NavItem = {
		href: string;
		label: string;
	};

	const items: NavItem[] = [
		{ href: '/dashboard', label: 'Dashboard' },
		{ href: '/dashboards', label: 'Dashboards' },
		{ href: '/devices', label: 'Devices' },
		{ href: '/scenes', label: 'Scenes' },
		{ href: '/modes', label: 'Modes' },
		{ href: '/automations', label: 'Automations' }
	];

	let { children } = $props();
</script>

<div class="shell">
	<aside class="sidebar">
		<div>
			<h1>HomeCore</h1>
			<p>Svelte web client</p>
		</div>

		<nav>
			{#each items as item}
				<a href={item.href}>{item.label}</a>
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
		background: #eef2f7;
		color: #16202b;
	}

	.sidebar {
		padding: 1.5rem;
		background: linear-gradient(180deg, #102132, #1a3551);
		color: white;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.sidebar h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.sidebar p {
		margin: 0.25rem 0 0;
		color: #b8cbe0;
	}

	.sidebar nav {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sidebar a {
		color: inherit;
		text-decoration: none;
		padding: 0.7rem 0.85rem;
		border-radius: 0.8rem;
		background: rgba(255, 255, 255, 0.06);
	}

	.sidebar a:hover {
		background: rgba(255, 255, 255, 0.14);
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
		padding: 1rem 1.5rem;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid #d8e0ea;
	}

	.content {
		padding: 1.5rem;
	}

	.muted {
		margin-left: 0.5rem;
		color: #5f6f82;
		font-size: 0.9rem;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.6rem 1rem;
		background: #d54b32;
		color: white;
		cursor: pointer;
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
