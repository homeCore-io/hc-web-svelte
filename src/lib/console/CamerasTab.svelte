<!--
	A room's Cameras tab in the console (the GarageCameras board). One camera
	fills the tab; from two, the one picked is large and live and the others
	a roll of snapshots below it, and picking one swaps it in. Down the right,
	the picked camera's controls, then what the room's cameras saw today
	(naming the camera where there are several; as many as fit, with ‹ ›
	for the rest), and the way to every camera
	on the Cameras page. An event picked here, or from the room's header,
	shows its still large, with Back to live. Anything else the household
	put here sits under the controls as it would with the switches
	(SwitchSet), and the day's events make room for it.

	Sized to the window (`fit`), so it doesn't scroll.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Viewer from './Viewer.svelte';
	import SwitchSet from './SwitchSet.svelte';
	import { setsWithSwitches } from './switches.js';
	import Thumb from './Thumb.svelte';
	import CamControls from './CamControls.svelte';
	import EventShot from './EventShot.svelte';
	import Row from './Row.svelte';
	import Place from './Place.svelte';
	import { fit } from './fit.js';
	import { camEvents } from './camEvents.svelte.js';
	import {
		agoWord,
		allEvents,
		badgeOf,
		camerasOf,
		kindName,
		latestOf,
		pageOf,
		pickedOf,
		roomLayoutOf
	} from './cameras.js';
	import { brandOf, shortName } from './room.js';
	import type { SwitchStyle } from './style.js';

	let { list, room, may, sw }: { list: CoreDevice[]; room: string; may: boolean; sw: SwitchStyle } =
		$props();

	const cams = $derived(camerasOf(list, devices.byId));
	$effect(() => camEvents.follow(cams));
	const layout = $derived(roomLayoutOf(cams.length));
	// Sirens and spotlights of no camera here: rows that open their page.
	const owned = $derived(
		new Set(cams.flatMap((c) => [c.id, c.spotlight?.device_id, c.siren?.device_id]))
	);
	const loose = $derived(list.filter((d) => !owned.has(d.device_id)));
	// A switch or timer the household put here sits as it would with the switches.
	const switched = $derived(loose.filter(setsWithSwitches));

	const events = $derived(
		allEvents(
			camEvents.byCam,
			cams.map((c) => c.id)
		)
	);
	const eventKey = $derived(page.url.searchParams.get('event'));
	const event = $derived(eventKey ? events.find((e) => e.key === eventKey) : undefined);
	let picked = $state<string | undefined>(undefined);
	const sel = $derived(pickedOf(cams, event?.cam ?? picked));
	const others = $derived(cams.filter((c) => c.id !== sel?.id));
	let hd = $state(false);

	function show(key: string | null) {
		const url = new URL(page.url.href);
		if (key) url.searchParams.set('event', key);
		else url.searchParams.delete('event');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
	function pick(id: string) {
		picked = id;
		hd = false;
		if (eventKey) show(null);
	}
	function showEvent(key: string, cam: string) {
		picked = cam;
		hd = false;
		show(key);
	}

	// As many of the day's events as fit down the side.
	let listH = $state(0);
	const ROW = 59;
	const fits = $derived(Math.max(1, Math.floor((listH + 6) / (ROW + 6))));
	let first = $state(0);
	const pg = $derived(pageOf(events.length, fits, first));
	const nameOf = (id: string) => shortName(cams.find((c) => c.id === id)?.name ?? id, room);
	const at = (t: number) =>
		new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const badge = (id: string) => {
		const e = latestOf(events, id, clock.now);
		return e ? badgeOf(e, clock.now) : undefined;
	};
</script>

{#snippet alsoHere(look?: 'rows')}
	{#if switched.length > 0}<SwitchSet list={switched} {room} {may} {look} />{/if}
	{#each loose.filter((d) => !switched.includes(d)) as d (d.device_id)}
		<Row
			name={shortName(d.name_override ?? d.name, room)}
			sub={brandOf(d.plugin_id)}
			word={d.available ? cardFor(d, clock.now).stateLine : 'Offline'}
			onopen={() => openDevice(d.device_id, page.url)}
			place={d}
		/>
	{/each}
{/snippet}

{#if layout === 'none'}
	<div class="desk none">
		{@render alsoHere()}
	</div>
{:else if sel}
	<div class="desk" use:fit={`${layout}:${cams.length}`}>
		<div class="main" class:roll={layout === 'roll'}>
			<div class="frame">
				<Viewer cam={sel} {hd} {event} onhd={() => (hd = !hd)} onback={() => show(null)} />
			</div>
			{#if layout === 'roll'}
				<div class="strip" role="group" aria-label="The room’s other cameras">
					{#each others as c (c.id)}
						<div class="tw">
							<Thumb cam={c} badge={badge(c.id)} onpick={() => pick(c.id)} />
							<Place d={c.device} corner />
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<aside class="side" aria-label={`${sel.name} and today`}>
			<div class="ch">
				<span class="tag">{brandOf(sel.device.plugin_id)}</span>
				<button type="button" class="ttl" onclick={() => openDevice(sel.id, page.url)}
					>{shortName(sel.name, room)}</button
				>
				{#if sel.model}<span class="cn">{sel.model}</span>{/if}
				<span class="pl"><Place d={sel.device} /></span>
			</div>
			<CamControls cam={sel} {may} {sw} side />
			{#if loose.length > 0}
				<div class="extras" role="group" aria-label="Also here">
					{@render alsoHere('rows')}
				</div>
			{/if}

			<div class="ch">
				<span class="ttl">Here today</span>
				<span class="cn"
					>{pg.word || (events.length === 1 ? '1 event' : `${events.length} events`)}{cams.some(
						(c) => camEvents.failed[c.id]
					)
						? ' · history unread'
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
			<div class="evs" bind:clientHeight={listH}>
				{#each events.slice(pg.first, pg.last) as e (e.key)}
					{@const c = cams.find((x) => x.id === e.cam)}
					<button
						type="button"
						class="ev"
						class:on={e.key === eventKey}
						onclick={() => showEvent(e.key, e.cam)}
					>
						<span class="pic"><EventShot plugin={c?.device.plugin_id} path={e.snapshot} /></span>
						<span class="et"
							>{kindName(e.kind)}{cams.length > 1 ? ` · ${nameOf(e.cam)}` : ''}<small
								>{at(e.at)} · {agoWord(e.at, clock.now)}</small
							></span
						>
					</button>
				{:else}
					<p class="note">
						{cams.every((c) => camEvents.ready[c.id])
							? 'Nothing seen here yet today.'
							: 'Reading today’s events…'}
					</p>
				{/each}
			</div>
			<a class="more" href="/cameras">Every camera, on the Cameras page ›</a>
		</aside>
	</div>
{/if}

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		gap: 20px;
		padding: 0 0 0 18px;
		min-width: 0;
	}
	.desk.none {
		flex-direction: column;
		align-items: stretch;
		max-width: 420px;
		gap: 0;
	}
	.main {
		flex: 0 1 auto;
		width: calc(360px + 520px * var(--k, 1));
		max-width: calc(100% - 320px);
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.frame {
		width: 100%;
		aspect-ratio: 16 / 9;
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	/* Each snapshot with its "⋯" over its top right corner. */
	.tw {
		position: relative;
		min-width: 0;
	}
	.side {
		flex: 0 0 300px;
		align-self: stretch;
		contain: size;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		overflow: hidden;
	}
	.ch {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		font-size: 12.5px;
		font-weight: 700;
		min-width: 0;
	}
	.ttl {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	button.ttl {
		cursor: pointer;
	}
	button.ttl:hover {
		text-decoration: underline;
	}
	.cn {
		flex: 0 1000 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.tag {
		flex: none;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 7px;
		border-radius: 6px;
		background: rgba(127, 184, 255, 0.16);
		color: #a9cdff;
	}
	:global(:root[data-theme='light']) .tag {
		color: #1f5fae;
	}
	.pl {
		flex: none;
		display: flex;
		margin-left: auto;
	}
	/* What else is here: as much as leaves the day's events a row. */
	.extras {
		flex: 0 1 auto;
		min-height: 0;
		max-height: 45%;
		overflow-y: auto;
		padding-right: 2px;
	}
	.evs {
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		overflow: hidden;
	}
	.ev {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 59px;
		box-sizing: border-box;
		padding: 6px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.ev.on {
		box-shadow: 0 0 0 2px #ffc46b;
	}
	.ev:focus-visible,
	.pager button:focus-visible,
	.ttl:focus-visible,
	.more:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pager {
		flex: none;
		display: flex;
		gap: 4px;
		margin-left: auto;
	}
	.pager button {
		width: 26px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font-size: 16px;
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
	.pic {
		flex: none;
		width: 84px;
		border-radius: 8px;
		overflow: hidden;
	}
	.et {
		min-width: 0;
		font-size: 12.5px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.et small {
		display: block;
		margin-top: 2px;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.note {
		margin: 0;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.more {
		flex: none;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.more:hover {
		color: var(--ink);
	}
</style>
