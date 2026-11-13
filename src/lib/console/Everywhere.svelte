<!--
	The house's Everywhere views in the console (the Everywhere board): one of
	Lights, Media, Climate, Security and Water across every room
	(everywhere.ts). Each view draws its own header, with what it's like now
	and its house-wide action, which always asks first; the list under it
	scrolls inside the page when the house has more than fits, so the page
	itself doesn't.

	The rows' common parts are styled here, for every view. On a phone
	(`phone`, phone/PhoneEverywhere), the page scrolls instead, the header
	keeps its line and its action, across, and each row wraps.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { view as views } from '#lib/view.svelte.js';
	import { homeRoomOrder, ref } from '#lib/layers.js';
	import { byRoom } from '#lib/summary.js';
	import EvLights from './EvLights.svelte';
	import EvMedia from './EvMedia.svelte';
	import EvClimate from './EvClimate.svelte';
	import EvSecurity from './EvSecurity.svelte';
	import EvWater from './EvWater.svelte';
	import { everyRoom, placesOf, viewOf } from './everywhere.js';
	import { tabChoicesOf } from './room.js';
	import { household } from '#lib/household.svelte.js';

	let { view, phone = false }: { view: string; phone?: boolean } = $props();

	$effect(() => heading.ownTitle());

	const which = $derived(viewOf(view));
	const order = $derived(
		everyRoom(
			homeRoomOrder(rooms.list, (r) => ref.room(r.id), views.changes('home')).shown,
			rooms.list
		)
	);
	const places = $derived(
		placesOf(byRoom(devices.byId, rooms.list), order, tabChoicesOf(household.doc.console?.tabs))
	);
</script>

