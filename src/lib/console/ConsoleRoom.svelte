<!--
	A room in the console's look (the FamilyRoom, Office and LivingRoom
	boards): a header with the room's name, what it's like now, its locks and
	doors, and Room on and Room off; the person's favorites from the room; then
	tabs, each one screen: Doors, Lights, Switches, Media, Climate, Water,
	Sensors, Cameras, as the room has them (room.ts). What the room's cameras
	saw in the last half hour shows as pills in the header, as the household
	chose (cameras.ts); each opens the Cameras tab at that event. The tab shown is kept in the
	address (`?tab=`), so each room opens where the person left it. Each
	device on a tab has a "⋯" for the tab and room it shows in (Placer).

	The room is laid out as the person and the household arranged it in
	Customize (layout.ts): its favorites, its tabs and the one it opens on,
	the Lights tab's columns and hidden lights, its picture and pills.
	Customize itself (`?customize`) is drawn in its place, loaded only then.

	Behind the header, the room's drawing (pictures.ts), lit live by its
	lights, or the household's photo of it with its light spots (photo.ts),
	unless the household chose it plain. Loaded only by the console's look.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import { devices } from '#lib/devices.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { isOpen } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import Icon from '#lib/components/Icon.svelte';
	import LightsTab from './LightsTab.svelte';
	import MediaTab from './MediaTab.svelte';
	import ClimateTab from './ClimateTab.svelte';
	import DoorsTab from './DoorsTab.svelte';
	import WaterTab from './WaterTab.svelte';
	import SensorsTab from './SensorsTab.svelte';
	import SwitchesTab from './SwitchesTab.svelte';
	import CamerasTab from './CamerasTab.svelte';
	import Placer from './Placer.svelte';
	import { Placer as Placing, providePlacer } from './placer.svelte.js';
	import { camEvents } from './camEvents.svelte.js';
	import { pillWord } from './cameras.js';
	import AudioBar from './AudioBar.svelte';
	import RoomPicture from './RoomPicture.svelte';
	import RoomPhoto from './RoomPhoto.svelte';
	import { isPlayer } from './media.js';
	import { RoomNow } from './roomNow.svelte.js';
	import type { TabId } from './room.js';
	import { tabToShow } from './layout.js';
	import type { Component } from 'svelte';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';

	let { id }: { id: string } = $props();

	// The Lights tab is laid out for the width the panel has (room.ts), once it's known.
	let across = $state(0);
	// The room as it is now, arranged as the person and the household chose (roomNow.svelte.ts).
	const r = new RoomNow(
		() => id,
		() => across
	);
	const room = $derived(r.room);
	const list = $derived(r.list);
	const lay = $derived(r.lay);
	const model = $derived(r.model);
	const arranged = $derived(r.arranged);
	const tab = $derived(tabToShow(arranged, page.url.searchParams.get('tab')));

	// ---- Customize, in the address; loaded the first time it's asked for ----
	const customizing = $derived(page.url.searchParams.has('customize'));
	let Customize = $state<Component<{ id: string }> | null>(null);
	$effect(() => {
		if (customizing && !Customize)
			void import('./Customize.svelte').then((m) => (Customize = m.default));
	});
	const customizeHref = $derived.by(() => {
		const url = new URL(page.url.href);
		url.searchParams.set('customize', '');
		return url.pathname + url.search.replace(/customize=(&|$)/, 'customize$1');
	});
	const fader = $derived(r.fader);
	const sw = $derived(r.sw);
	const may = $derived(r.may);
	// Each device's "⋯": where it shows, for the household (Placer).
	const placing = providePlacer(new Placing(r.width));
	$effect(() => {
		void id;
		return () => placing.close();
	});

	// The page draws its own title, in the header.
	$effect(() => heading.ownTitle());

	const card = r.card;
	const nameOf = (d: CoreDevice) => r.nameOf(d);

	// ---- the rooms either side, and what the room is like now ----
	const prev = $derived(r.prev);
	const next = $derived(r.next);
	const temperature = $derived(r.temperature);
	const lit = $derived(r.lit);
	const photo = $derived(r.photo);
	const glow = $derived(r.glow);
	const lightsWord = $derived(r.lightsWord);
	const playing = $derived(r.playing);

	// ---- locks and doors, Room on and off, favorites ----
	const short = r.short;
	const lockPill = (d: CoreDevice) => r.lockPill(d);
	const busy = $derived(r.busy);
	const trouble = $derived(r.trouble);
	const power = (on: boolean) => r.power(on);
	const favs = $derived(r.favs);
	const locks = $derived(r.locks);
	const openings = $derived(r.openings);
	const useFav = (d: CoreDevice) => r.useFav(d);

	// ---- the room's audio ----
	const players = $derived(r.players);
	const audio = $derived(r.audio);
	const choices = $derived(r.choices);
	const { playThrough, volStep, volMute, volLevel } = r;
	const stepNote = $derived(r.stepNote);
	const audioNote = $derived(r.audioNote);

	// ---- what the room's cameras saw lately, as pills ----
	$effect(() => camEvents.follow(r.roomCams));
	const camPills = $derived(r.camPills);
	const camName = r.camName;
	function showEvent(key: string) {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', 'cameras');
		url.searchParams.set('event', key);
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}

	// ---- the tabs ----
	function choose(t: TabId) {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', t);
		url.searchParams.delete('event');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
	let tabBox = $state<HTMLElement>();
	function keys(e: KeyboardEvent) {
		const shown = arranged.shown;
		const i = shown.findIndex((t) => t.id === tab);
		const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (by === 0 || i < 0) return;
		e.preventDefault();
		const nextTab = shown[(i + by + shown.length) % shown.length]!;
		choose(nextTab.id);
		queueMicrotask(() => tabBox?.querySelector<HTMLElement>(`[data-tab="${nextTab.id}"]`)?.focus());
	}
</script>

{#if !devices.loaded}
	<p class="quiet pad">Loading the house…</p>
{:else if room === undefined}
	<p class="quiet pad">This room isn't in the house any more.</p>
{:else if customizing}
	{#if Customize}<Customize {id} />{:else}<p class="quiet pad">Opening Customize…</p>{/if}
{:else}
	<div class="croom">
		<section class="hero" aria-label={room.name}>
			{#if photo}<RoomPhoto
					src={photo.src}
					focus={photo.focus}
					{glow}
				/>{:else if lay.picture !== 'plain'}<RoomPicture picture={lit.picture} g={lit.g} />{/if}
			<div class="band" aria-hidden="true"></div>
			<div class="hc">
				<div class="who">
					<div class="tl">
						{#if prev}<a
								class="step"
								href={`/rooms/${prev.id}`}
								aria-label={`Previous room, ${prev.name}`}
								><ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" /></a
							>{/if}
						<h1 class="title">{room.name}</h1>
						{#if next}<a
								class="step"
								href={`/rooms/${next.id}`}
								aria-label={`Next room, ${next.name}`}
								><ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" /></a
							>{/if}
					</div>
					<div class="chips">
						{#if temperature}<span class="chip">{temperature}</span>{/if}
						{#if lightsWord}<span class="chip">{lightsWord}</span>{/if}
						{#if playing > 0}<span class="chip"
								>{playing === 1 ? '1 playing' : `${playing} playing`}</span
							>{/if}
						{#each locks as d (d.device_id)}
							{@const c = card(d)}
							{@const locked =
								c.control?.kind === 'lock' ? c.control.locked : c.stateLine.startsWith('Locked')}
							<button
								type="button"
								class="pill"
								class:ok={d.available && locked}
								class:bad={!d.available || !locked}
								aria-busy={commands.pending[d.device_id] ? true : undefined}
								title={!d.available
									? `${nameOf(d)} is offline`
									: locked
										? `Unlock ${nameOf(d)}`
										: `Lock ${nameOf(d)}`}
								onclick={() => lockPill(d)}
							>
								{#if locked}<LockIcon
										size={13}
										strokeWidth={2.2}
										aria-hidden="true"
									/>{:else}<LockOpen size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
								{short(nameOf(d))}: {d.available ? (locked ? 'Locked' : 'Unlocked') : 'Offline'}
							</button>
						{/each}
						{#each openings as d (d.device_id)}
							{@const open = isOpen(card(d))}
							<button
								type="button"
								class="pill"
								class:ok={d.available && !open}
								class:bad={!d.available || open}
								title="See the room’s doors"
								onclick={() => choose('doors')}
							>
								{#if open}<DoorOpen
										size={13}
										strokeWidth={2.2}
										aria-hidden="true"
									/>{:else}<DoorClosed size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
								{short(nameOf(d))}: {d.available ? (open ? 'Open' : 'Closed') : 'Offline'}
							</button>
						{/each}
						{#each camPills as e (e.key)}
							<button
								type="button"
								class="pill cam"
								class:old={clock.now - e.at > 10 * 60_000}
								title="See it on the Cameras tab"
								onclick={() => showEvent(e.key)}
								><i aria-hidden="true"></i>{pillWord(e, clock.now, camName(e.cam))}</button
							>
						{/each}
					</div>
				</div>
				<div class="side">
					{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
					<div class="acts">
						<a
							class="ghost"
							href={customizeHref}
							title="Arrange this room: favorites, tabs, lights, its picture and pills"
							><SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />Customize</a
						>
						<!-- Only where they would reach a light: not over cameras' spotlights alone. -->
						{#if r.hasPower}<div class="pair" role="group" aria-label={`${room.name} lights`}>
								<button
									type="button"
									disabled={!may || busy !== null}
									aria-busy={busy === 'on' || undefined}
									onclick={() => power(true)}>{busy === 'on' ? 'Turning on…' : 'Room on'}</button
								>
								<button
									type="button"
									disabled={!may || busy !== null}
									aria-busy={busy === 'off' || undefined}
									onclick={() => power(false)}
									>{busy === 'off' ? 'Turning off…' : 'Room off'}</button
								>
							</div>{/if}
					</div>
				</div>
			</div>
		</section>

		{#if favs.length > 0}
			<div class="favs" role="group" aria-label={`${room.name} favorites`}>
				{#each favs as d (d.device_id)}
					{@const c = card(d)}
					<button type="button" class="fav" class:on={c.tone === 'on'} onclick={() => useFav(d)}>
						<span class="fi"><Icon name={c.icon} size={16} /></span>
						<span class="ft">{c.name}<small>{c.stateLine || 'Scene'}</small></span>
					</button>
				{/each}
			</div>
		{/if}

		{#if arranged.shown.length === 0}
			<p class="quiet pad">Nothing in {room.name} yet.</p>
		{:else}
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				class="subs"
				role="tablist"
				aria-label="In this room"
				tabindex="-1"
				bind:this={tabBox}
				onkeydown={keys}
			>
				{#each arranged.shown as t (t.id)}
					<button
						type="button"
						class="sub"
						class:on={t.id === tab}
						role="tab"
						id={`tab-${t.id}`}
						data-tab={t.id}
						aria-selected={t.id === tab}
						aria-controls="room-panel"
						tabindex={t.id === tab ? 0 : -1}
						onclick={() => choose(t.id)}>{t.name}<span class="n">{t.count}</span></button
					>
				{/each}
			</div>
			<div
				class="panel"
				id="room-panel"
				role="tabpanel"
				bind:clientWidth={across}
				aria-labelledby={`tab-${tab}`}
			>
				{#if tab === 'lights'}
					<LightsTab
						tab={model.lights}
						order={lay.columns}
						room={room.name}
						{fader}
						{sw}
						{may}
						dock={model.byTab.media.length > 0}
					/>
				{:else if tab === 'media'}
					<MediaTab
						screens={players.screens}
						speakers={players.speakers}
						room={room.name}
						{may}
						{fader}
						{audio}
						{audioNote}
						onstep={volStep}
						onmute={volMute}
						extras={model.byTab.media.filter((d) => !isPlayer(d))}
					/>
				{:else if tab === 'climate'}
					<ClimateTab list={model.byTab.climate} room={room.name} {fader} {sw} {may} />
				{:else if tab === 'doors'}
					<DoorsTab list={model.byTab.doors} room={room.name} {may} />
				{:else if tab === 'water'}
					<WaterTab list={model.byTab.water} room={room.name} {may} />
				{:else if tab === 'sensors'}
					<SensorsTab list={model.byTab.sensors} all={list} room={room.name} />
				{:else if tab === 'switches'}
					<SwitchesTab list={model.byTab.switches} room={room.name} {may} />
				{:else if tab === 'timers'}
					<SwitchesTab list={model.byTab.timers} room={room.name} {may} />
				{:else if tab === 'cameras'}
					<CamerasTab list={model.byTab.cameras} room={room.name} {may} {sw} />
				{/if}
			</div>
		{/if}

		{#if model.byTab.media.length > 0}
			<AudioBar
				room={room.name}
				{audio}
				choice={audio?.device_id ?? ''}
				{choices}
				{may}
				{stepNote}
				onchoose={playThrough}
				onstep={volStep}
				onmute={volMute}
				onlevel={volLevel}
			/>
		{/if}
	</div>
	<Placer p={placing} />
{/if}

<style>
	.croom {
		--con-edge-strong: color-mix(in srgb, var(--ink) 9%, transparent);
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--header-h, 52px));
	}
	.pad {
		padding: 24px 28px;
	}
	.quiet {
		color: var(--ink-muted);
	}

	/* ---- the header: the room's drawing, shaded where the words go ---- */
	.hero {
		position: relative;
		min-height: 190px;
		display: flex;
		align-items: flex-end;
		background: #0c0d12;
	}
	.band {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				90deg,
				rgba(7, 8, 11, 0.92) 0%,
				rgba(7, 8, 11, 0.55) 38%,
				rgba(7, 8, 11, 0) 70%
			),
			linear-gradient(0deg, rgba(7, 8, 11, 0.9), rgba(7, 8, 11, 0) 45%);
	}
	/* In the light theme the drawing shows through a pale wash, under dark words. */
	:global(:root[data-theme='light']) .band {
		background:
			linear-gradient(
				90deg,
				rgba(243, 240, 234, 0.95) 0%,
				rgba(243, 240, 234, 0.75) 40%,
				rgba(243, 240, 234, 0.35) 100%
			),
			linear-gradient(0deg, rgba(243, 240, 234, 0.9), rgba(243, 240, 234, 0) 50%);
	}
	.hc {
		position: relative;
		flex: 1;
		display: flex;
		align-items: flex-end;
		flex-wrap: wrap;
		gap: 18px;
		padding: 28px 28px 22px;
	}
	.who {
		flex: 1 1 300px;
		min-width: 0;
	}
	.tl {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.title {
		margin: 0;
		font-size: 46px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.05;
		overflow-wrap: anywhere;
	}
	.step {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}
	.step:hover {
		background: color-mix(in srgb, var(--ink) 20%, transparent);
	}
	.chips {
		display: flex;
		gap: 6px;
		margin-top: 12px;
		flex-wrap: wrap;
	}
	.chip,
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		backdrop-filter: blur(10px);
		font-size: 12px;
		color: color-mix(in srgb, var(--ink) 90%, transparent);
		white-space: nowrap;
	}
	.pill {
		cursor: pointer;
		font-weight: 600;
	}
	.pill.ok {
		background: color-mix(in srgb, var(--good, #4fe0a0) 18%, transparent);
		color: color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink));
	}
	.pill.bad {
		background: color-mix(in srgb, var(--alert) 22%, transparent);
		color: color-mix(in srgb, var(--alert) 65%, var(--ink));
	}
	.pill:hover {
		filter: brightness(1.15);
	}
	.pill.cam {
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
	}
	:global(:root[data-theme='light']) .pill.cam {
		color: #8a5a10;
	}
	.pill.cam i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.pill.cam.old {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 80%, transparent);
	}
	.pill.cam.old i {
		background: var(--ink-muted);
		box-shadow: none;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ghost {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 10px;
		background: rgba(12, 13, 18, 0.62);
		text-decoration: none;
		backdrop-filter: blur(18px);
		color: var(--ink-muted);
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}
	:global(:root[data-theme='light']) .ghost {
		background: rgba(255, 255, 255, 0.7);
	}
	.ghost:hover {
		color: var(--ink);
	}
	.ghost:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.pill[aria-busy='true'] {
		opacity: 0.6;
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.trouble {
		margin: 0;
		max-width: 320px;
		font-size: 12px;
		color: var(--alert);
		text-align: right;
	}
	.pair {
		display: flex;
		padding: 3px;
		border-radius: 12px;
		background: rgba(12, 13, 18, 0.62);
		backdrop-filter: blur(18px);
	}
	:global(:root[data-theme='light']) .pair {
		background: rgba(255, 255, 255, 0.7);
	}
	.pair button {
		height: 32px;
		padding: 0 14px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.pair button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.pair button:disabled {
		cursor: default;
		opacity: 0.6;
	}

	/* ---- favorites ---- */
	.favs {
		display: flex;
		gap: 10px;
		padding: 14px 24px;
		overflow-x: auto;
		box-shadow: inset 0 -1px 0 var(--con-edge);
	}
	.fav {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		padding: 0 14px 0 8px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font-size: 12.5px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.fav:hover {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.fi {
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.fav.on .fi {
		background: var(--track-on);
		color: #2a1704;
	}
	.ft small {
		display: block;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}

	/* ---- tabs ---- */
	.subs {
		display: flex;
		gap: 4px;
		padding: 12px 24px 0;
		overflow-x: auto;
	}
	.sub {
		flex: none;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 16px;
		border: 0;
		border-radius: 11px 11px 0 0;
		background: transparent;
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.sub:hover {
		color: var(--ink);
	}
	.sub.on {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
	}
	.sub:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}
	.n {
		font: 500 11px var(--font-num);
		color: var(--ink-muted);
	}
	.panel {
		margin: 0 24px 18px;
		padding: 18px 4px 18px 0;
		border-radius: 0 16px 16px 16px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		flex: 1;
	}

	@media (max-width: 1100px) {
		.hc {
			padding: 22px 16px 18px;
		}
		.title {
			font-size: 36px;
		}
		.favs,
		.subs {
			padding-left: 16px;
			padding-right: 16px;
		}
		.panel {
			margin: 0 16px 16px;
		}
	}
	/* A shorter window: a slimmer header, so the tab below keeps its room. */
	@media (max-height: 820px) {
		.hero {
			min-height: 0;
		}
		.hc {
			padding-top: 16px;
			padding-bottom: 12px;
		}
		.title {
			font-size: 32px;
		}
		.chips {
			margin-top: 8px;
		}
		.subs {
			padding-top: 8px;
		}
		.panel {
			padding-top: 12px;
			padding-bottom: 12px;
		}
	}
</style>
