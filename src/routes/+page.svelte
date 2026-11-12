<!--
	The generated home (D1): what needs attention and what's on, as chips;
	the cards the household pinned; this person's favourites; the house's
	modes and the scenes that belong to no room; then every room, with its
	summary and "All off" (C5).

	Computed into a page document (`homePage`) and drawn by `PageView`, with
	the household's changes, then the person's own on top (M2, M3): order,
	what was hidden, names and sizes — of cards and of sections. Customise
	arranges it for one person; Edit, for everyone (N6).

	The console's look draws Home its own way (ConsoleHome), loaded only
	then, unless Home is being arranged for the other looks.
-->
<script lang="ts">
	import { kindOf } from '#lib/card.js';
	import { displayName } from '#lib/devices.js';
	import { heading } from '#lib/heading.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { homeStyle } from '#lib/styles.js';
	import { homeDocument } from '#lib/homeDoc.js';
	import { devices } from '#lib/devices.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import PageView from '#lib/components/PageView.svelte';
	import { page } from '$app/state';
	import { pushState } from '$app/navigation';
	import { look } from '#lib/look.svelte.js';
	import { shellOf } from '#lib/looks/model.js';
	import type { Component } from 'svelte';

	// A room opened over Home where the look says so (13 §7, G1), as a step in
	// the history, so Back closes it (G2). Not while Home is being arranged,
	// and not when someone asks for a new tab.
	function openOver(e: MouseEvent) {
		if (!look.def.frame.sheet || view.mode(HOME) !== null) return;
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;
		const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/rooms/"]');
		const id = a?.getAttribute('href')?.slice('/rooms/'.length);
		if (!id || id.includes('/')) return;
		e.preventDefault();
		pushState('', { sheet: decodeURIComponent(id) });
	}

	const HOME = 'home';
	const doc = $derived(homeDocument());

	// The room field (mockup A): wider, and the day and the house's mode above the title.
	const field = $derived(homeStyle(view.changes(HOME), kindOptions.shellRooms(HOME)) === 'field');
	const kicker = $derived.by(() => {
		if (!field || desk) return null;
		const at = new Date(clock.now);
		const day = (o: Intl.DateTimeFormatOptions) => at.toLocaleDateString(undefined, o);
		const mode = Object.values(devices.byId).find(
			(d) => kindOf(d) === 'mode' && d.attributes.on === true
		);
		const withMode = (s: string) => (mode ? `${s} · ${displayName(mode)}` : s);
		return {
			long: withMode(day({ weekday: 'long', day: 'numeric', month: 'long' })),
			short: withMode(day({ weekday: 'short', day: 'numeric', month: 'short' }))
		};
	});
	$effect(() => heading.showKicker(kicker));

	// The console's Home (the HomeConsole board), loaded only for its look.
	const desk = $derived(shellOf(look.def) === 'console' && view.mode(HOME) === null);
	let ConsoleHome = $state<Component | null>(null);
	$effect(() => {
		if (desk && !ConsoleHome)
			void import('#lib/console/ConsoleHome.svelte').then((m) => (ConsoleHome = m.default));
	});
</script>

{#if desk}
	{#if ConsoleHome}<ConsoleHome />{/if}
{:else if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="home" class:field onclickcapture={openOver}>
		<CustomiseBar page={HOME} home />
		<PageView page={doc} />
	</div>
	{#if page.state.sheet}
		{#await import('#lib/components/rooms/RoomSheet.svelte') then { default: RoomSheet }}
			<RoomSheet id={page.state.sheet} close={() => history.back()} />
		{/await}
	{/if}
{/if}

<style>
	.home {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	.home.field {
		max-width: 1240px;
	}
	.quiet {
		color: var(--ink-muted);
		margin: 0;
	}
</style>
