<!--
	A room in the console's look (the FamilyRoom, Office and LivingRoom
	boards): a header with the room's name, what it's like now, its locks and
	doors, and Room on and Room off; the person's favorites from the room; then
	tabs, each one screen: Doors, Lights, Switches, Media, Climate, Water,
	Sensors, as the room has them (room.ts). The tab shown is kept in the
	address (`?tab=`), so each room opens where the person left it.

	The header is a dark band for now; a picture of the room goes behind it
	later. Loaded only by the console's look.
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
	import { rooms } from '#lib/rooms.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { withPending } from '#lib/pending.js';
	import { goAhead } from '#lib/ask.js';
	import { roomPower } from '#lib/admin.js';
	import { homeRoomOrder, ref } from '#lib/layers.js';
	import { cardFor, isOpen, kindOf, type CardView } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { openDevice } from '#lib/popup.js';
	import Icon from '#lib/components/Icon.svelte';
	import CardGrid from '#lib/components/CardGrid.svelte';
	import LightsTab from './LightsTab.svelte';
	import MediaTab from './MediaTab.svelte';
	import AudioBar from './AudioBar.svelte';
	import {
		audioChoices,
		muteCmd,
		orderPlayers,
		playerName,
		roomAudioOf,
		stepCmd,
		volumeCmd,
		volumeOf,
		withRoomAudio
	} from './media.js';
	import { send } from './send.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { roomBox } from '#lib/roomBox.js';
	import {
		consoleRoom,
		devicesIn,
		levelOf,
		LIGHTS_WIDTH,
		shortName,
		brandOf,
		tabOf,
		type TabId
	} from './room.js';
	import { faderStyle, switchStyle } from './style.js';

	let { id }: { id: string } = $props();

	const room = $derived(rooms.list.find((r) => r.id === id));
	const list = $derived(room ? devicesIn(devices.byId, room) : []);
	// The Lights tab is laid out for the width the panel has (room.ts), once it's known.
	let across = $state(0);
	const model = $derived(consoleRoom(list, across > 0 ? across - 4 : LIGHTS_WIDTH));
	const tab = $derived(tabOf(model, page.url.searchParams.get('tab')));
	const fader = $derived(faderStyle(personal.doc.console, household.doc.console));
	const sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	const may = $derived(session.mayUse);

	// The page draws its own title, in the header.
	$effect(() => heading.ownTitle());

	const card = (d: CoreDevice): CardView =>
		withPending(cardFor(d, clock.now), commands.pending[d.device_id]);
	const nameOf = (d: CoreDevice) => d.name_override ?? d.name;

	// ---- the rooms either side, in Home's order ----
	const order = $derived(
		homeRoomOrder(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown
	);
	const at = $derived(order.findIndex((r) => r.id === id));
	const prev = $derived(at > 0 ? order[at - 1] : undefined);
	const next = $derived(at >= 0 && at < order.length - 1 ? order[at + 1] : undefined);

	// ---- what the room is like now ----
	// The room's number, as its box on Home and the sidebar show it: its temperature.
	const box = $derived(
		roomBox(
			list,
			list.map((d) => cardFor(d, clock.now)),
			devices.byId,
			kindOptions.of('home', 'room', ref.room(id), ROOM_BUILT_IN)
		)
	);
	const temperature = $derived(box.bigIs === 'lights' ? undefined : box.big);
	const lamps = $derived(model.lights.columns.flatMap((c) => c.lights));
	// Counted as the faders show them, with commands on their way.
	const lampsOn = $derived(
		lamps.filter((d) => d.available && levelOf(d, commands.pending[d.device_id]?.want) > 0).length
	);
	const lightsWord = $derived(
		lamps.length === 0
			? undefined
			: lampsOn === 0
				? 'Lights off'
				: lampsOn === 1
					? '1 light on'
					: `${lampsOn} lights on`
	);
	const playing = $derived(
		model.byTab.media.filter((d) => d.available && card(d).stateLine.startsWith('Playing')).length
	);

	// ---- locks and doors ----
	const short = (s: string) => shortName(s.replace(/\s+sensor$/i, ''), room?.name ?? '');
	async function lockPill(d: CoreDevice) {
		const c = card(d);
		if (c.control?.kind !== 'lock' || !may) return openDevice(d.device_id, page.url);
		if (c.control.locked) {
			if (!(await goAhead(d.device_id, c.kind, `Unlock ${nameOf(d)}?`))) return;
			return void commands.set(d.device_id, c.kind, { locked: false }, d.attributes);
		}
		void commands.set(d.device_id, c.kind, { locked: true }, d.attributes);
	}

	// ---- Room on, Room off ----
	let busy = $state<'on' | 'off' | null>(null);
	let trouble = $state<string | null>(null);
	async function power(on: boolean) {
		if (!room || busy) return;
		busy = on ? 'on' : 'off';
		trouble = null;
		const { error, lights } = await roomPower(room.id, on);
		busy = null;
		if (error) {
			trouble = error;
			return;
		}
		// Each light it sent a command to waits for its answer, as a fader would.
		for (const lid of lights) {
			const d = devices.byId[lid];
			if (d) commands.expect(lid, kindOf(d), { on }, d.attributes);
		}
	}

	// ---- favorites from this room ----
	const favs = $derived.by(() => {
		const here = new Map(list.map((d) => [ref.device(d.device_id), d]));
		return (personal.doc.favourites ?? [])
			.map((r) => here.get(r))
			.filter((d): d is CoreDevice => d !== undefined);
	});
	function useFav(d: CoreDevice) {
		const c = card(d);
		if (c.kind === 'scene' && d.schema?.actions?.some((a) => a.id === 'activate'))
			return void commands.act(d.device_id, 'activate');
		if (c.control?.kind === 'switch' && may && d.available)
			return void commands.set(
				d.device_id,
				c.kind,
				{ [c.control.attr]: !c.control.on },
				d.attributes
			);
		openDevice(d.device_id, page.url);
	}

	// ---- the room's audio ----
	// The one device the room plays through (media.ts): chosen for the house,
	// or by a person for themselves, else the room's first screen or speaker.
	const players = $derived(orderPlayers(model.byTab.media));
	const audio = $derived(
		roomAudioOf(
			id,
			model.byTab.media,
			devices.byId,
			household.doc.roomAudio,
			personal.doc.roomAudio
		).device
	);
	const audioWant = $derived(audio ? commands.pending[audio.device_id]?.want : undefined);
	const choices = $derived(audioChoices(model.byTab.media, devices.byId));
	/** Kept for the house by people who may change it; else for the person alone. */
	function playThrough(choice: string) {
		const edit = <D extends { roomAudio?: Record<string, string> }>(d: D) =>
			withRoomAudio(d, id, choice);
		if (session.can('content:write')) void household.change(edit);
		else void personal.change(edit);
	}
	// A device that reports no level (a Roku) only steps: the bar counts the
	// presses since the room's audio was last chosen, as its own remote would feel.
	let pressed = $state<{ id?: string; by: number; muted: boolean }>({ by: 0, muted: false });
	const presses = $derived(
		pressed.id === audio?.device_id ? pressed : { id: audio?.device_id, by: 0, muted: false }
	);
	function volStep(by: 1 | -1) {
		if (!audio) return;
		void send(audio, stepCmd(audio, by, audioWant));
		if (!volumeOf(audio, audioWant).level)
			pressed = { id: audio.device_id, by: presses.by + by, muted: false };
	}
	function volMute() {
		if (!audio) return;
		void send(audio, muteCmd(audio, audioWant));
		if (volumeOf(audio, audioWant).muted === undefined)
			pressed = { ...presses, id: audio.device_id, muted: !presses.muted };
	}
	const volLevel = (v: number) => {
		if (audio) void send(audio, volumeCmd(audio, v));
	};
	const stepNote = $derived(
		presses.muted
			? 'Muted'
			: presses.by > 0
				? `Up ${presses.by}`
				: presses.by < 0
					? `Down ${-presses.by}`
					: `No level from the ${brandOf(audio?.plugin_id)}`
	);
	const audioNote = $derived(
		!audio
			? 'Choose the room’s audio below for the volume keys'
			: volumeOf(audio, audioWant).level || (presses.by === 0 && !presses.muted)
				? `Volume keys drive the room’s audio: ${playerName(audio)}`
				: `${playerName(audio)}: ${stepNote.toLowerCase()}`
	);

	// ---- the tabs ----
	function choose(t: TabId) {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', t);
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
	let tabBox = $state<HTMLElement>();
	function keys(e: KeyboardEvent) {
		const i = model.tabs.findIndex((t) => t.id === tab);
		const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		if (by === 0 || i < 0) return;
		e.preventDefault();
		const nextTab = model.tabs[(i + by + model.tabs.length) % model.tabs.length]!;
		choose(nextTab.id);
		queueMicrotask(() => tabBox?.querySelector<HTMLElement>(`[data-tab="${nextTab.id}"]`)?.focus());
	}
</script>

{#if !devices.loaded}
	<p class="quiet pad">Loading the house…</p>
{:else if room === undefined}
	<p class="quiet pad">This room isn't in the house any more.</p>
{:else}
	<div class="croom">
		<section class="hero" aria-label={room.name}>
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
						{#each model.locks as d (d.device_id)}
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
						{#each model.openings as d (d.device_id)}
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
					</div>
				</div>
				<div class="side">
					{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
					<div class="pair" role="group" aria-label={`${room.name} lights`}>
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
							onclick={() => power(false)}>{busy === 'off' ? 'Turning off…' : 'Room off'}</button
						>
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

		{#if model.tabs.length === 0}
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
				{#each model.tabs as t (t.id)}
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
					<LightsTab tab={model.lights} room={room.name} {fader} {sw} {may} />
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
					/>
				{:else if tab}
					<!-- These tabs get their own consoles next; until then, the room's cards. -->
					<CardGrid devices={model.byTab[tab]} large={['media_player', 'thermostat']} />
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

	/* ---- the header: a dark band now, the room's picture later ---- */
	.hero {
		position: relative;
		min-height: 190px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
		background: #0c0d12;
	}
	.band {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				700px 260px at 78% 0%,
				color-mix(in srgb, var(--accent) 22%, transparent),
				transparent 70%
			),
			radial-gradient(500px 220px at 100% 100%, rgba(127, 184, 255, 0.1), transparent 70%),
			linear-gradient(
				90deg,
				rgba(7, 8, 11, 0.95) 0%,
				rgba(7, 8, 11, 0.55) 45%,
				rgba(7, 8, 11, 0.2) 100%
			),
			linear-gradient(180deg, #161922, #0c0d12);
	}
	:global(:root[data-theme='light']) .hero {
		background: #e9e5dc;
	}
	:global(:root[data-theme='light']) .band {
		background:
			radial-gradient(
				700px 260px at 78% 0%,
				color-mix(in srgb, var(--accent) 28%, transparent),
				transparent 70%
			),
			linear-gradient(180deg, #f3f0ea, #e3ded3);
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
	.panel > :global(.grid) {
		padding: 0 14px 0 18px;
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