<div class="ev" class:phone>
	{#if !devices.loaded}
		<p class="quiet pad">Loading the house…</p>
	{:else if which === 'lights'}
		<EvLights {places} {phone} />
	{:else if which === 'media'}
		<EvMedia {places} />
	{:else if which === 'climate'}
		<EvClimate {places} />
	{:else if which === 'security'}
		<EvSecurity {places} {phone} />
	{:else if which === 'water'}
		<EvWater {places} />
	{:else}
		<p class="quiet pad">There's no Everywhere view called “{view}”.</p>
	{/if}
</div>

<style>
	.ev {
		--con-edge: color-mix(in srgb, var(--ink) 6%, transparent);
		/* The header's glow sits behind the list's top too, never over it. */
		position: relative;
		isolation: isolate;
		box-sizing: border-box;
		height: calc(100dvh - var(--header-h, 52px));
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.pad {
		padding: 24px 28px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}

	/* ---- what every view's list is made of ---- */
	:where(.ev) :global(.evlist) {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		padding: 0 28px 18px;
	}
	/* A heading over a part of the list: THERMOSTATS, VALVES. */
	:where(.ev) :global(.ch) {
		margin: 0;
		padding: 0 0 6px;
		display: flex;
		align-items: baseline;
		gap: 10px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	:where(.ev) :global(.ch small) {
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
	}
	:where(.ev) :global(.evrow) {
		display: flex;
		align-items: center;
		gap: 18px;
		min-height: 50px;
		border-top: 1px solid var(--con-edge);
	}
	:where(.ev) :global(.evname) {
		width: 170px;
		flex: none;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
	}
	:where(.ev) :global(a.evname:hover b),
	:where(.ev) :global(button.evname:hover b) {
		text-decoration: underline;
	}
	:where(.ev) :global(.evname b) {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	:where(.ev) :global(.evname small) {
		font-size: 11.5px;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	:where(.ev) :global(.quiet) {
		color: var(--ink-muted);
		font-size: 13px;
	}

	/* A device's state as a pill: green when fine, red when not, blue when wet. */
	:where(.ev) :global(.spill) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 90%, transparent);
		font: 600 12px var(--font);
		white-space: nowrap;
	}
	:where(.ev) :global(button.spill) {
		cursor: pointer;
	}
	:where(.ev) :global(button.spill:hover) {
		filter: brightness(1.15);
	}
	:where(.ev) :global(.spill.ok) {
		background: color-mix(in srgb, var(--good, #4fe0a0) 18%, transparent);
		color: var(--good-ink, color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink)));
	}
	:where(.ev) :global(.spill.bad) {
		background: color-mix(in srgb, var(--alert) 22%, transparent);
		color: color-mix(in srgb, var(--alert) 65%, var(--ink));
	}
	:where(.ev) :global(.spill.wet) {
		background: rgba(58, 140, 255, 0.22);
		color: color-mix(in srgb, #8fbfff 80%, var(--ink));
		box-shadow:
			inset 0 0 0 1px rgba(90, 160, 255, 0.7),
			0 0 14px rgba(58, 140, 255, 0.45);
	}
	:where(.ev) :global(.spill[aria-busy='true']) {
		opacity: 0.6;
	}
	:where(.ev) :global(.pills) {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 0;
	}

	/* What needs attention, first: a pill with the thing to do about it. */
	:where(.ev) :global(.issues) {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 0 14px;
	}
	:where(.ev) :global(.ipill) {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 38px;
		padding: 0 6px 0 14px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--alert) 14%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--alert) 50%, transparent);
		color: color-mix(in srgb, var(--alert) 35%, var(--ink));
		font: 600 13px var(--font);
		cursor: pointer;
	}
	:where(.ev) :global(.ipill i) {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--alert);
		box-shadow: 0 0 8px var(--alert);
	}
	:where(.ev) :global(.ipill b) {
		height: 28px;
		padding: 0 10px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		background: var(--alert);
		color: #1a0605;
		font-size: 12px;
	}
	:where(.ev) :global(.ipill.wet) {
		background: rgba(58, 140, 255, 0.16);
		box-shadow: inset 0 0 0 1px rgba(90, 160, 255, 0.6);
		color: color-mix(in srgb, #8fbfff 70%, var(--ink));
	}
	:where(.ev) :global(.ipill.wet i),
	:where(.ev) :global(.ipill.wet b) {
		background: #3a8cff;
		box-shadow: 0 0 8px #3a8cff;
	}
	:where(.ev) :global(.ipill.wet b) {
		color: #04112a;
		box-shadow: none;
	}
	:where(.ev) :global(.ipill:disabled) {
		cursor: default;
		opacity: 0.7;
	}

	/* A small round button: play, − and +. */
	:where(.ev) :global(.xbtn) {
		flex: none;
		width: 34px;
		height: 34px;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
		font: 500 18px/1 var(--font);
		cursor: pointer;
	}
	:where(.ev) :global(.xbtn:hover:not(:disabled)) {
		background: color-mix(in srgb, var(--ink) 15%, transparent);
	}
	:where(.ev) :global(.xbtn:disabled) {
		cursor: default;
		opacity: 0.45;
	}
	/* A plain button in a row: Turn off, Shut off water. */
	:where(.ev) :global(.rbtn) {
		flex: none;
		height: 34px;
		padding: 0 14px;
		border: 0;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
		font: 600 12.5px var(--font);
		cursor: pointer;
		white-space: nowrap;
	}
	:where(.ev) :global(.rbtn:hover:not(:disabled)) {
		background: color-mix(in srgb, var(--ink) 15%, transparent);
	}
	:where(.ev) :global(.rbtn:disabled) {
		cursor: default;
		opacity: 0.5;
	}
	:where(.ev) :global(.rbtn[aria-busy='true']) {
		opacity: 0.7;
	}

	/* ---- on a phone: one page that scrolls, each row wrapping under its name ---- */
	.ev.phone {
		height: auto;
	}
	.ev.phone :global(.evhead) {
		padding: 10px 16px 14px;
	}
	.ev.phone :global(.evhead .glow) {
		height: 200px;
	}
	.ev.phone :global(.evhead .kick),
	.ev.phone :global(.evhead h1) {
		display: none;
	}
	.ev.phone :global(.evhead .sum) {
		margin: 0;
	}
	.ev.phone :global(.evhead .side),
	.ev.phone :global(.evhead .acts),
	.ev.phone :global(.evhead .hbtn) {
		width: 100%;
		align-items: stretch;
	}
	.ev.phone :global(.evhead .trouble) {
		max-width: none;
		text-align: left;
	}
	.ev.phone :global(.hbtn),
	.ev.phone :global(.wideact) {
		min-height: 48px;
		border-radius: 14px;
		font-size: 14px;
	}
	.ev.phone :global(.wideact) {
		width: 100%;
		margin: 0 0 14px;
		border: 0;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font-weight: 700;
	}
	.ev.phone :global(.wideact:disabled) {
		opacity: 0.5;
	}
	:where(.ev.phone) :global(.evlist) {
		overflow: visible;
		padding: 0 16px 20px;
	}
	:where(.ev.phone) :global(.evrow) {
		flex-wrap: wrap;
		gap: 6px 12px;
		padding: 10px 0;
	}
	:where(.ev.phone) :global(.evname) {
		width: auto;
		flex: 1 1 0;
		min-height: 44px;
		justify-content: center;
	}
	:where(.ev.phone) :global(.pills),
	:where(.ev.phone) :global(.issues) {
		flex-basis: 100%;
	}
	:where(.ev.phone) :global(.ipill) {
		min-height: 44px;
		height: auto;
		max-width: 100%;
		text-align: left;
	}
	:where(.ev.phone) :global(.pair button) {
		height: 44px;
	}
	:where(.ev.phone) :global(.spill) {
		height: 44px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	:where(.ev.phone) :global(.xbtn) {
		width: 44px;
		height: 44px;
	}
	:where(.ev.phone) :global(.rbtn) {
		height: 44px;
	}

	@media (max-width: 1100px) {
		:where(.ev) :global(.evlist) {
			padding: 0 16px 16px;
		}
		.pad {
			padding: 18px 16px;
		}
	}
	/* A shorter window: slimmer rows, so a dozen rooms fit without scrolling. */
	@media (max-height: 820px) {
		:where(.ev) :global(.evrow) {
			min-height: 44px;
		}
		:where(.ev) :global(.pills) {
			padding: 6px 0;
		}
	}
</style>
