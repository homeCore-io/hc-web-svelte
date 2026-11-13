<!--
	Cameras on the phone (the PhonePlan board), from the console's camera
	wall (cameras.ts): one camera large on top, live only while it's on
	screen; the others as snapshots, two across, every 8 seconds, picking one
	plays it large; then the day's events, by kind, each with its still,
	picking one shows that still large with Back to live. For the house's
	Cameras page, and a room's Cameras tab with the room's cameras.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import Viewer from '../Viewer.svelte';
	import Thumb from '../Thumb.svelte';
	import EventShot from '../EventShot.svelte';
	import { camEvents } from '../camEvents.svelte.js';
	import {
		KINDS,
		agoWord,
		allEvents,
		badgeOf,
		camerasOf,
		kindName,
		latestOf,
		pickedOf,
		type EventKind
	} from '../cameras.js';

	let { list }: { list: CoreDevice[] } = $props();

	const cams = $derived(camerasOf(list, devices.byId));
	$effect(() => camEvents.follow(cams));

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
	const others = $derived(cams.filter((c) => c.id !== sel?.id));
	let hd = $state(false);
	let top = $state<HTMLElement>();

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
		top?.scrollIntoView({ block: 'nearest' });
	}
	function showEvent(key: string, cam: string) {
		picked = cam;
		hd = false;
		show(key);
		top?.scrollIntoView({ block: 'nearest' });
	}

	// ---- the day's events: the newest first, more on asking ----
	let kind = $state<EventKind | 'all'>('all');
	const kindsSeen = $derived(KINDS.filter((k) => cams.some((c) => c.kinds.includes(k.id))));
	const today = $derived(events.filter((e) => kind === 'all' || e.kind === kind));
	const SHOWN = 12;
	let more = $state(false);
	const failed = $derived(cams.filter((c) => camEvents.failed[c.id]).length);
	const nameOf = (id: string) => cams.find((c) => c.id === id)?.name ?? id;
	const at = (t: number) =>
		new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const badge = (id: string) => {
		const e = latestOf(events, id, clock.now);
		return e ? badgeOf(e, clock.now) : undefined;
	};
</script>

{#if cams.length === 0}
	<p class="quiet">{devices.loaded ? 'No cameras here yet.' : 'Loading the house…'}</p>
{:else if sel}
	<div class="cams">
		<div class="view" bind:this={top}>
			<Viewer
				cam={sel}
				{hd}
				{event}
				named={false}
				onhd={() => (hd = !hd)}
				onback={() => show(null)}
			/>
		</div>
		<div class="who">
			<span>{sel.name}{sel.model ? ` · ${sel.model}` : ''}</span>
			<button type="button" class="more" onclick={() => openDevice(sel.id, page.url)}
				>Details</button
			>
		</div>

		{#if others.length > 0}
			<div class="thumbs" role="group" aria-label="The other cameras">
				{#each others as c (c.id)}
					<Thumb cam={c} badge={badge(c.id)} small onpick={() => pick(c.id)} />
				{/each}
			</div>
			<p class="note">Snapshots every 8 s. Pick one to watch it live.</p>
		{/if}

		<section class="today" aria-label="Today">
			<h2 class="sh">Today</h2>
			<div class="filt" role="group" aria-label="Show events">
				<button
					type="button"
					class:on={kind === 'all'}
					aria-pressed={kind === 'all'}
					onclick={() => (kind = 'all')}>All</button
				>
				{#each kindsSeen as k (k.id)}
					<button
						type="button"
						class:on={kind === k.id}
						aria-pressed={kind === k.id}
						onclick={() => (kind = k.id)}>{k.name}</button
					>
				{/each}
			</div>
			{#if failed > 0}<p class="note">
					{failed === 1 ? 'One camera’s' : `${failed} cameras’`} history couldn’t be read.
				</p>{/if}
			<div class="evs">
				{#each more ? today : today.slice(0, SHOWN) as e (e.key)}
					{@const c = cams.find((x) => x.id === e.cam)}
					<button
						type="button"
						class="evc"
						class:on={e.key === eventKey}
						aria-pressed={e.key === eventKey}
						onclick={() => showEvent(e.key, e.cam)}
					>
						<EventShot plugin={c?.device.plugin_id} path={e.snapshot} cam={e.cam} />
						<span class="et"
							><b>{kindName(e.kind)}</b>{cams.length > 1 ? ` · ${nameOf(e.cam)}` : ''}<small
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
			{#if today.length > SHOWN}
				<button type="button" class="all" onclick={() => (more = !more)}
					>{more ? 'Fewer' : `All ${today.length} events`}</button
				>
			{/if}
		</section>
	</div>
{/if}

<style>
	.cams {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 14px;
	}
	.view {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 16px;
		overflow: hidden;
		background: #000;
		scroll-margin-top: 12px;
	}
	.view :global(.cv) {
		position: absolute;
		inset: 0;
	}
	/* The name is under the picture, so the corner says only how it plays. */
	.view :global(.ov) {
		max-width: calc(100% - 130px);
	}
	/* HD, full screen and Back to live: a thumb's reach, the buttons as drawn. */
	.view :global(.cbtn) {
		position: relative;
		min-width: 38px;
		justify-content: center;
	}
	.view :global(.cbtn::after) {
		content: '';
		position: absolute;
		inset: -7px -3px;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.who span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.more,
	.all {
		flex: none;
		min-height: 44px;
		padding: 0 14px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
		font: 600 13px var(--font);
	}
	.thumbs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.thumbs :global(.thumb) {
		width: 100%;
		min-height: 44px;
	}
	.note {
		margin: -4px 0 0;
		color: var(--ink-muted);
		font-size: 12px;
	}
	.today {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 6px;
	}
	.sh {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.filt {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.filt::-webkit-scrollbar {
		display: none;
	}
	.filt button {
		flex: none;
		min-height: 44px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: color-mix(in srgb, var(--ink) 80%, transparent);
		font: 600 13px var(--font);
	}
	.filt button.on {
		background: var(--ink);
		color: var(--bg);
	}
	.evs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.evc {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 0;
		border: 0;
		border-radius: 12px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--ink);
		text-align: left;
	}
	.evc.on {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.evc :global(.shot) {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
	}
	.et {
		display: flex;
		flex-direction: column;
		padding: 6px 9px 8px;
		font-size: 12px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.et small {
		color: var(--ink-muted);
		font-size: 11px;
	}
	.all {
		align-self: flex-start;
	}
</style>
