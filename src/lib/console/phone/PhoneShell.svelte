<!--
	The console's frame on a phone (the PhonePlan board): the page, then four
	sections along the bottom, Home, Rooms, Everywhere and Cameras, on frosted
	glass clear of the phone's own bars. Home, the room list, a room, the
	Everywhere views and the cameras are drawn the phone's way (phone.ts),
	each loaded the first time it's shown; any other page the look reaches is
	drawn as it is, under its title. The person's picture, at the top of a
	page, opens their own settings in a sheet.

	Loaded only when the console's look is on a phone's screen; the desktop's
	frame (ConsoleShell) is never loaded with it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import House from '@lucide/svelte/icons/house';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Globe from '@lucide/svelte/icons/globe';
	import Cctv from '@lucide/svelte/icons/cctv';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Settings from '@lucide/svelte/icons/settings';
	import { backFor, titleFor } from '#lib/nav.js';
	import { heading } from '#lib/heading.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import DetailsHost from '#lib/components/DetailsHost.svelte';
	import UnlockedBar from '#lib/components/UnlockedBar.svelte';
	import YouMenu from '../YouMenu.svelte';
	import { houseItems } from '../HouseMenu.svelte';
	import { isCamera } from '../cameras.js';
	import Sheet from './Sheet.svelte';
	import { phonePageOf, sectionOf, type Section } from './phone.js';
	import { provideYou } from './phone.svelte.js';

	let { children }: { children: Snippet } = $props();

	const pathname = $derived(page.url.pathname);
	const here = $derived(phonePageOf(pathname));
	const section = $derived(sectionOf(pathname));
	const title = $derived(heading.text ?? titleFor(pathname));
	const back = $derived(heading.back ?? backFor(pathname));

	// ---- the four sections; each remembers where it was left ----
	const cameras = $derived(Object.values(devices.byId).some(isCamera));
	let left = $state<Partial<Record<Section, string>>>({});
	afterNavigate(() => {
		const s = sectionOf(page.url.pathname);
		if (s) left = { ...left, [s]: page.url.pathname + page.url.search };
	});
	const SECTIONS = [
		{ id: 'home', label: 'Home', href: '/', icon: House },
		{ id: 'rooms', label: 'Rooms', href: '/rooms', icon: LayoutGrid },
		{ id: 'everywhere', label: 'Everywhere', href: '/everywhere/lights', icon: Globe },
		{ id: 'cameras', label: 'Cameras', href: '/cameras', icon: Cctv }
	] as const;
	const shown = $derived(SECTIONS.filter((s) => s.id !== 'cameras' || cameras));
	/** A section's place: where it was left, or its start when it's the one shown now. */
	const hrefOf = (s: (typeof SECTIONS)[number]) =>
		section === s.id ? s.href : (left[s.id] ?? s.href);

	// ---- the person's own settings, from their picture ----
	let you = $state(false);
	provideYou(() => (you = true));
	afterNavigate(() => (you = false));
	const houseList = $derived(houseItems((s) => session.can(s), session.isAdmin));

	// The page's own loaders, so each is fetched only the first time it's shown.
	const pages = {
		home: () => import('./PhoneHome.svelte'),
		rooms: () => import('./PhoneRooms.svelte'),
		room: () => import('./PhoneRoom.svelte'),
		everywhere: () => import('./PhoneEverywhere.svelte'),
		cameras: () => import('./PhoneCameras.svelte')
	};
</script>

