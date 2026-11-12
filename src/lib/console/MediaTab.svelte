<!--
	A room's Media tab in the console (the FamilyRoom and Office boards): its
	screens first, each a row of what it's showing with its power, its apps,
	and a remote; then its speakers (media.ts). Up to three sit side by side,
	each led by its artwork, with what's playing, play and skip, and a small
	volume. From four, they are a mixer: the chosen speaker's artwork and
	what it's playing, then a channel for each, a fader and play or pause,
	whose pill chooses it.

	Everything is sized to the window, so the tab fits above the room's audio
	bar on a laptop's screen without scrolling.

	A remote's volume keys drive the room's audio device, whichever that is,
	as a whole-house remote's do; the page says which.
-->
<script lang="ts">
	import { page } from '$app/state';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import House from '@lucide/svelte/icons/house';
	import Star from '@lucide/svelte/icons/star';
	import History from '@lucide/svelte/icons/history';
	import Rewind from '@lucide/svelte/icons/rewind';
	import FastForward from '@lucide/svelte/icons/fast-forward';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Volume1 from '@lucide/svelte/icons/volume-1';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Speaker from '@lucide/svelte/icons/speaker';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Level from './Level.svelte';
	import Fader from './Fader.svelte';
	import type { FaderStyle } from './style.js';
	import {
		appTiles,
		artistOf,
		asMixer,
		currentApp,
		groupOf,
		hueOf,
		isCurrent,
		isOn,
		launchCmd,
		mixerFit,
		mixerPick,
		muteCmd,
		powerCmd,
		playerName,
		remoteKeys,
		stepCmd,
		transportOf,
		volumeCmd,
		volumeOf,
		type AppTile,
		type KeyId
	} from './media.js';
	import { brandOf } from './room.js';
	import { send } from './send.js';

	let {
		screens,
		speakers,
		room,
		may,
		fader,
		audio,
		audioNote,
		onstep,
		onmute
	}: {
		screens: CoreDevice[];
		speakers: CoreDevice[];
		/** The room's name, left off the front of its players'. */
		room: string;
		may: boolean;
		/** How the mixer's faders are drawn (style.ts). */
		fader: FaderStyle;
		/** The room's audio device, which the remotes' volume keys drive. */
		audio: CoreDevice | undefined;
		/** What the volume keys did last, or which device they drive. */
		audioNote: string;
		onstep: (by: 1 | -1) => void;
		onmute: () => void;
	} = $props();

	const nameOf = (d: CoreDevice) => playerName(d, room);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const on = (d: CoreDevice) => isOn({ ...d, attributes: { ...d.attributes, ...want(d) } });
	const note = (d: CoreDevice) => commands.notes[d.device_id];

	// ---- a screen ----
	/** Two rows of tiles, so the speakers below stay on screen; the rest on asking. */
	const FEW = 8;
	let allApps = $state<Record<string, boolean>>({});
	/** A tile just pressed, until the screen says it's showing it. */
	let opening = $state<Record<string, string>>({});
	async function launch(d: CoreDevice, app: AppTile) {
		opening = { ...opening, [d.device_id]: app.id };
		const sent = await send(d, launchCmd(d, app));
		setTimeout(
			() => {
				if (opening[d.device_id] !== app.id) return;
				const { [d.device_id]: _done, ...rest } = opening;
				opening = rest;
			},
			sent ? 4000 : 0
		);
	}
	function showing(d: CoreDevice): { title: string; sub: string } {
		if (!d.available) return { title: 'Offline', sub: 'It isn’t answering' };
		if (!on(d)) return { title: 'Off', sub: 'Standing by' };
		const app = currentApp(d);
		if (!app) return { title: 'Home', sub: `The ${brandOf(d.plugin_id)} home screen` };
		const playing = transportOf(d, want(d)).playing;
		return { title: app, sub: playing ? 'Playing' : 'Open' };
	}
	const key = (d: CoreDevice, id: KeyId) => remoteKeys(d)[id];
	const press = (d: CoreDevice, id: KeyId) => void send(d, key(d, id)?.cmd);

	// ---- a speaker ----
	interface Now {
		title: string;
		artist?: string;
		art?: string;
		/** Playing, Paused or Offline; nothing when it has nothing on. */
		state?: string;
		idle: boolean;
	}
	function nowOf(d: CoreDevice): Now {
		if (!d.available) return { title: 'Offline', state: 'Offline', idle: true };
		const c = cardFor(d, clock.now);
		if (!c.nowPlaying) return { title: 'Nothing playing', idle: true };
		const playing = transportOf(d, want(d)).playing;
		return {
			title: c.nowPlaying,
			artist: artistOf(d),
			art: c.art,
			state: playing ? 'Playing' : 'Paused',
			idle: false
		};
	}
	const groupWord = (d: CoreDevice) => {
		const g = groupOf(d, devices.byId);
		if (g.length === 0) return undefined;
		return g.length === 1 ? `With ${g[0]}` : `With ${g.slice(0, -1).join(', ')} and ${g.at(-1)}`;
	};
	/** A speaker's own color, for its channel and where it has no artwork. */
	const tint = (d: CoreDevice) => `hsl(${hueOf(d.device_id)} 70% 62%)`;

	// ---- the space they have ----
	let viewH = $state(900);
	/** Below the speakers: the panel's edge and the room's audio bar (slimmer in a short window). */
	const below = $derived(viewH <= 820 ? 110 : 116);
	let spk = $state<HTMLElement>();
	let top = $state(0);
	let secW = $state(0);
	let wide = $state(0);
	$effect(() => {
		void [viewH, wide, secW, allApps, screens.length, speakers.length];
		if (spk) top = spk.getBoundingClientRect().top + window.scrollY;
	});
	/**
	 * The speakers' height, from their top edge to the audio bar. Where the
	 * screens above leave too little, the page scrolls, and they get their usual.
	 */
	const space = $derived.by(() => {
		const left = Math.round(viewH - top - below);
		return left >= 170 ? left : 250;
	});

	// ---- many speakers: the mixer ----
	const mixer = $derived(asMixer(speakers.length));
	/** The speaker each room's mixer shows, as chosen here. */
	let chosen = $state<Record<string, string>>({});
	const shown = $derived(mixer ? mixerPick(speakers, chosen[room], want) : undefined);
	const fit = $derived(mixerFit(speakers.length, secW - 40, space - 16, fader));
