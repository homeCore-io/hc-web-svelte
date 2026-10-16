<!--
	The app's frame (02 — N2, N3): one set of destinations, three ways to reach
	them. A bottom bar on phones and on tablets held upright; a rail on tablets
	held sideways; a sidebar with the rooms in it on laptops and desktops.
	Chosen by CSS alone, so turning a tablet changes the frame without a reload.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import Bell from '@lucide/svelte/icons/bell';
	import Settings from '@lucide/svelte/icons/settings';
	import House from '@lucide/svelte/icons/house';
	import { PHONE_BAR, SIDEBAR, isAt, titleFor } from '#lib/nav.js';
	import { session } from '#lib/me.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import DetailsHost from './DetailsHost.svelte';
	import SearchBox from './SearchBox.svelte';
	import { finder } from '#lib/finder.svelte.js';

	let { children }: { children: Snippet } = $props();

	const pathname = $derived(page.url.pathname);
	const title = $derived(heading.text ?? titleFor(pathname));
	const initial = $derived((session.me?.username ?? '?').slice(0, 1).toUpperCase());
	const liveLabel = $derived(
		live.state === 'live'
			? 'Connected to homeCore'
			: live.state === 'connecting'
				? 'Connecting to homeCore'
				: 'homeCore is not answering'
	);
</script>

<div class="app">
	<nav class="side" aria-label="Main">
		<a class="brand" href="/">
			<span class="mark"><House size={18} strokeWidth={2} aria-hidden="true" /></span>
			<span class="label">homeCore</span>
		</a>

		{#each SIDEBAR as d (d.id)}
			<a
				class="dest"
				href={d.href}
				aria-current={isAt(pathname, d.href) ? 'page' : undefined}
				title={d.label}
			>
				<d.icon size={20} strokeWidth={1.8} aria-hidden="true" />
				<span class="label">{d.label}</span>
			</a>
		{/each}

		{#if rooms.list.length > 0}
			<div class="rooms">
				<p class="section-label">Rooms</p>
				{#each rooms.list as r (r.id)}
					<a
						class="room"
						href={`/rooms/${r.id}`}
						aria-current={pathname === `/rooms/${r.id}` ? 'page' : undefined}>{r.name}</a
					>
				{/each}
			</div>
		{/if}

		<div class="spacer"></div>

		{#if session.isAdmin}
			<a
				class="dest"
				href="/settings"
				aria-current={isAt(pathname, '/settings') ? 'page' : undefined}
				title="Settings"
			>
				<Settings size={20} strokeWidth={1.8} aria-hidden="true" />
				<span class="label">Settings</span>
			</a>
		{/if}
		<a class="dest" href="/me" aria-current={isAt(pathname, '/me') ? 'page' : undefined} title="Me">
			<span class="avatar" aria-hidden="true">{initial}</span>
			<span class="label">Me</span>
		</a>
	</nav>

	<div class="body">
		<header>
			<h1>{title}</h1>
			<span
				class="live"
				data-state={live.state}
				role="status"
				aria-label={liveLabel}
				title={liveLabel}
			></span>
			<button
				class="icon"
				aria-label="Search"
				title="Search (⌘K)"
				onclick={() => (finder.open = true)}
			>
				<Search size={22} strokeWidth={1.8} aria-hidden="true" />
			</button>
			<a class="icon" href="/alerts" aria-label="Alerts">
				<Bell size={22} strokeWidth={1.8} aria-hidden="true" />
			</a>
		</header>
		<main>
			{@render children()}
		</main>
		<DetailsHost />
		<SearchBox />
	</div>

	<nav class="bar" aria-label="Main">
		{#each PHONE_BAR as d (d.id)}
			<a href={d.href} aria-current={isAt(pathname, d.href) ? 'page' : undefined}>
				<d.icon size={22} strokeWidth={1.8} aria-hidden="true" />
				<span>{d.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.app {
		display: flex;
		min-height: 100dvh;
	}

	/* ---- Phone, and tablets held upright: the bottom bar ---- */
	.side {
		display: none;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding-bottom: calc(64px + env(safe-area-inset-bottom));
	}
	header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: calc(env(safe-area-inset-top) + 14px) var(--space-3) var(--space-2) var(--space-5);
		background: var(--bg);
	}
	h1 {
		margin: 0;
		flex: 1;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.icon {
		width: var(--target);
		height: var(--target);
		border: none;
		background: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink);
	}
	.live {
		width: 8px;
		height: 8px;
		margin-right: var(--space-2);
		border-radius: 50%;
		background: var(--track-off);
		transition: background var(--quick);
	}
	.live[data-state='live'] {
		background: var(--track-on);
	}
	.live[data-state='offline'] {
		background: var(--alert);
	}
	main {
		flex: 1;
		padding: var(--space-1) var(--space-4) var(--space-6);
	}

	.bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding: 6px var(--space-2) calc(6px + env(safe-area-inset-bottom));
		background: var(--sheet);
		border-top: 1px solid var(--line);
	}
	.bar a {
		height: 52px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		text-decoration: none;
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 600;
	}
	.bar a[aria-current='page'] {
		color: var(--accent);
	}

	/* ---- Tablets held sideways (and phones turned): the rail ---- */
	@media (min-width: 700px) and (orientation: landscape) {
		.bar {
			display: none;
		}
		.body {
			padding-bottom: 0;
		}
		.side {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;
			position: sticky;
			top: 0;
			height: 100dvh;
			width: 76px;
			flex: none;
			padding: 14px 10px;
			background: var(--side);
			border-right: 1px solid var(--line);
		}
		.label,
		.rooms {
			display: none;
		}
		.brand,
		.dest {
			width: var(--target);
			justify-content: center;
		}
	}

	/* ---- Laptops and desktops: the sidebar, with rooms ---- */
	@media (min-width: 1100px) {
		.bar {
			display: none;
		}
		.body {
			padding-bottom: 0;
		}
		.side {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 2px;
			position: sticky;
			top: 0;
			height: 100dvh;
			overflow-y: auto;
			width: 232px;
			flex: none;
			padding: 18px var(--space-3);
			background: var(--side);
			border-right: 1px solid var(--line);
		}
		.label {
			display: inline;
		}
		.rooms {
			display: flex;
			flex-direction: column;
		}
		.brand,
		.dest {
			width: auto;
			justify-content: flex-start;
		}
		header {
			padding: 18px var(--space-6) 10px 28px;
		}
		h1 {
			font-size: 26px;
		}
		main {
			padding: var(--space-2) 28px 28px;
		}
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		height: var(--target);
		padding: 0 7px;
		margin-bottom: var(--space-3);
		text-decoration: none;
		font-size: 17px;
		font-weight: 700;
	}
	.mark {
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.dest {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: 40px;
		padding: 0 10px;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.dest[aria-current='page'] {
		background: var(--nav-on);
		color: var(--ink);
	}
	.avatar {
		width: 22px;
		height: 22px;
		flex: none;
		border-radius: 50%;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--ink);
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.rooms {
		margin-top: var(--space-4);
		gap: 1px;
	}
	.rooms .section-label {
		margin: 0 10px 6px;
		font-size: 11px;
	}
	.room {
		display: flex;
		align-items: center;
		height: 34px;
		padding: 0 10px;
		border-radius: 8px;
		text-decoration: none;
	}
	.room[aria-current='page'] {
		background: var(--nav-on);
		font-weight: 600;
	}
	.room:hover,
	.dest:hover {
		background: var(--nav-on);
	}
	.spacer {
		flex: 1;
	}
</style>