<!-- A page on its way: a quiet line, shown only if it takes a moment. -->
{#snippet opening()}
	<p class="opening" role="status">Opening…</p>
{/snippet}
<!-- A page that could not be fetched (offline, or the app was updated): say so, and offer to load it again. -->
{#snippet failed()}
	<div class="failed" role="alert">
		<p>This page didn’t load. The connection may have dropped, or homeCore was updated.</p>
		<button type="button" onclick={() => location.reload()}>Load it again</button>
	</div>
{/snippet}

<div class="phone">
	<UnlockedBar />
	<main class="scr">
		{#if here?.kind === 'home'}
			{#await pages.home()}{@render opening()}{:then m}<m.default
				/>{:catch}{@render failed()}{/await}
		{:else if here?.kind === 'rooms'}
			{#await pages.rooms()}{@render opening()}{:then m}<m.default
				/>{:catch}{@render failed()}{/await}
		{:else if here?.kind === 'room'}
			{#await pages.room()}{@render opening()}{:then m}<m.default
					id={here.id}
				/>{:catch}{@render failed()}{/await}
		{:else if here?.kind === 'everywhere'}
			{#await pages.everywhere()}{@render opening()}{:then m}<m.default
					view={here.view}
				/>{:catch}{@render failed()}{/await}
		{:else if here?.kind === 'cameras'}
			{#await pages.cameras()}{@render opening()}{:then m}<m.default
				/>{:catch}{@render failed()}{/await}
		{:else}
			<div class="plain">
				{#if back}<a class="back" href={back.href}
						><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />{back.label}</a
					>{/if}
				{#if !heading.owned}<h1>{title}</h1>{/if}
				{@render children()}
			</div>
		{/if}
	</main>

	<nav class="tabbar" aria-label="Sections">
		{#each shown as s (s.id)}
			<a
				href={hrefOf(s)}
				class:on={section === s.id}
				aria-current={section === s.id ? 'page' : undefined}
				><s.icon size={24} strokeWidth={1.9} aria-hidden="true" /><span>{s.label}</span></a
			>
		{/each}
	</nav>

	{#if you}
		<Sheet label="You" onclose={() => (you = false)}>
			<div class="you">
				<YouMenu phone close={() => (you = false)}>
					{#snippet more()}
						{#if houseList.length > 0}
							<a class="house" href="/settings" onclick={() => (you = false)}
								><span class="mic"><Settings size={15} strokeWidth={1.9} aria-hidden="true" /></span
								><span
									>Household settings<small>Rooms, devices, plugins, people, system</small></span
								></a
							>
						{/if}
					{/snippet}
				</YouMenu>
			</div>
		</Sheet>
	{/if}
	<DetailsHost />
</div>

<style>
	.phone {
		/* The console's surfaces, as its desktop frame has them. */
		--con-edge: color-mix(in srgb, var(--ink) 6%, transparent);
		--con-hover: color-mix(in srgb, var(--ink) 5%, transparent);
		--con-raise: color-mix(in srgb, var(--ink) 7%, transparent);
		--con-edge-strong: color-mix(in srgb, var(--ink) 9%, transparent);
		/* What the bar along the bottom takes, the phone's own bar under it included. */
		--tabbar-h: calc(64px + env(safe-area-inset-bottom));
		--header-h: env(safe-area-inset-top);
		min-height: 100dvh;
		background:
			radial-gradient(
				700px 400px at 20% -10%,
				color-mix(in srgb, var(--accent) 9%, transparent),
				transparent 60%
			),
			var(--bg);
		color: var(--ink);
		overflow-x: clip;
	}
	.scr {
		box-sizing: border-box;
		min-height: 100dvh;
		padding-top: env(safe-area-inset-top);
		padding-bottom: var(--tabbar-h);
		padding-left: env(safe-area-inset-left);
		padding-right: env(safe-area-inset-right);
	}

	/* ---- a page on its way, or one that didn't come ---- */
	.opening {
		margin: 0;
		padding: 24px 16px;
		color: var(--ink-muted);
		font-size: 14px;
		opacity: 0;
		animation: show-late 0.2s 0.4s forwards;
	}
	@keyframes show-late {
		to {
			opacity: 1;
		}
	}
	.failed {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 24px 16px;
	}
	.failed p {
		margin: 0;
		color: var(--ink-muted);
		font-size: 15px;
	}
	.failed button {
		min-height: 44px;
		padding: 0 18px;
		border: none;
		border-radius: 12px;
		background: var(--accent);
		color: var(--accent-ink);
		font: 600 15px var(--font);
		cursor: pointer;
	}

	/* ---- a page drawn as it is ---- */
	.plain {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 16px 24px;
		min-width: 0;
	}
	.back {
		align-self: flex-start;
		display: flex;
		align-items: center;
		min-height: 44px;
		margin: -8px 0 -8px -6px;
		color: var(--ink-muted);
		font-size: 15px;
		font-weight: 600;
		text-decoration: none;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	/* ---- the four sections, along the bottom ---- */
	.tabbar {
		position: fixed;
		z-index: 20;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: space-around;
		align-items: flex-start;
		height: var(--tabbar-h);
		box-sizing: border-box;
		padding: 6px max(8px, env(safe-area-inset-right)) env(safe-area-inset-bottom)
			max(8px, env(safe-area-inset-left));
		background: color-mix(in srgb, var(--surface) 82%, transparent);
		backdrop-filter: blur(24px);
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ink) 7%, transparent);
	}
	@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		.tabbar {
			background: color-mix(in srgb, var(--surface) 96%, transparent);
		}
	}
	.tabbar a {
		flex: 1;
		max-width: 96px;
		min-height: 52px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		border-radius: 12px;
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 600;
		text-decoration: none;
	}
	.tabbar a.on {
		color: #ffc46b;
	}
	:global(:root[data-theme='light']) .tabbar a.on {
		color: var(--accent);
	}

	/* ---- the person's own settings ---- */
	.you {
		margin: 0 -10px;
	}
	.you :global(.row) {
		min-height: 48px;
	}
	.you :global(select),
	.you :global(.seg button) {
		min-height: 44px;
	}
	.house {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 48px;
		padding: 4px 10px;
		border-radius: 10px;
		color: var(--ink);
		font: 600 13px var(--font);
		text-decoration: none;
	}
	.house small {
		display: block;
		color: var(--ink-muted);
		font-weight: 500;
		font-size: 11px;
	}
	.mic {
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: 8px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink-muted);
	}
</style>
