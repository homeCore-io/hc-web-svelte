<!--
	The generated home (D1): what needs attention and what's on, as chips;
	the cards the household pinned; this person's favourites; the house's
	modes and the scenes that belong to no room; then every room, with its
	summary and "All off" (C5).

	Computed into a page document (`homePage`) and drawn by `PageView`, with
	the household's changes, then the person's own on top (M2, M3): order,
	what was hidden, names and sizes — of cards and of sections. Customise
	arranges it for one person; Edit, for everyone (N6).
-->
<script lang="ts">
	import { cardFor, kindOf } from '#lib/card.js';
	import { displayName } from '#lib/devices.js';
	import { heading } from '#lib/heading.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { homeStyle } from '#lib/styles.js';
	import { houseChips } from '#lib/summary.js';
	import { cardRef } from '#lib/layers.js';
	import { homePage } from '#lib/page.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import PageView from '#lib/components/PageView.svelte';

	const HOME = 'home';
	const chips = $derived(houseChips(Object.values(devices.byId).map((d) => cardFor(d, clock.now))));
	const doc = $derived(
		homePage({
			devices: devices.byId,
			rooms: rooms.list,
			scenes: scenes.list,
			favourites: personal.doc.favourites ?? [],
			// Cards the household pinned to Home (M2 `add`).
			added: view.added(HOME),
			pluginCard: (r) => {
				const c = cardRef(r);
				const found = c ? pluginUis.card(c.pluginId, c.element) : undefined;
				return found
					? { label: found.slot.label ?? 'A plugin’s card', forms: found.slot.forms }
					: undefined;
			},
			alerts: alerts.list.length,
			chips,
			mode: view.mode(HOME)
		})
	);

	// The room field (mockup A): wider, and the day and the house's mode above the title.
	const field = $derived(homeStyle(view.changes(HOME), kindOptions.shellRooms(HOME)) === 'field');
	const kicker = $derived.by(() => {
		if (!field) return null;
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
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="home" class:field>
		<CustomiseBar page={HOME} home />
		<PageView page={doc} />
	</div>
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
