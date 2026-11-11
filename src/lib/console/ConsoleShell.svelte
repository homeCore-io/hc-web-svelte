<!--
	The console's frame (the HomeConsole board): a toolbar across the top
	with search, alerts, the household's settings and the person's own; down
	the side, the whole home, the house's Everywhere views and every room in
	Home's order. The sidebar folds to a slim rail of icons, and each person's
	choice follows them to every screen they sign in to.

	The page itself is drawn in the middle as it is in the standard frame, so
	Home, rooms and pages, Edit and Customise, and a device's details all work
	here too. Loaded only when a look puts the app in the console's frame.
-->
<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import Bell from '@lucide/svelte/icons/bell';
	import Settings from '@lucide/svelte/icons/settings';
	import House from '@lucide/svelte/icons/house';
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import Music from '@lucide/svelte/icons/music';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Shield from '@lucide/svelte/icons/shield';
	import Droplets from '@lucide/svelte/icons/droplets';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeftOpen from '@lucide/svelte/icons/panel-left-open';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { backFor, titleFor } from '#lib/nav.js';
	import { homeRoomOrder, ref } from '#lib/layers.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { byRoom } from '#lib/summary.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import { finder } from '#lib/finder.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { followEdit } from '#lib/editFrame.svelte.js';
	import Mark from '#lib/components/Mark.svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import RoomIcon from '#lib/components/RoomIcon.svelte';
	import SideRoomStatus from '#lib/components/SideRoomStatus.svelte';
	import EditMenu from '#lib/components/EditMenu.svelte';
	import EditBar from '#lib/components/EditBar.svelte';
	import UnlockedBar from '#lib/components/UnlockedBar.svelte';
	import DetailsHost from '#lib/components/DetailsHost.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import YouMenu from './YouMenu.svelte';
	import HouseMenu, { houseItems } from './HouseMenu.svelte';
	import { sidebarOf, withConsole } from './style.js';

	let { children }: { children: Snippet } = $props();

	const pathname = $derived(page.url.pathname);
	const title = $derived(heading.text ?? titleFor(pathname));
	const back = $derived(heading.back ?? backFor(pathname));

	// ---- the sidebar: open, or folded to the rail; the person's own choice ----
	const folded = $derived(sidebarOf(personal.doc.console) === 'folded');
	function fold() {
		const next = folded ? undefined : 'folded';
		void personal.change((d) => withConsole(d, { sidebar: next }));
	}
	function keys(e: KeyboardEvent) {
		if (e.key === 'Escape' && menu !== null) {
			e.preventDefault();
			closeMenu(true);
			return;
		}
		if (e.key === '\\' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
			e.preventDefault();
			fold();
		}
	}

	// The rooms in the order Home shows them: the household's, then this person's.
	const roomsInOrder = $derived(
		homeRoomOrder(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown
	);
	const grouped = $derived(byRoom(devices.byId, rooms.list));

	// The house's Everywhere views: each a page of its own, coming in a later step.
	const EVERYWHERE = [
		{ id: 'lights', label: 'Lights', icon: Lightbulb },
		{ id: 'media', label: 'Media', icon: Music },
		{ id: 'climate', label: 'Climate', icon: Thermometer },
		{ id: 'security', label: 'Security', icon: Shield },
		{ id: 'water', label: 'Water', icon: Droplets }
	];

	// ---- Edit mode (N6), in the address (N5), as the standard frame has it ----
	const edit = followEdit();
	const key = $derived(edit.key);
	const editingHere = $derived(edit.here);

	// Bars that stick under the toolbar (Customise, Edit) follow its height.
	let barHeight = $state(52);
	$effect(() => {
		document.documentElement.style.setProperty('--header-h', `${barHeight}px`);
	});

	// ---- the two menus: the household's settings, and the person's own ----
	let menu = $state<'you' | 'house' | null>(null);
	let opener: HTMLElement | null = null;
	let menuBox = $state<HTMLElement>();
	const houseList = $derived(houseItems((s) => session.can(s), session.isAdmin));
	async function openMenu(which: 'you' | 'house', e: MouseEvent) {
		if (menu === which) return closeMenu();
		opener = e.currentTarget as HTMLElement;
		menu = which;
		await tick();
		menuBox?.focus();
	}
	function closeMenu(refocus = false) {
		menu = null;
		if (refocus) opener?.focus();
		opener = null;
	}
	function outside(e: PointerEvent) {
		if (menu === null) return;
		const t = e.target as Node;
		if (menuBox?.contains(t) || opener?.contains(t)) return;
		closeMenu();
	}
	afterNavigate(() => {
		if (menu !== null) closeMenu();
	});

	const alertCount = $derived(alerts.list.length);
	const liveLabel = $derived(
		live.state === 'live'
			? 'Connected to homeCore'
			: live.state === 'connecting'
				? 'Connecting to homeCore'
				: 'homeCore is not answering'
	);
	const me = $derived(session.me?.username ?? '');
</script>

<svelte:window onkeydown={keys} onpointerdown={outside} />

<div class="console" class:folded>
	<header class="tb" bind:offsetHeight={barHeight}>
		<button
			class="collapse"
			aria-label={folded ? 'Open the sidebar' : 'Fold the sidebar'}
			aria-expanded={!folded}
			title={folded ? 'Open the sidebar (Ctrl+\\)' : 'Fold the sidebar (Ctrl+\\)'}
			onclick={fold}
		>
			{#if folded}
				<PanelLeftOpen size={18} strokeWidth={1.9} aria-hidden="true" />
			{:else}
				<PanelLeftClose size={18} strokeWidth={1.9} aria-hidden="true" />
			{/if}
		</button>
		<a class="brand" href="/" title="Home"><Mark size={26} /><span>homeCore</span></a>
		<span
			class="live"
			data-state={live.state}
			role="status"
			aria-label={liveLabel}
			title={liveLabel}
		></span>
		<button
			class="find"
			aria-label="Search"
			title="Search (Ctrl+K)"
			onclick={() => (finder.open = true)}
		>
			<Search size={14} strokeWidth={2} aria-hidden="true" />
			<span class="words">Search devices, scenes, rooms</span>
			<kbd aria-hidden="true">Ctrl K</kbd>
		</button>
		<a
			class="tbtn ghost bell"
			href="/alerts"
			aria-label={alertCount > 0 ? `Alerts: ${alertCount}` : 'Alerts'}
			aria-current={pathname.startsWith('/alerts') ? 'page' : undefined}
		>
			<Bell size={16} strokeWidth={2} aria-hidden="true" />
			{#if alertCount > 0}<span class="count" aria-hidden="true"
					>{alertCount > 99 ? '99+' : alertCount}</span
				>{/if}
		</a>
		{#if houseList.length > 0}
			<button
				class="tbtn ghost"
				aria-label="Household settings"
				aria-expanded={menu === 'house'}
				aria-haspopup="dialog"
				onclick={(e) => openMenu('house', e)}
			>
				<Settings size={17} strokeWidth={1.9} aria-hidden="true" />
			</button>
		{/if}
		<button
			class="avatar"
			aria-label="You: your own settings"
			aria-expanded={menu === 'you'}
			aria-haspopup="dialog"
			onclick={(e) => openMenu('you', e)}
		>
			<Avatar name={me} photo={personal.doc.photo} size={34} />
		</button>
	</header>

	<div class="body">
		<nav class="src" aria-label="Home and rooms">
			<a
				class="si"
				href="/"
				aria-current={pathname === '/' ? 'page' : undefined}
				title="Whole home"
			>
				<House size={17} strokeWidth={1.9} aria-hidden="true" />
				<span class="lbl">Whole home</span>
			</a>
			<span class="sep" aria-hidden="true"></span>
			<p class="sh">Everywhere</p>
			{#each EVERYWHERE as v (v.id)}
				<button
					type="button"
					class="si soon"
					aria-disabled="true"
					aria-label={`${v.label} everywhere, coming soon`}
					title={`${v.label} everywhere: coming soon`}
				>
					<v.icon size={17} strokeWidth={1.9} aria-hidden="true" />
					<span class="lbl">{v.label}</span>
				</button>
			{/each}
			<span class="sep" aria-hidden="true"></span>
			{#if folded}
				<button class="si" aria-label="Rooms" title="Rooms" onclick={fold}>
					<DoorOpen size={17} strokeWidth={1.9} aria-hidden="true" />
				</button>
			{:else if roomsInOrder.length > 0}
				<p class="sh">Rooms</p>
				{#each roomsInOrder as r (r.id)}
					<a
						class="si room"
						href={`/rooms/${r.id}`}
						aria-current={pathname === `/rooms/${r.id}` ? 'page' : undefined}
						title={r.name}
						><RoomIcon name={household.iconOf(r.id)} size={16} /><span class="lbl">{r.name}</span
						><SideRoomStatus room={r.id} list={grouped.get(r.id) ?? []} /></a
					>
				{/each}
			{/if}
			<span class="grow"></span>
			<div class="foot">
				{#if houseList.length > 0}
					<button
						class="si"
						aria-label="Household settings"
						aria-expanded={menu === 'house'}
						aria-haspopup="dialog"
						title="Household settings"
						onclick={(e) => openMenu('house', e)}
					>
						<Settings size={17} strokeWidth={1.9} aria-hidden="true" />
						<span class="lbl">Settings</span>
					</button>
				{/if}
				<button
					class="si"
					aria-label="You: your own settings"
					aria-expanded={menu === 'you'}
					aria-haspopup="dialog"
					title="You"
					onclick={(e) => openMenu('you', e)}
				>
					<Avatar name={me} photo={personal.doc.photo} size={22} />
					<span class="lbl">You</span>
				</button>
			</div>
		</nav>

		<div class="stage" class:with-sheet={adding.page !== null}>
			<UnlockedBar />
			{#if back || heading.kicker || !heading.owned || key !== null}
				<div class="head">
					<div class="titles">
						{#if back}<a class="back" href={back.href}
								><ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />{back.label}</a
							>{/if}
						{#if heading.kicker}<span class="kicker">{heading.kicker.long}</span>{/if}
						{#if !heading.owned}<h1>{title}</h1>{/if}
					</div>
					{#if key !== null}<EditMenu pageKey={key} />{/if}
				</div>
			{/if}
			<main class:editing={editingHere}>
				{#if editingHere}<EditBar key={key!} />{/if}
				{#if key !== null && !editingHere && household.trouble}<p class="trouble" role="alert">
						{household.trouble}
					</p>{/if}
				{@render children()}
			</main>
		</div>
	</div>

	{#if menu !== null}
		<div
			class="menu"
			role="dialog"
			tabindex="-1"
			aria-label={menu === 'you' ? 'Your settings' : 'Household settings'}
			bind:this={menuBox}
		>
			{#if menu === 'you'}
				<YouMenu close={() => closeMenu()} />
			{:else}
				<HouseMenu items={houseList} />
			{/if}
		</div>
	{/if}
	<DetailsHost />
	<SearchBox />
</div>

<style>
	.console {
		/* The console's surfaces, from the theme's colors: glass over the page. */
		--con-bar: color-mix(in srgb, var(--surface) 85%, transparent);
		--con-side: color-mix(in srgb, var(--side) 80%, transparent);
		--con-edge: color-mix(in srgb, var(--ink) 6%, transparent);
		--con-hover: color-mix(in srgb, var(--ink) 5%, transparent);
		--con-raise: color-mix(in srgb, var(--ink) 7%, transparent);
		--con-here: color-mix(in srgb, var(--accent) 15%, transparent);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(
				1200px 600px at 30% -10%,
				color-mix(in srgb, var(--accent) 9%, transparent),
				transparent 60%
			),
			var(--bg);
		color: var(--ink);
	}

	/* ---- the toolbar ---- */
	.tb {
		position: sticky;
		top: 0;
		z-index: 20;
		height: 52px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		padding: 0 14px;
		background: var(--con-bar);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow: inset 0 -1px 0 var(--con-edge);
	}
	/* Nothing in the toolbar is squeezed or cut off; the search gives way first. */
	.tb > * {
		flex: none;
	}
	.collapse {
		width: 34px;
		height: 34px;
		border: 0;
		border-radius: 9px;
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--ink-muted);
	}
	.collapse:hover {
		background: var(--con-raise);
		color: var(--ink);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-right: 12px;
		font-size: 15px;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-decoration: none;
		color: var(--ink);
	}
	.live {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--track-off);
		transition: background var(--quick);
	}
	.live[data-state='live'] {
		background: var(--track-on);
		box-shadow: 0 0 8px var(--track-on);
	}
	.live[data-state='offline'] {
		background: var(--alert);
	}
	.tb .find {
		flex: 1 1 120px;
		min-width: 36px;
		max-width: 360px;
		height: 32px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		overflow: hidden;
		white-space: nowrap;
		border: 0;
		border-radius: 9px;
		background: var(--con-hover);
		color: var(--ink-muted);
		font: 500 13px var(--font);
		text-align: left;
	}
	.find:hover {
		background: var(--con-raise);
	}
	.find .words {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.find kbd {
		font: 500 11px var(--font);
	}
	.tbtn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 10px;
		border: 0;
		border-radius: 9px;
		background: var(--con-raise);
		color: var(--ink);
		font: 600 13px var(--font);
		text-decoration: none;
	}
	.tbtn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.tbtn.ghost:hover,
	.tbtn[aria-expanded='true'],
	.tbtn[aria-current='page'] {
		background: var(--con-raise);
		color: var(--ink);
	}
	.count {
		color: var(--alert);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.avatar {
		width: 34px;
		height: 34px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
	}
	/* Their initial on the console's colored disc, where they have no picture. */
	.avatar :global(.avatar),
	.foot :global(.avatar) {
		border: 0;
		background: linear-gradient(140deg, var(--cool), color-mix(in srgb, var(--cool) 40%, #a07bff));
		color: #0b0d12;
		font-weight: 800;
	}
	.avatar[aria-expanded='true'] {
		box-shadow: 0 0 0 2px var(--accent);
	}

	/* ---- the sidebar, and the rail it folds to ---- */
	.body {
		flex: 1;
		display: flex;
		min-height: 0;
	}
	.src {
		position: sticky;
		top: 52px;
		height: calc(100dvh - 52px);
		box-sizing: border-box;
		overflow-y: auto;
		flex: 0 0 250px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 10px;
		background: var(--con-side);
		box-shadow: inset -1px 0 0 var(--con-edge);
	}
	.sh {
		margin: 0;
		padding: 12px 10px 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.sep {
		display: none;
	}
	.si {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 32px;
		flex: none;
		box-sizing: border-box;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 500 13px var(--font);
		text-align: left;
		text-decoration: none;
	}
	.si:hover {
		background: var(--con-hover);
	}
	.si[aria-current='page'] {
		background: var(--con-here);
		color: var(--ink);
		font-weight: 600;
	}
	.si.soon {
		color: var(--ink-muted);
		cursor: default;
	}
	.si.soon:hover {
		background: transparent;
	}
	.lbl {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.grow {
		flex: 1;
	}
	.foot {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 8px;
		border-top: 1px solid var(--con-edge);
	}

	/* Folded: the rail of icons, the room list behind one button. */
	.folded .src {
		flex-basis: 64px;
		align-items: center;
		gap: 6px;
		padding: 14px 0;
	}
	.folded .si {
		position: relative;
		width: 42px;
		height: 42px;
		padding: 0;
		justify-content: center;
		border-radius: 12px;
		color: var(--ink-muted);
	}
	.folded .si[aria-current='page'] {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--accent);
	}
	.folded .lbl,
	.folded .sh {
		display: none;
	}
	.folded .sep {
		display: block;
		width: 26px;
		height: 1px;
		margin: 4px 0;
		background: var(--con-edge);
	}
	.folded .foot {
		align-items: center;
		gap: 6px;
		border-top: 0;
	}

	/* ---- the page ---- */
	.stage {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 18px 28px 10px;
	}
	.titles {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.back {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: -4px;
		color: var(--ink-muted);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}
	.kicker {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	main {
		flex: 1;
		padding: var(--space-2) 28px 28px;
	}
	.trouble {
		margin: 0 0 var(--space-3);
		font-size: 13px;
		color: var(--alert);
	}
	main.editing {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: 0 var(--space-2) var(--space-2);
		padding-top: var(--space-3);
		border-radius: var(--radius);
		box-shadow: inset 0 0 0 3px var(--accent);
	}
	/* Add's sheet sits under the page on a narrow screen and beside it on a wide one. */
	.stage.with-sheet {
		padding-bottom: 55dvh;
	}
	@media (min-width: 900px) {
		.stage.with-sheet {
			padding-bottom: 0;
			margin-right: 420px;
		}
	}

	/* ---- the menus, under the toolbar's right end ---- */
	.menu {
		position: fixed;
		top: 56px;
		right: 14px;
		z-index: 30;
		width: min(340px, calc(100vw - 28px));
		max-height: calc(100dvh - 70px);
		overflow-y: auto;
		box-sizing: border-box;
		padding: 8px;
		border-radius: 16px;
		background: color-mix(in srgb, var(--surface) 97%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow:
			0 30px 60px -10px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 0 0 1px var(--con-edge);
	}
	.menu:focus {
		outline: none;
	}

	/* ---- narrow screens: always the rail, the brand's mark alone ---- */
	@media (max-width: 760px) {
		.collapse,
		.brand span,
		.find kbd {
			display: none;
		}
		.brand {
			margin-right: 4px;
		}
		.src {
			flex-basis: 56px;
			align-items: center;
			gap: 6px;
			padding: 12px 0;
		}
		.si {
			position: relative;
			width: 42px;
			height: 42px;
			padding: 0;
			justify-content: center;
			border-radius: 12px;
		}
		.lbl,
		.sh,
		.src :global(.status) {
			display: none;
		}
		.sep {
			display: block;
			width: 26px;
			height: 1px;
			margin: 4px 0;
			background: var(--con-edge);
		}
		.foot {
			align-items: center;
			border-top: 0;
		}
		.head {
			padding: 14px 16px 8px;
		}
		main {
			padding: var(--space-2) 16px 24px;
		}
	}
	@media (max-width: 420px) {
		.tb {
			padding: 0 8px;
			gap: 6px;
		}
		.find .words {
			display: none;
		}
	}
</style>
