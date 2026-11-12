<!--
	Everywhere › Cameras in the console (the CamerasWall board), after the
	household's own kiosk: one camera large and live, a rail of snapshots of
	the rest on the right, every 8 seconds (one column up to four cameras,
	two across to eight, and from nine, area chips pick which show). Grid
	swaps the large view for every camera as an equal snapshot; picking one
	plays it large. Under the view, the camera's spotlight, siren, pan and
	tilt and saved positions. Along the bottom, the day's events with each
	one's still, by kind, as many as fit across and ‹ › for the rest;
	picking one shows its still large, with Back to live.

	Fills the window without scrolling. Loaded only on its own page.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import Viewer from './Viewer.svelte';
	import Thumb from './Thumb.svelte';
	import CamControls from './CamControls.svelte';
	import EventShot from './EventShot.svelte';
	import { camEvents } from './camEvents.svelte.js';
	import {
		KINDS,
		agoWord,
		allEvents,
		areasOf,
		badgeOf,
		camerasOf,
		cardsAcross,
		gridOf,
		kindName,
		latestOf,
		pageOf,
		pickedOf,
		pillPrefsOf,
		pillsOf,
		pillWord,
		railOf,
		wallSplit,
		type EventKind
	} from './cameras.js';
	import { switchStyle } from './style.js';

	$effect(() => heading.ownTitle());

	const cams = $derived(camerasOf(Object.values(devices.byId), devices.byId));
	$effect(() => camEvents.follow(cams));
	const sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	const may = $derived(session.mayUse);

	// ---- which camera is large, and what it shows ----
	const eventKey = $derived(page.url.searchParams.get('event'));
	const events = $derived(
		allEvents(
			camEvents.byCam,
			cams.map((c) => c.id)
		)
	);
	const event = $derived(eventKey ? events.find((e) => e.key === eventKey) : undefined);
	let picked = $state<string | undefined>(page.url.searchParams.get('cam') ?? undefined);
	const sel = $derived(pickedOf(cams, event?.cam ?? picked));
	let hd = $state(false);
	let grid = $state(false);

	function show(key: string | null) {
		const url = new URL(page.url.href);
		if (key) url.searchParams.set('event', key);
		else url.searchParams.delete('event');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
	function pick(id: string) {
		picked = id;
		hd = false;
		grid = false;
		if (eventKey) show(null);
	}
	function showEvent(key: string, cam: string) {
		picked = cam;
		hd = false;
		grid = false;
		show(key);
	}

	// ---- the rail ----
	const rail = $derived(railOf(cams.length));
	let area = $state('all');
	const areas = $derived(areasOf(cams, rooms.list));
	const inArea = $derived(
		rail.chips ? (areas.find((a) => a.id === area) ?? areas[0]!).cams : cams.map((c) => c.id)
	);
	const railCams = $derived(cams.filter((c) => inArea.includes(c.id)));
	let midW = $state(0);
	let midH = $state(0);
	let underH = $state(0);
	const split = $derived(
		wallSplit(midW, midH - underH - 10, midH, railCams.length, rail.cols, {
			railGap: rail.cols === 2 ? 8 : 10,
			above: (rail.chips ? 38 : 0) + 26
		})
	);
	const tiles = $derived(gridOf(cams.length));

	// ---- the day's events ----
	let kind = $state<EventKind | 'all'>('all');
	const kindsSeen = $derived(KINDS.filter((k) => cams.some((c) => c.kinds.includes(k.id))));
	const today = $derived(events.filter((e) => kind === 'all' || e.kind === kind));
	// As many cards as fit across, and ‹ › for the rest: the strip never scrolls.
	let evsW = $state(0);
	let winH = $state(800);
	const GAP = 10;
	const card = $derived(Math.round(Math.min(150, Math.max(112, winH * 0.15))));
	let first = $state(0);
	const across = $derived(cardsAcross(evsW, card, GAP));
	// The cards widened a little to fill the row, so it ends flush.
	const cardW = $derived(evsW > 0 ? Math.floor((evsW - GAP * (across - 1)) / across) : card);
	const pg = $derived(pageOf(today.length, across, first));
	function filter(k: EventKind | 'all') {
		kind = k;
		first = 0;
	}
	const failed = $derived(cams.filter((c) => camEvents.failed[c.id]).length);
	const prefs = $derived(pillPrefsOf(household.doc.console?.pills));
	const pills = $derived(pillsOf(events, clock.now, prefs.kinds));
	const nameOf = (id: string) => cams.find((c) => c.id === id)?.name ?? id;
	const at = (t: number) =>
		new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const badge = (id: string) => {
		const e = latestOf(events, id, clock.now);
		return e ? badgeOf(e, clock.now) : undefined;
	};
</script>

<svelte:window bind:innerHeight={winH} />

<div class="wall">
	<div class="top">
		<div>
			<h1>Cameras</h1>
			<p class="cn">
				{cams.length === 1 ? '1 camera' : `${cams.length} cameras`} · live plays while it’s on screen
			</p>
		</div>
		<span class="grow"></span>
		{#each pills as e (e.key)}
			<button
				type="button"
				class="camchip"
				class:old={clock.now - e.at > 10 * 60_000}
				onclick={() => showEvent(e.key, e.cam)}
				><i aria-hidden="true"></i>{pillWord(e, clock.now, nameOf(e.cam))}</button
			>
		{/each}
	</div>

	{#if cams.length === 0}
		<p class="quiet">{devices.loaded ? 'No cameras in the house yet.' : 'Loading the house…'}</p>
	{:else if sel}
		<div class="mid" bind:clientWidth={midW} bind:clientHeight={midH}>
			<div class="left" style:width={grid ? undefined : `${split.viewer}px`} class:wide={grid}>
				<div class="view">
					{#if grid}
						<div
							class="tiles"
							style:grid-template-columns={`repeat(${tiles.cols}, minmax(0, 1fr))`}
							style:grid-template-rows={`repeat(${tiles.rows}, minmax(0, 1fr))`}
						>
							{#each cams as c (c.id)}
								<Thumb
									cam={c}
									on={c.id === sel.id}
									badge={badge(c.id)}
									fill
									onpick={() => pick(c.id)}
								/>
							{/each}
						</div>
					{:else}
						<div class="frame">
							<Viewer
								cam={sel}
								{hd}
								{event}
								onhd={() => (hd = !hd)}
								onback={() => show(null)}
								ongrid={() => {
									grid = true;
									if (eventKey) show(null);
								}}
							/>
						</div>
					{/if}
				</div>
				<div class="under" bind:clientHeight={underH}>
					{#if grid}
						<span class="note"
							>Every camera as a snapshot, every 8 s. Pick one to watch it live.</span
						>
						<button type="button" class="cbtn" onclick={() => (grid = false)}>One camera</button>
					{:else}
						<div class="who">
							<span class="lbl">{sel.name}{sel.model ? ` · ${sel.model}` : ''}</span>
							{#if !sel.spotlight && !sel.siren && !sel.ptz}<span class="note"
									>Nothing to set on this camera.</span
								>{/if}
						</div>
						<CamControls cam={sel} {may} {sw} />
					{/if}
				</div>
			</div>

			<nav
				class="rail"
				class:two={rail.cols === 2}
				style:width={`${split.rail}px`}
				aria-label="Cameras"
			>
				{#if rail.chips}
					<div class="areas" role="group" aria-label="Show cameras in">
						{#each areas as a (a.id)}
							<button
								type="button"
								class:on={area === a.id}
								aria-pressed={area === a.id}
								onclick={() => (area = a.id)}>{a.name}<small>{a.n}</small></button
							>
						{/each}
					</div>
				{/if}
				<div class="thumbs">
					{#each railCams as c (c.id)}
						<Thumb
							cam={c}
							on={c.id === sel.id && !grid}
							live={c.id === sel.id && !grid && !event}
							badge={badge(c.id)}
							small={rail.cols === 2}
							onpick={() => pick(c.id)}
						/>
					{/each}
				</div>
				<span class="note">Snapshots every 8 s.</span>
			</nav>
		</div>

		<section class="today" aria-label="Today">
			<div class="th">
				<span class="lbl">Today</span>
				<div class="filt" role="group" aria-label="Show events">
					<button
						type="button"
						class:on={kind === 'all'}
						aria-pressed={kind === 'all'}
						onclick={() => filter('all')}>All</button
					>
					{#each kindsSeen as k (k.id)}
						<button
							type="button"
							class:on={kind === k.id}
							aria-pressed={kind === k.id}
							onclick={() => filter(k.id)}>{k.name}</button
						>
					{/each}
				</div>
				<span class="cn"
					>{pg.word || (today.length === 1 ? '1 event' : `${today.length} events`)}{failed > 0
						? ` · ${failed === 1 ? 'one camera’s' : `${failed} cameras’`} history couldn’t be read`
						: ''}</span
				>
				{#if pg.word}
					<div class="pager" role="group" aria-label="Page through today’s events">
						<button
							type="button"
							aria-label="Newer events"
							disabled={pg.prev === undefined}
							onclick={() => (first = pg.prev ?? 0)}>‹</button
						>
						<button
							type="button"
							aria-label="Older events"
							disabled={pg.next === undefined}
							onclick={() => (first = pg.next ?? first)}>›</button
						>
					</div>
				{/if}
			</div>
			<div class="evs" bind:clientWidth={evsW} style:--card={`${cardW}px`}>
				{#each today.slice(pg.first, pg.last) as e (e.key)}
					{@const c = cams.find((x) => x.id === e.cam)}
					<button
						type="button"
						class="evc"
						class:on={e.key === eventKey}
						onclick={() => showEvent(e.key, e.cam)}
					>
						<EventShot plugin={c?.device.plugin_id} path={e.snapshot} />
						<span class="et"
							>{kindName(e.kind)} · {nameOf(e.cam)}<small
								>{at(e.at)} · {agoWord(e.at, clock.now)}</small
							></span
						>
					</button>
				{:else}
					<p class="quiet">
						{cams.every((c) => camEvents.ready[c.id])
							? 'Nothing seen yet today.'
							: 'Reading today’s events…'}
					</p>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.wall {
		--con-edge: color-mix(in srgb, var(--ink) 6%, transparent);
		box-sizing: border-box;
		height: calc(100dvh - var(--header-h, 52px));
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 24px 14px;
		min-width: 0;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.cn {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.grow {
		flex: 1;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.camchip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 28px;
		padding: 0 11px 0 9px;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.camchip i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.camchip.old {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink-muted);
	}
	.camchip.old i {
		background: var(--ink-muted);
		box-shadow: none;
	}
	:global(:root[data-theme='light']) .camchip:not(.old) {
		color: #8a5a10;
	}

	.mid {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
		justify-content: center;
		gap: 16px;
	}
	.left.wide {
		flex: 1;
	}
	.left {
		flex: none;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.view {
		flex: 1 1 auto;
		min-height: 120px;
		container-type: size;
	}
	.frame {
		width: min(100cqw, calc(100cqh * 16 / 9));
		aspect-ratio: 16 / 9;
	}
	.tiles {
		display: grid;
		gap: 8px;
		width: 100%;
		height: 100%;
	}
	.under {
		flex: none;
		display: flex;
		align-items: center;
		gap: 18px;
		min-width: 0;
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		max-width: 150px;
	}
	.lbl {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.note {
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ink-muted);
	}
	.cbtn {
		height: 30px;
		padding: 0 11px;
		border: 0;
		border-radius: 9px;
		background: #ffc46b;
		color: #1a0f05;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.rail {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 0;
		overflow: hidden;
	}
	.thumbs {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.two .thumbs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.areas {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.areas button {
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink-muted);
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
	}
	.areas button.on {
		background: color-mix(in srgb, var(--ink) 16%, transparent);
		color: var(--ink);
	}
	.areas small {
		margin-left: 5px;
		font-weight: 500;
		color: var(--ink-muted);
	}

	.today {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.th {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.th .cn {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.filt {
		display: flex;
		gap: 4px;
		padding: 3px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.filt button {
		height: 24px;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.filt button.on {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}
	.evs {
		display: flex;
		gap: 10px;
		min-width: 0;
		min-height: calc(var(--card) * 9 / 16 + 38px);
		overflow: hidden;
	}
	.pager {
		flex: none;
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.pager button {
		width: 28px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font-size: 17px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
	}
	.pager button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.pager button:disabled {
		color: var(--ink-muted);
		opacity: 0.45;
		cursor: default;
	}
	.evc {
		flex: none;
		width: var(--card);
		padding: 0;
		border: 0;
		border-radius: 12px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
		box-shadow: inset 0 0 0 1px var(--con-edge);
	}
	.evc.on {
		box-shadow: 0 0 0 2px #ffc46b;
	}
	.evc:focus-visible,
	.pager button:focus-visible,
	.filt button:focus-visible,
	.areas button:focus-visible,
	.camchip:focus-visible,
	.cbtn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.et {
		display: block;
		padding: 6px 9px 7px;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.et small {
		display: block;
		margin-top: 1px;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	@media (max-height: 760px) {
		.wall {
			gap: 10px;
			padding-top: 12px;
		}
		h1 {
			font-size: 26px;
		}
	}
</style>
