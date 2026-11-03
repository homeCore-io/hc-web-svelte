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

	const HOME = 'home';
	const doc = $derived(homeDocument());

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
