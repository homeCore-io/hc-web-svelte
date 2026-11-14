<!--
	A room on the phone (the PhonePlan board), from the console's room
	(roomNow.svelte.ts): its drawing or photo lit by its lights, with its
	name and the header's pills, a way back to the rooms and a "⋯"; Room on
	and Room off; its favorites; its tabs as chips that scroll across, in
	the order, with the ones shown and the one it opens on, that Customize
	keeps (layout.ts); the tab, laid out for one hand; and the room's audio
	pinned along the bottom, opening the rest of it in a sheet.

	Customize needs a larger screen: under the "⋯", and at `?customize`, it
	says so.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Monitor from '@lucide/svelte/icons/monitor';
	import { devices } from '#lib/devices.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { isOpen } from '#lib/card.js';
	import Icon from '#lib/components/Icon.svelte';
	import MediaTab from '../MediaTab.svelte';
	import ClimateTab from '../ClimateTab.svelte';
	import DoorsTab from '../DoorsTab.svelte';
	import WaterTab from '../WaterTab.svelte';
	import SensorsTab from '../SensorsTab.svelte';
	import SwitchesTab from '../SwitchesTab.svelte';
	import SwitchSet from '../SwitchSet.svelte';
	import { setsWithSwitches } from '../switches.js';
	import AudioBar from '../AudioBar.svelte';
	import RoomPicture from '../RoomPicture.svelte';
	import RoomPhoto from '../RoomPhoto.svelte';
	import Placer from '../Placer.svelte';
	import { Placer as Placing, providePlacer } from '../placer.svelte.js';
	import { camEvents } from '../camEvents.svelte.js';
	import { pillWord } from '../cameras.js';
	import { isPlayer } from '../media.js';
	import { RoomNow } from '../roomNow.svelte.js';
	import { STACKED_WIDTH, type TabId } from '../room.js';
	import { tabToShow } from '../layout.js';
	import PhoneLights from './PhoneLights.svelte';
	import Sheet from './Sheet.svelte';
	import CamPhone from './CamPhone.svelte';
	import { provideStacked } from './phone.svelte.js';
	import { nextTab } from '#lib/menuKeys.js';
	import { household } from '#lib/household.svelte.js';
	import { apart } from '../apart.js';
	import type { CoreDevice } from '#lib/devices.js';

	let { id }: { id: string } = $props();

	// The room's tabs as a phone's: Lights in one column, as long as it needs.
	const r = new RoomNow(
		() => id,
		() => STACKED_WIDTH
	);
	const tab = $derived(tabToShow(r.arranged, page.url.searchParams.get('tab')));
	// The tabs' columns, one under another.
	provideStacked();
	const customizing = $derived(page.url.searchParams.has('customize'));

	// Each device's "⋯": where it shows, for the household (Placer). Inside a
	// sheet, the sheet draws it; elsewhere, the room.
	const placing = providePlacer(new Placing(r.width));
	$effect(() => {
		void id;
		return () => placing.close();
	});
	const placedOut = $derived(!!placing.open && !placing.open.from.closest('dialog'));

	$effect(() => camEvents.follow(r.roomCams));
	// On the Cameras tab, a switch or timer the household put there, as with the switches.
	const camSwitches = $derived.by(() => {
		const owned = new Set(
			r.roomCams.flatMap((c) => [c.id, c.spotlight?.device_id, c.siren?.device_id])
		);
		return r.model.byTab.cameras.filter((d) => !owned.has(d.device_id) && setsWithSwitches(d));
	});
	function showEvent(key: string) {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', 'cameras');
		url.searchParams.set('event', key);
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}

	// ---- the tabs, as chips ----
	function choose(t: TabId) {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', t);
		url.searchParams.delete('event');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
	let tabBox = $state<HTMLElement>();
	// Two pills with one name ("Test Door: Closed" twice) say which is which.
	const pillApart = $derived(apart([...r.locks, ...r.openings], (d) => r.short(r.nameOf(d))));
	const pillName = (d: CoreDevice) =>
		r.short(r.nameOf(d)) + (pillApart.has(d.device_id) ? ` (${pillApart.get(d.device_id)})` : '');

	function keys(e: KeyboardEvent) {
		const shown = r.arranged.shown;
		const i = shown.findIndex((t) => t.id === tab);
		const to = nextTab(e.key, i, shown.length);
		if (to === null) return;
		e.preventDefault();
		const next = shown[to]!;
		choose(next.id);
		queueMicrotask(() => tabBox?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus());
	}
	// The chip shown is kept in view as the tabs scroll across.
	$effect(() => {
		void tab;
		tabBox
			?.querySelector<HTMLElement>('[aria-selected="true"]')
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});

	// ---- the "⋯", and the audio's sheet ----
	let more = $state(false);
	let audioOpen = $state(false);
	// Another room, from the "⋯": its sheets start closed.
	$effect(() => {
		void id;
		more = false;
		audioOpen = false;
	});
	const hasAudio = $derived(r.model.byTab.media.length > 0);
</script>

{#if !devices.loaded || !household.loaded}
	<p class="quiet pad">Loading the house…</p>
{:else if r.room === undefined}
	<p class="quiet pad">This room isn't in the house any more.</p>
{:else}
	{@const room = r.room}
	<div class="proom" class:docked={hasAudio}>
		<section class="hero" aria-label={room.name}>
			{#if r.photo}<RoomPhoto
					src={r.photo.src}
					focus={r.photo.focus}
					glow={r.glow}
				/>{:else if r.lay.picture !== 'plain'}<RoomPicture
					picture={r.lit.picture}
					g={r.lit.g}
				/>{/if}
			<div class="fade" aria-hidden="true"></div>
			<a class="round back" href="/rooms" aria-label="Rooms"
				><ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" /></a
			>
			<button
				type="button"
				class="round more"
				aria-label={`More for ${room.name}`}
				aria-haspopup="dialog"
				onclick={() => (more = true)}
				><Ellipsis size={20} strokeWidth={2.4} aria-hidden="true" /></button
			>
			<div class="hc">
				<h1>{room.name}</h1>
				<div class="hp">
					{#if r.temperature}<span class="chip">{r.temperature}</span>{/if}
					{#if r.lightsWord}<span class="chip">{r.lightsWord}</span>{/if}
					{#if r.playing > 0}<span class="chip"
							>{r.playing === 1 ? '1 playing' : `${r.playing} playing`}</span
						>{/if}
					{#each r.locks as d (d.device_id)}
						{@const c = r.card(d)}
						{@const locked =
							c.control?.kind === 'lock' ? c.control.locked : c.stateLine.startsWith('Locked')}
						<button
							type="button"
							class="pill"
							class:ok={d.available && locked}
							class:bad={!d.available || !locked}
							aria-busy={commands.pending[d.device_id] ? true : undefined}
							aria-label={!d.available
								? `${r.nameOf(d)} is offline`
								: locked
									? `${r.nameOf(d)} is locked. Unlock it`
									: `${r.nameOf(d)} is unlocked. Lock it`}
							onclick={() => r.lockPill(d)}
						>
							{#if locked}<LockIcon
									size={13}
									strokeWidth={2.2}
									aria-hidden="true"
								/>{:else}<LockOpen size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
							{pillName(d)}: {d.available ? (locked ? 'Locked' : 'Unlocked') : 'Offline'}
						</button>
					{/each}
					{#each r.openings as d (d.device_id)}
						{@const open = isOpen(r.card(d))}
						<button
							type="button"
							class="pill"
							class:ok={d.available && !open}
							class:bad={!d.available || open}
							title={r.openingHint(d)}
							aria-label={`${pillName(d)}: ${d.available ? (open ? 'Open' : 'Closed') : 'Offline'}. ${r.openingHint(d)}`}
							onclick={() => r.openingPill(d, choose)}
						>
							{#if open}<DoorOpen
									size={13}
									strokeWidth={2.2}
									aria-hidden="true"
								/>{:else}<DoorClosed size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
							{pillName(d)}: {d.available ? (open ? 'Open' : 'Closed') : 'Offline'}
						</button>
					{/each}
					{#each r.camPills as e (e.key)}
						<button
							type="button"
							class="pill cam"
							class:old={clock.now - e.at > 10 * 60_000}
							onclick={() => showEvent(e.key)}
							><i aria-hidden="true"></i>{pillWord(e, clock.now, r.camName(e.cam))}</button
						>
					{/each}
				</div>
			</div>
		</section>

		{#if customizing}
			<div class="big-note" role="note">
				<Monitor size={28} strokeWidth={1.8} aria-hidden="true" />
				<p>
					<b>Customize on a larger screen.</b> Arranging {room.name}'s favorites, tabs, lights,
					picture and pills needs a screen at least 700 wide.
				</p>
				<a href={`/rooms/${room.id}`}>Back to {room.name}</a>
			</div>
		{:else}
			{#if r.trouble}<p class="trouble" role="alert">{r.trouble}</p>{/if}
			<!-- Only where they would reach a light: not over cameras' spotlights alone. -->
			{#if r.hasPower}<div class="pair" role="group" aria-label={`${room.name} lights`}>
					<button
						type="button"
						disabled={!r.may || r.busy !== null}
						aria-busy={r.busy === 'on' || undefined}
						onclick={() => r.power(true)}>{r.busy === 'on' ? 'Turning on…' : 'Room on'}</button
					>
					<button
						type="button"
						disabled={!r.may || r.busy !== null}
						aria-busy={r.busy === 'off' || undefined}
						onclick={() => r.power(false)}>{r.busy === 'off' ? 'Turning off…' : 'Room off'}</button
					>
				</div>{/if}

			{#if r.favs.length > 0}
				<div class="favs" role="group" aria-label={`${room.name} favorites`}>
					{#each r.favs as d (d.device_id)}
						{@const c = r.card(d)}
						<button
							type="button"
							class="fav"
							class:on={c.tone === 'on'}
							onclick={() => r.useFav(d)}
						>
							<span class="fi"><Icon name={c.icon} size={16} /></span>
							<span class="ft">{c.name}<small>{c.stateLine || 'Scene'}</small></span>
						</button>
					{/each}
				</div>
			{/if}

			{#if household.missing}
				<p class="quiet pad" role="status">
					Couldn’t load the household’s layout, so these tabs may not be as it arranged them. Trying
					again.
				</p>
			{/if}
			{#if r.arranged.shown.length === 0}
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
					{#each r.arranged.shown as t (t.id)}
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
							onclick={() => choose(t.id)}>{t.name}<small>{t.count}</small></button
						>
					{/each}
				</div>
				<div class="panel" id="room-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
					{#if tab === 'lights'}
						<PhoneLights
							tab={r.model.lights}
							order={r.lay.columns}
							room={room.name}
							fader={r.fader}
							sw={r.sw}
							may={r.may}
						/>
					{:else if tab === 'media'}
						<MediaTab
							screens={r.players.screens}
							speakers={r.players.speakers}
							room={room.name}
							may={r.may}
							fader={r.fader}
							audio={r.audio}
							audioNote={r.audioNote}
							onstep={r.volStep}
							onmute={r.volMute}
							extras={r.model.byTab.media.filter((d) => !isPlayer(d))}
						/>
					{:else if tab === 'climate'}
						<ClimateTab
							list={r.model.byTab.climate}
							room={room.name}
							fader={r.fader}
							sw={r.sw}
							may={r.may}
						/>
					{:else if tab === 'doors'}
						<DoorsTab list={r.model.byTab.doors} room={room.name} may={r.may} />
					{:else if tab === 'water'}
						<WaterTab list={r.model.byTab.water} room={room.name} may={r.may} />
					{:else if tab === 'sensors'}
						<SensorsTab list={r.model.byTab.sensors} all={r.list} room={room.name} />
					{:else if tab === 'switches'}
						<SwitchesTab list={r.model.byTab.switches} room={room.name} may={r.may} />
					{:else if tab === 'timers'}
						<SwitchesTab list={r.model.byTab.timers} room={room.name} may={r.may} />
					{:else if tab === 'cameras'}
						<CamPhone list={r.model.byTab.cameras} />
						{#if camSwitches.length > 0}<div class="also">
								<SwitchSet list={camSwitches} room={room.name} may={r.may} look="rows" />
							</div>{/if}
					{/if}
				</div>
			{/if}

			{#if hasAudio}
				<AudioBar
					as="compact"
					room={room.name}
					audio={r.audio}
					choice={r.audio?.device_id ?? ''}
					choices={r.choices}
					may={r.may}
					stepNote={r.stepNote}
					onchoose={r.playThrough}
					onstep={r.volStep}
					onmute={r.volMute}
					onlevel={r.volLevel}
					onopen={() => (audioOpen = true)}
				/>
			{/if}
		{/if}
	</div>

	{#if placedOut}<Placer p={placing} />{/if}

	{#if more}
		<Sheet label={room.name} onclose={() => (more = false)}>
			<div class="menu">
				<div class="row note">
					<Monitor size={20} strokeWidth={1.8} aria-hidden="true" />
					<span
						><b>Customize</b><small
							>Arranging the room's favorites, tabs, lights, picture and pills needs a larger
							screen, at least 700 wide.</small
						></span
					>
				</div>
				{#if r.prev}<a class="row" href={`/rooms/${r.prev.id}`}
						><span><b>Previous room</b><small>{r.prev.name}</small></span></a
					>{/if}
				{#if r.next}<a class="row" href={`/rooms/${r.next.id}`}
						><span><b>Next room</b><small>{r.next.name}</small></span></a
					>{/if}
			</div>
		</Sheet>
	{/if}
	{#if audioOpen && hasAudio}
		<Sheet label={`${room.name} audio`} onclose={() => (audioOpen = false)}>
			<AudioBar
				as="sheet"
				room={room.name}
				audio={r.audio}
				choice={r.audio?.device_id ?? ''}
				choices={r.choices}
				may={r.may}
				stepNote={r.stepNote}
				onchoose={r.playThrough}
				onstep={r.volStep}
				onmute={r.volMute}
				onlevel={r.volLevel}
			/>
		</Sheet>
	{/if}
{/if}

<style>
	.proom {
		--con-edge-strong: color-mix(in srgb, var(--ink) 9%, transparent);
		display: flex;
		flex-direction: column;
		padding-bottom: 20px;
	}
	.proom.docked {
		padding-bottom: 88px;
	}
	.pad {
		padding: 16px;
	}
	.quiet {
		color: var(--ink-muted);
	}

	/* ---- the hero: the room's picture, darkened where the words go ---- */
	.hero {
		position: relative;
		height: 210px;
		overflow: hidden;
		background: #0c0d12;
		color: #e9ecf2;
	}
	.fade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			0deg,
			var(--bg) 0%,
			rgba(11, 12, 17, 0.2) 55%,
			rgba(11, 12, 17, 0.5) 100%
		);
	}
	:global(:root[data-theme='light']) .hero {
		color: var(--ink);
	}
	.round {
		position: absolute;
		top: 8px;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(10, 12, 16, 0.55);
		backdrop-filter: blur(10px);
		color: #fff;
	}
	.back {
		left: 12px;
	}
	.more {
		right: 12px;
	}
	.hc {
		position: absolute;
		left: 16px;
		right: 16px;
		bottom: 3px;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}
	/* The pills' rows are a finger high, though the pills look slimmer. */
	.hp {
		display: flex;
		gap: 6px;
		margin-top: 1px;
		padding: 7px 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.hp::-webkit-scrollbar {
		display: none;
	}
	.chip,
	.pill {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 11px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		backdrop-filter: blur(10px);
		font: 600 12px var(--font);
		color: inherit;
		white-space: nowrap;
	}
	.pill {
		position: relative;
	}
	.pill::after {
		content: '';
		position: absolute;
		inset: -7px 0;
	}
	.pill.ok {
		background: color-mix(in srgb, var(--good, #4fe0a0) 18%, transparent);
		color: var(--good-ink, color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink)));
	}
	.pill.bad {
		background: color-mix(in srgb, var(--alert) 22%, transparent);
		color: color-mix(in srgb, var(--alert) 65%, var(--ink));
	}
	.pill.cam {
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
	}
	.pill.cam i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.pill.cam.old i {
		opacity: 0.5;
		box-shadow: none;
	}

	/* ---- Room on, Room off; favorites ---- */
	.trouble {
		margin: 10px 16px 0;
		color: var(--alert);
		font-size: 13px;
	}
	.pair {
		display: flex;
		gap: 8px;
		padding: 12px 16px 0;
	}
	.pair button {
		flex: 1;
		height: 46px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
		font: 700 14px var(--font);
	}
	.pair button:disabled {
		opacity: 0.5;
	}
	.favs {
		display: flex;
		gap: 8px;
		padding: 12px 16px 0;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.favs::-webkit-scrollbar {
		display: none;
	}
	.fav {
		flex: none;
		max-width: 180px;
		min-height: 52px;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 0 12px 0 9px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--ink);
		font: 600 13px var(--font);
		text-align: left;
	}
	.fav.on {
		background: rgba(255, 196, 107, 0.12);
	}
	.fi {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.ft {
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.ft small {
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---- the tabs, as chips across ---- */
	.subs {
		display: flex;
		gap: 6px;
		padding: 14px 16px 2px;
		overflow-x: auto;
		scrollbar-width: none;
		scroll-padding: 0 16px;
	}
	.subs::-webkit-scrollbar {
		display: none;
	}
	.sub {
		flex: none;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: color-mix(in srgb, var(--ink) 80%, transparent);
		font: 600 13.5px var(--font);
		white-space: nowrap;
	}
	.sub small {
		font: 500 11px var(--font-num);
		opacity: 0.6;
	}
	.sub.on {
		background: var(--ink);
		color: var(--bg);
	}
	.panel {
		min-width: 0;
		padding: 16px 16px 0;
	}

	.also {
		margin-top: 18px;
	}

	/* ---- Customize, on a larger screen ---- */
	.big-note {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		margin: 16px;
		padding: 18px;
		border-radius: 18px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.big-note p {
		margin: 0;
		font-size: 14px;
		line-height: 1.45;
	}
	.big-note a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--accent);
		font-weight: 600;
	}

	/* ---- the "⋯" ---- */
	.menu {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0 -8px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 8px;
		border-radius: 12px;
		color: var(--ink);
		text-decoration: none;
		font-size: 14px;
	}
	.row span {
		display: flex;
		flex-direction: column;
	}
	.row small {
		color: var(--ink-muted);
		font-size: 12px;
		line-height: 1.35;
	}
	.row.note {
		align-items: flex-start;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.row.note :global(svg) {
		flex: none;
		margin-top: 2px;
		color: var(--ink-muted);
	}
</style>