</script>

<div class="media">
	{#each screens as d (d.device_id)}
		{@const s = showing(d)}
		{@const tiles = appTiles(d)}
		{@const shown = allApps[d.device_id] ? tiles : tiles.slice(0, FEW)}
		{@const power = powerCmd(d, !on(d))}
		{@const k = remoteKeys(d)}
		<div class="desk" role="group" aria-label={nameOf(d)}>
			<section class="col screen" aria-label={`${nameOf(d)}, what it's showing`}>
				<div class="ch">
					<span class="tag" data-brand={brandOf(d.plugin_id).toLowerCase()}
						>{brandOf(d.plugin_id)}</span
					>
					<button type="button" class="ttl" onclick={() => open(d)}>{nameOf(d)}</button>
					<span class="cn">{d.available ? (on(d) ? 'On' : 'Off') : 'Offline'}</span>
				</div>
				<div class="tube" class:dark={!on(d) || !d.available}>
					<span class="big">{s.title}</span>
					<span class="cn">{s.sub}</span>
				</div>
				<div class="row">
					{#if power}
						<button
							type="button"
							class="btn"
							class:lit={!on(d)}
							disabled={!may || !d.available}
							aria-busy={waiting(d) || undefined}
							onclick={() => send(d, power)}>{on(d) ? 'Turn off' : 'Turn on'}</button
						>
					{/if}
					{#if k.home}
						<button
							type="button"
							class="btn ghost"
							disabled={!may || !d.available}
							onclick={() => press(d, 'home')}>Home screen</button
						>
					{/if}
				</div>
				{#if note(d)}<p class="warn" role="status">{note(d)}</p>{/if}
			</section>

			{#if tiles.length > 0}
				<section class="col apps-col" aria-label={`${nameOf(d)} apps`}>
					<div class="ch">
						<span class="ttl">{tiles.some((t) => t.input) ? 'Apps and inputs' : 'Apps'}</span>
						<span class="cn"
							>{tiles.some((t) => (t.launches ?? 0) > 0) ? 'Most used first' : ''}</span
						>
						{#if tiles.length > FEW}
							<button
								type="button"
								class="btn ghost more"
								aria-expanded={!!allApps[d.device_id]}
								onclick={() => (allApps = { ...allApps, [d.device_id]: !allApps[d.device_id] })}
								>{allApps[d.device_id] ? 'Fewer' : `All ${tiles.length}`}</button
							>
						{/if}
					</div>
					<div class="apps">
						{#each shown as a (a.id)}
							{@const now = isCurrent(d, a)}
							<button
								type="button"
								class="app"
								class:on={now}
								disabled={!may || !d.available || launchCmd(d, a) === undefined}
								aria-busy={opening[d.device_id] === a.id || undefined}
								aria-pressed={now}
								title={`Open ${a.name}`}
								onclick={() => launch(d, a)}
							>
								{#if a.icon}
									<img class="ico" src={a.icon} alt="" loading="lazy" />
								{:else}
									<span class="ico letter" aria-hidden="true">{a.letter}</span>
								{/if}
								<span class="an">{a.name}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#if Object.keys(k).length > 0}
				<section class="col" aria-label={`${nameOf(d)} remote`}>
					<div class="ch"><span class="ttl">Remote</span></div>
					<div class="remote">
						{#if k.up || k.ok}
							<div class="dpad" role="group" aria-label="Arrows">
								{#each [['up', ChevronUp], ['left', ChevronLeft], ['right', ChevronRight], ['down', ChevronDown]] as const as [id, Ico] (id)}
									{#if k[id]}
										<button
											type="button"
											class={`arrow ${id}`}
											aria-label={k[id].label}
											disabled={!may || !d.available}
											onclick={() => press(d, id)}><Ico size={18} strokeWidth={2.4} /></button
										>
									{/if}
								{/each}
								{#if k.ok}
									<button
										type="button"
										class="ok"
										aria-label="OK"
										disabled={!may || !d.available}
										onclick={() => press(d, 'ok')}>OK</button
									>
								{/if}
							</div>
						{/if}
						<div class="keys">
							{#each [['back', Undo2], ['home', House], [k.info ? 'info' : 'replay', k.info ? Star : History], ['rev', Rewind], ['play', Play], ['fwd', FastForward]] as const as [id, Ico] (id)}
								<button
									type="button"
									aria-label={k[id]?.label ?? id}
									disabled={!may || !d.available || !k[id]}
									onclick={() => press(d, id)}><Ico size={16} strokeWidth={2.2} /></button
								>
							{/each}
							<button
								type="button"
								class="vk"
								aria-label="Volume down"
								disabled={!may || !audio}
								onclick={() => onstep(-1)}><Volume1 size={16} strokeWidth={2.2} /></button
							>
							<button
								type="button"
								class="vk"
								aria-label="Mute or unmute"
								disabled={!may || !audio}
								onclick={onmute}><VolumeX size={16} strokeWidth={2.2} /></button
							>
							<button
								type="button"
								class="vk"
								aria-label="Volume up"
								disabled={!may || !audio}
								onclick={() => onstep(1)}><Volume2 size={16} strokeWidth={2.2} /></button
							>
						</div>
					</div>
					<span class="cn">{audioNote}</span>
				</section>
			{/if}
		</div>
	{/each}

	{#if speakers.length > 0}
		<section
			class="speakers"
			class:alone={screens.length === 0}
			class:mixer
			class:short={space < 210}
			aria-label="Speakers"
			bind:this={spk}
			bind:clientWidth={secW}
			style:--across={Math.min(speakers.length, 3)}
			style:--space={`${space - 16}px`}
		>
			{#if mixer && shown}
				<div class="hero" style:width={`${fit.hero}px`} style:--art={`${fit.art}px`}>
					{@render stage(shown, true)}
				</div>
				<div
					class="chans"
					role="group"
					aria-label="Speaker volumes"
					style:--per={fit.perRow}
					style:--pw={fit.tight ? '92px' : '104px'}
				>
					{#each speakers as d (d.device_id)}
						{@const t = transportOf(d, want(d))}
						{@const v = volumeOf(d, want(d))}
						{@const sel = shown.device_id === d.device_id}
						{@const pick = () => (chosen = { ...chosen, [room]: d.device_id })}
						{#snippet label()}
							<span class="pn"
								><i class="led" class:on={t.playing && d.available}></i>{nameOf(d)}</span
							>
							<small class="ps">{nowOf(d).state ?? 'Idle'}</small>
						{/snippet}
						<div class="chan" class:live={t.playing && d.available} style:--tint={tint(d)}>
							<div class="crow">
								{#if t.toggle}
									<button
										type="button"
										class="mini"
										class:on={t.playing}
										aria-label={t.playing ? `Pause ${nameOf(d)}` : `Play ${nameOf(d)}`}
										disabled={!may || !d.available}
										aria-busy={waiting(d) || undefined}
										onclick={() => send(d, t.toggle)}
										>{#if t.playing}<Pause
												fill="currentColor"
												size={13}
												strokeWidth={2.4}
											/>{:else}<Play fill="currentColor" size={13} strokeWidth={2.4} />{/if}</button
									>
								{/if}
								{#if fader !== 'glass' || !v.level}
									<span class="lv"
										>{v.level ? (v.muted ? 'mute' : Math.round(v.level.value)) : ''}</span
									>
								{/if}
							</div>
							{#if v.level}
								<Fader
									label={`${nameOf(d)} volume`}
									value={v.level.value}
									min={v.level.min}
									max={v.level.max}
									unit=""
									zero=""
									figure={false}
									pill={label}
									style={fader}
									height={fit.fader}
									tight={fit.tight}
									color={v.muted ? '#6b7280' : tint(d)}
									selected={sel}
									onpick={pick}
									disabled={!may || !d.available}
									waiting={want(d)?.volume !== undefined}
									oncommit={(x) => send(d, volumeCmd(d, x))}
								/>
							{:else}
								<div class="steps" style:height={`${fit.fader + (fader === 'glass' ? 22 : 0)}px`}>
									<button
										type="button"
										aria-label={`${nameOf(d)} volume up`}
										disabled={!may || !d.available || !v.steps}
										onclick={() => send(d, stepCmd(d, 1, want(d)))}
										><Plus size={16} strokeWidth={2.4} /></button
									>
									<Volume2 size={16} strokeWidth={2} aria-hidden="true" />
									<button
										type="button"
										aria-label={`${nameOf(d)} volume down`}
										disabled={!may || !d.available || !v.steps}
										onclick={() => send(d, stepCmd(d, -1, want(d)))}
										><Minus size={16} strokeWidth={2.4} /></button
									>
								</div>
								<button type="button" class="spill" class:sel aria-pressed={sel} onclick={pick}
									>{@render label()}</button
								>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				{#each speakers as d (d.device_id)}
					{@render stage(d, false)}
				{/each}
			{/if}
		</section>
	{/if}
</div>

<svelte:window bind:innerHeight={viewH} bind:innerWidth={wide} />

<!-- A speaker as a stage: its artwork first, what's playing large, then play and skip and a small volume. -->
{#snippet stage(d: CoreDevice, hero: boolean)}
	{@const n = nowOf(d)}
	{@const t = transportOf(d, want(d))}
	{@const v = volumeOf(d, want(d))}
	{@const g = groupWord(d)}
	{@const mute = muteCmd(d, want(d))}
	<div
		class="stage"
		class:hero
		class:idle={n.idle}
		class:live={t.playing && d.available}
		style:--hue={hueOf(d.device_id)}
		role="group"
		aria-label={nameOf(d)}
	>
		<div class="aura" aria-hidden="true">
			{#if n.art}<img src={n.art} alt="" />{/if}
		</div>
		{#if n.art}
			<img class="cover" src={n.art} alt="" />
		{:else}
			<span class="cover none" aria-hidden="true"
				><Speaker size={hero ? 46 : 34} strokeWidth={1.5} /></span
			>
		{/if}
		<div class="info">
			<div class="eyebrow">
				<span class="tag" data-brand={brandOf(d.plugin_id).toLowerCase()}
					>{brandOf(d.plugin_id)}</span
				>
				<button type="button" class="who" onclick={() => open(d)}>{nameOf(d)}</button>
				{#if n.state}<span class="st" class:on={t.playing}>{n.state}</span>{/if}
			</div>
			<p class="now" title={n.title}>{n.title}</p>
			{#if n.artist}<p class="by">{n.artist}</p>{/if}
			{#if g}<p class="with">{g}</p>{/if}
			{#if note(d)}<p class="warn" role="status">{note(d)}</p>{/if}
			<div class="deck">
				<div class="tp">
					{#if t.previous}
						<button
							type="button"
							class="rb"
							aria-label={`Previous on ${nameOf(d)}`}
							disabled={!may || !d.available}
							onclick={() => send(d, t.previous)}><SkipBack size={15} strokeWidth={2.2} /></button
						>
					{/if}
					{#if t.toggle}
						<button
							type="button"
							class="rb big"
							aria-label={t.playing ? `Pause ${nameOf(d)}` : `Play ${nameOf(d)}`}
							disabled={!may || !d.available}
							aria-busy={waiting(d) || undefined}
							onclick={() => send(d, t.toggle)}
							>{#if t.playing}<Pause fill="currentColor" size={17} strokeWidth={2.4} />{:else}<Play
									fill="currentColor"
									size={17}
									strokeWidth={2.4}
								/>{/if}</button
						>
					{/if}
					{#if t.next}
						<button
							type="button"
							class="rb"
							aria-label={`Next on ${nameOf(d)}`}
							disabled={!may || !d.available}
							onclick={() => send(d, t.next)}><SkipForward size={15} strokeWidth={2.2} /></button
						>
					{/if}
				</div>
				<div class="vol">
					{#if mute}
						<button
							type="button"
							class="rb sm"
							class:on={v.muted}
							aria-label={v.muted ? `Unmute ${nameOf(d)}` : `Mute ${nameOf(d)}`}
							aria-pressed={v.muted === true}
							disabled={!may || !d.available}
							onclick={() => send(d, mute)}
							>{#if v.muted}<VolumeX size={14} strokeWidth={2.2} />{:else}<Volume1
									size={14}
									strokeWidth={2.2}
								/>{/if}</button
						>
					{/if}
					{#if v.level && !hero}
						<Level
							label={`${nameOf(d)} volume`}
							value={v.level.value}
							min={v.level.min}
							max={v.level.max}
							muted={v.muted === true}
							disabled={!may || !d.available}
							waiting={want(d)?.volume !== undefined}
							oncommit={(x) => send(d, volumeCmd(d, x))}
						/>
						<span class="num">{v.muted ? 'mute' : Math.round(v.level.value)}</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/snippet}

<style>
	.media {
		container: media / inline-size;
		display: flex;
		flex-direction: column;
		gap: 18px;
		/* The remote: its ring, and its keys. */
		--d: 170px;
		--key: 44px;
		--ico: 58px;
	}
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
	}
	.desk + .desk {
		padding-top: 18px;
		border-top: 1px solid var(--con-edge-strong);
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 20px;
		border-left: 1px solid var(--con-edge-strong);
		flex: none;
		min-width: 0;
	}
	.col:first-child {
		border-left: 0;
	}
	.screen {
		width: 300px;
	}
	.apps-col {
		width: 330px;
	}
	.ch {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		font-size: 12.5px;
		font-weight: 700;
	}
	.ttl {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	button.ttl {
		cursor: pointer;
	}
	button.ttl:hover {
		text-decoration: underline;
	}
	.cn {
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.warn {
		margin: 0;
		font-size: 11.5px;
		color: var(--alert);
	}
	.tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 7px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
	}
	.tag[data-brand='roku'] {
		background: rgba(160, 123, 255, 0.2);
		color: #d3c4ff;
	}
	:global(:root[data-theme='light']) .tag[data-brand='roku'] {
		color: #5a3aa8;
	}
	.tag[data-brand='sonos'] {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}

	/* ---- a screen ---- */
	.tube {
		height: 150px;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 14px;
		text-align: center;
		color: #fff;
		background: radial-gradient(circle at 50% 120%, #3a1b6b, #0c0d14 70%);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.08),
			0 18px 40px -20px rgba(123, 60, 255, 0.6);
	}
	.tube .cn {
		color: rgba(233, 236, 242, 0.6);
	}
	.tube.dark {
		background: #0c0d12;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.tube.dark .big {
		color: rgba(233, 236, 242, 0.55);
	}
	.big {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 9px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}
	.btn.lit {
		background: linear-gradient(140deg, #ffc46b, #ff8a5b);
		color: #1d1006;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.btn[aria-busy='true'] {
		opacity: 0.6;
	}
	.more {
		margin-left: auto;
		height: 28px;
	}

	/* ---- its apps ---- */
	.apps {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px 8px;
	}
	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 0;
		padding: 6px 2px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: color-mix(in srgb, var(--ink) 88%, transparent);
		cursor: pointer;
	}
	.app:disabled {
		cursor: default;
	}
	.ico {
		width: var(--ico);
		height: var(--ico);
		border-radius: 15px;
		object-fit: cover;
		background: #1b1e26;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.18),
			0 8px 16px -8px rgba(0, 0, 0, 0.9);
		transition: transform 0.15s;
	}
	.letter {
		display: grid;
		place-items: center;
		font-size: 22px;
		font-weight: 800;
		color: #fff;
		background: linear-gradient(160deg, #2a2e38, #1b1e26);
	}
	.app:hover:not(:disabled) .ico {
		transform: translateY(-2px);
	}
	.an {
		max-width: 72px;
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.app.on {
		background: rgba(160, 123, 255, 0.16);
	}
	.app.on .ico {
		box-shadow:
			0 0 0 2px #fff,
			0 0 18px rgba(160, 123, 255, 0.6);
	}
	.app[aria-busy='true'] .ico {
		opacity: 0.6;
	}

	/* ---- its remote ---- */
	.remote {
		display: flex;
		gap: 20px;
		align-items: center;
	}
	.dpad {
		position: relative;
		width: var(--d);
		height: var(--d);
		flex: none;
		border-radius: 50%;
		background: radial-gradient(
			circle at 50% 35%,
			color-mix(in srgb, var(--ink) 10%, transparent),
			color-mix(in srgb, var(--ink) 3%, transparent)
		);
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--ink) 10%, transparent),
			0 14px 30px -14px rgba(0, 0, 0, 0.9);
	}
	.arrow {
		position: absolute;
		width: 46px;
		height: 46px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}
	.arrow:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.arrow.up {
		left: calc(50% - 23px);
		top: 4px;
	}
	.arrow.down {
		left: calc(50% - 23px);
		bottom: 4px;
	}
	.arrow.left {
		left: 4px;
		top: calc(50% - 23px);
	}
	.arrow.right {
		right: 4px;
		top: calc(50% - 23px);
	}
	.ok {
		position: absolute;
		left: calc(50% - var(--d) * 0.205);
		top: calc(50% - var(--d) * 0.205);
		width: calc(var(--d) * 0.41);
		height: calc(var(--d) * 0.41);
		border: 0;
		border-radius: 50%;
		background: linear-gradient(180deg, #f4f5f7, #c9ccd3);
		color: #14161c;
		font-size: 14px;
		font-weight: 800;
		cursor: pointer;
		box-shadow:
			0 6px 14px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 #fff;
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(3, var(--key));
		gap: 8px;
	}
	.keys button {
		width: var(--key);
		height: var(--key);
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 12px;
		background: linear-gradient(180deg, #22252d, #16181e);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.09),
			0 6px 12px -8px rgba(0, 0, 0, 0.9);
		color: #d9dde5;
		cursor: pointer;
	}
	.keys button:active:not(:disabled) {
		transform: translateY(1px);
	}
	.keys .vk {
		color: #ffd9a0;
	}
	.dpad button:disabled,
	.keys button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	/* ---- speakers ---- */
	/* Up to three side by side, each a stage led by its artwork. */
	.speakers {
		display: grid;
		grid-template-columns: repeat(var(--across), minmax(0, 1fr));
		gap: 14px;
		padding: 16px 20px 0;
		border-top: 1px solid var(--con-edge-strong);
		/* The artwork: as tall as the space allows, between 96 and 176. */
		--art: clamp(96px, calc(var(--space) - 28px), 176px);
	}
	.speakers.alone {
		padding-top: 0;
		border-top: 0;
	}
	.stage {
		position: relative;
		isolation: isolate;
		container: stage / inline-size;
		display: flex;
		align-items: stretch;
		gap: 16px;
		min-width: 0;
		max-width: 680px;
		max-height: var(--space);
		padding: 14px;
		border-radius: 20px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.07),
			inset 0 0 0 1px color-mix(in srgb, var(--ink) 6%, transparent);
	}
	/* The glow behind: the artwork itself, blurred; else the speaker's own color. */
	.aura {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 75% 55% / 0.28), transparent 60%),
			radial-gradient(
				90% 120% at 100% 100%,
				hsl(calc(var(--hue) + 60) 70% 45% / 0.16),
				transparent 70%
			);
	}
	.aura img {
		position: absolute;
		inset: -40%;
		width: 180%;
		height: 180%;
		object-fit: cover;
		filter: blur(48px) saturate(1.6);
		opacity: 0.55;
	}
	.idle .aura {
		opacity: 0.6;
	}
	.cover {
		flex: none;
		/* No more than 40% of a narrow card. */
		width: min(var(--art), 40cqi);
		aspect-ratio: 1;
		align-self: center;
		border-radius: 14px;
		object-fit: cover;
		box-shadow:
			0 18px 34px -16px rgba(0, 0, 0, 0.9),
			0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.cover.none {
		display: grid;
		place-items: center;
		color: rgba(255, 255, 255, 0.82);
		background:
			radial-gradient(circle at 28% 22%, hsl(var(--hue) 85% 70% / 0.85), transparent 58%),
			radial-gradient(circle at 80% 90%, hsl(calc(var(--hue) + 70) 80% 55% / 0.6), transparent 60%),
			linear-gradient(150deg, hsl(var(--hue) 55% 32%), hsl(calc(var(--hue) + 40) 60% 13%));
	}
	.idle .cover.none {
		filter: saturate(0.7);
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.eyebrow {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 700;
	}
	.who {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		border: 0;
		padding: 0;
		background: none;
		color: color-mix(in srgb, var(--ink) 80%, transparent);
		font: inherit;
		cursor: pointer;
	}
	.who:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.st {
		flex: none;
		padding: 2px 7px;
		border-radius: 999px;
		font-size: 10.5px;
		font-weight: 700;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink-muted);
	}
	.st.on {
		background: color-mix(in srgb, var(--good, #4fe0a0) 20%, transparent);
		color: color-mix(in srgb, var(--good, #4fe0a0) 75%, var(--ink));
	}
	.now {
		margin: 6px 0 0;
		font-size: 22px;
		font-weight: 800;
		line-height: 1.12;
		letter-spacing: -0.01em;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.idle .now {
		color: color-mix(in srgb, var(--ink) 62%, transparent);
	}
	.by,
	.with {
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 13px;
		font-weight: 600;
		color: color-mix(in srgb, var(--ink) 78%, transparent);
	}
	.with {
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.deck {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px 14px;
		margin-top: auto;
		padding-top: 8px;
	}
	.tp {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.vol {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1 1 120px;
		max-width: 190px;
		color: var(--ink-muted);
	}
	.num {
		width: 30px;
		flex: none;
		text-align: right;
		font: 500 12px var(--font-num);
		color: var(--ink);
	}
	.rb {
		width: 38px;
		height: 38px;
		flex: none;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.rb:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 16%, transparent);
	}
	.rb.big {
		width: 46px;
		height: 46px;
		background: var(--ink);
		color: var(--bg, #0b0d12);
		box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.8);
	}
	.rb.big:hover:not(:disabled) {
		background: var(--ink);
		transform: scale(1.04);
	}
	.rb.sm {
		width: 36px;
		height: 36px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: color-mix(in srgb, var(--ink) 80%, transparent);
	}
	.rb.sm.on {
		color: var(--alert);
	}
	.rb:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.rb[aria-busy='true'] {
		opacity: 0.6;
	}
	/* A narrow card keeps its buttons and drops the volume's number. */
	/* A short space keeps the artwork and the buttons, and lets the group line go. */
	.speakers.short .stage {
		padding: 12px;
	}
	.speakers.short .now {
		margin-top: 4px;
		font-size: 19px;
	}
	.speakers.short.mixer .now {
		font-size: 23px;
	}
	.speakers.short .with {
		display: none;
	}
	.speakers.short .deck {
		padding-top: 4px;
	}
	.speakers.short .rb.big {
		width: 42px;
		height: 42px;
	}
	@container stage (max-width: 340px) {
		.num {
			display: none;
		}
		.now {
			font-size: 18px;
		}
	}

	/* ---- the mixer: the chosen speaker's stage, then a channel each ---- */
	.speakers.mixer {
		display: flex;
		align-items: stretch;
		gap: 22px;
	}
	/* Its width and its artwork's are mixerFit's (media.ts). */
	.hero {
		flex: none;
		display: flex;
		min-width: 0;
	}
	.hero .stage {
		flex: 1;
		max-width: none;
		padding: 14px;
		gap: 20px;
	}
	.hero .cover {
		width: var(--art);
	}
	.hero .now {
		font-size: 28px;
		margin-top: 10px;
	}
	.hero .by {
		font-size: 15px;
	}
	.hero .vol {
		flex: none;
	}
	.chans {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(var(--per), var(--pw));
		justify-content: start;
		align-content: center;
		gap: 14px 12px;
	}
	.chan {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	/* A channel that's playing glows a little in its color. */
	.chan::before {
		content: '';
		position: absolute;
		inset: 0 -4px;
		z-index: -1;
		border-radius: 18px;
		opacity: 0;
		background: radial-gradient(
			60% 55% at 50% 45%,
			color-mix(in srgb, var(--tint) 22%, transparent),
			transparent 75%
		);
		transition: opacity 0.3s;
	}
	.chan.live::before {
		opacity: 1;
	}
	.crow {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 28px;
	}
	.mini {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.mini.on {
		background: var(--ink);
		color: var(--bg, #0b0d12);
	}
	.mini:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.mini[aria-busy='true'] {
		opacity: 0.6;
	}
	.lv {
		min-width: 22px;
		font: 600 14px var(--font-num);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	/* The pill's words: the name with its light, and what it's doing. */
	.pn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ps {
		font-size: 10px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.led {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 25%, transparent);
	}
	.led.on {
		background: var(--good, #4fe0a0);
		box-shadow: 0 0 8px var(--good, #4fe0a0);
	}
	/* Without a level: steps, and a pill like the faders'. */
	.steps {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 58px;
		border-radius: 18px;
		color: var(--ink-muted);
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.steps button {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.steps button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.spill {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		width: var(--pw);
		height: 42px;
		padding: 4px 8px;
		border: 0;
		border-radius: 12px;
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 600 11.5px var(--font);
		line-height: 1.15;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--ink) 9%, transparent),
			color-mix(in srgb, var(--ink) 4%, transparent)
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 2px 6px -2px rgba(0, 0, 0, 0.6);
		cursor: pointer;
	}
	.spill.sel {
		color: var(--ink);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--cool) 34%, transparent),
			color-mix(in srgb, var(--cool) 18%, transparent)
		);
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--cool) 70%, transparent),
			0 0 14px color-mix(in srgb, var(--cool) 35%, transparent);
	}

	/* A narrower window: narrower columns, so the screen, its apps and its remote stay in a row. */
	@container media (max-width: 1100px) {
		.col {
			padding: 0 16px;
		}
		.screen {
			width: 250px;
		}
		.apps-col {
			width: 290px;
		}
		.desk {
			--d: 150px;
			--key: 40px;
			--ico: 52px;
		}
		.remote {
			gap: 14px;
		}
	}
	/* A shorter window: a smaller screen and remote, so the speakers keep their room. */
	@media (max-height: 820px) {
		.media {
			gap: 12px;
		}
		.desk {
			--d: 128px;
			--key: 36px;
			--ico: 44px;
		}
		.col {
			gap: 9px;
		}
		.tube {
			height: 96px;
		}
		.big {
			font-size: 22px;
		}
		.apps {
			gap: 6px 6px;
		}
		.app {
			gap: 4px;
			padding: 4px 2px;
		}
		.speakers {
			padding-top: 12px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ico {
			transition: none;
		}
	}
</style>
