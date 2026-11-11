<!--
	A room's Media tab in the console (the FamilyRoom and Office boards): its
	screens first, each a row of what it's showing with its power, its apps,
	and a remote; then its speakers, each with what's playing, play and skip,
	and a volume (media.ts).

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
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Level from './Level.svelte';
	import {
		appTiles,
		artistOf,
		currentApp,
		groupOf,
		isCurrent,
		isOn,
		launchCmd,
		powerCmd,
		playerName,
		remoteKeys,
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
	function playing(d: CoreDevice): { line: string; art?: string } {
		const c = cardFor(d, clock.now);
		if (!d.available) return { line: 'Offline' };
		const title = c.nowPlaying;
		if (!title) return { line: 'Nothing playing' };
		const state = transportOf(d, want(d)).playing ? 'playing' : 'paused';
		return { line: [title, artistOf(d), state].filter(Boolean).join(' · '), art: c.art };
	}
	const groupWord = (d: CoreDevice) => {
		const g = groupOf(d, devices.byId);
		if (g.length === 0) return undefined;
		return g.length === 1 ? `With ${g[0]}` : `With ${g.slice(0, -1).join(', ')} and ${g.at(-1)}`;
	};
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
		<section class="speakers" class:alone={screens.length === 0} aria-label="Speakers">
			<div class="ch wide">
				<span class="tag" data-brand={brandOf(speakers[0]!.plugin_id).toLowerCase()}
					>{brandOf(speakers[0]!.plugin_id)}</span
				>
				<span class="ttl">{speakers.length === 1 ? 'Speaker' : 'Speakers'}</span>
			</div>
			{#each speakers as d (d.device_id)}
				{@const p = playing(d)}
				{@const t = transportOf(d, want(d))}
				{@const v = volumeOf(d, want(d))}
				{@const g = groupWord(d)}
				<div class="player">
					{#if p.art}
						<img class="part" src={p.art} alt="" />
					{:else}
						<span class="part none" aria-hidden="true"><Speaker size={22} strokeWidth={1.8} /></span
						>
					{/if}
					<div class="pinfo">
						<button type="button" class="ttl pname" onclick={() => open(d)}>{nameOf(d)}</button>
						<small>{p.line}</small>
						{#if g}<small>{g}</small>{/if}
						{#if v.level}
							<div class="pvol">
								<Volume1 size={14} strokeWidth={2} aria-hidden="true" />
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
							</div>
						{/if}
						{#if note(d)}<p class="warn" role="status">{note(d)}</p>{/if}
					</div>
					<div class="tp">
						{#if t.previous}
							<button
								type="button"
								class="rb"
								aria-label="Previous"
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
								onclick={() => send(d, t.toggle)}
								>{#if t.playing}<Pause
										fill="currentColor"
										size={17}
										strokeWidth={2.4}
									/>{:else}<Play fill="currentColor" size={17} strokeWidth={2.4} />{/if}</button
							>
						{/if}
						{#if t.next}
							<button
								type="button"
								class="rb"
								aria-label="Next"
								disabled={!may || !d.available}
								onclick={() => send(d, t.next)}><SkipForward size={15} strokeWidth={2.2} /></button
							>
						{/if}
					</div>
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.media {
		display: flex;
		flex-direction: column;
		gap: 18px;
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
		width: 58px;
		height: 58px;
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
		width: 170px;
		height: 170px;
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
		left: 62px;
		top: 6px;
	}
	.arrow.down {
		left: 62px;
		bottom: 6px;
	}
	.arrow.left {
		left: 6px;
		top: 62px;
	}
	.arrow.right {
		right: 6px;
		top: 62px;
	}
	.ok {
		position: absolute;
		left: 50px;
		top: 50px;
		width: 70px;
		height: 70px;
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
		grid-template-columns: repeat(3, 44px);
		gap: 8px;
	}
	.keys button {
		width: 44px;
		height: 44px;
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
	.speakers {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 18px;
		padding: 14px 20px 0;
		border-top: 1px solid var(--con-edge-strong);
	}
	.speakers.alone {
		padding-top: 0;
		border-top: 0;
	}
	.wide {
		width: 100%;
	}
	.player {
		flex: 1 1 360px;
		max-width: 560px;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 4px 0;
		min-width: 0;
	}
	.part {
		width: 64px;
		height: 64px;
		flex: none;
		border-radius: 12px;
		object-fit: cover;
		box-shadow: 0 10px 20px -10px rgba(138, 42, 92, 0.9);
	}
	.part.none {
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink-muted);
		box-shadow: none;
	}
	.pinfo {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pname {
		font-size: 14px;
		font-weight: 700;
	}
	.pinfo small {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--ink-muted);
		font-size: 11.5px;
	}
	.pvol {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
		color: var(--ink-muted);
	}
	.num {
		width: 30px;
		text-align: right;
		font: 500 12px var(--font-num);
		color: var(--ink);
	}
	.tp {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.rb {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.rb.big {
		width: 46px;
		height: 46px;
		background: var(--ink);
		color: var(--bg, #0b0d12);
	}
	.rb:disabled {
		opacity: 0.35;
		cursor: default;
	}

	@media (max-width: 1100px) {
		.col {
			padding: 0 14px;
		}
		.screen {
			width: 260px;
		}
		.apps-col {
			width: 300px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ico {
			transition: none;
		}
	}
</style>
