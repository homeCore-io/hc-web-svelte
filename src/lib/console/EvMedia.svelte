<!--
	Everywhere › Media (the Everywhere board): every player in the house,
	room by room, screens before speakers as each room's Media tab has them.
	Each row says what it's playing, with its volume (a slider where it
	reports a level, as a Sonos does; − and + where it only steps, as a Roku
	does) and play or pause. "Pause everything" asks first.
-->
<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import EvHead from './EvHead.svelte';
	import Level from './Level.svelte';
	import {
		artistOf,
		hueOf,
		playerKind,
		playerName,
		remoteKeys,
		stepCmd,
		transportOf,
		volumeCmd,
		volumeOf
	} from './media.js';
	import { brandOf } from './room.js';
	import { send } from './send.js';
	import { playerRows, playingNow, silentRooms, type Place } from './everywhere.js';
	import { playNow } from '#lib/playing.js';

	let { places }: { places: Place[] } = $props();

	const rows = $derived(playerRows(places));
	const playing = $derived(playingNow(rows, commands.pending));
	const silent = $derived(silentRooms(places));
	const may = $derived(session.mayUse);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;

	const summary = $derived(
		rows.length === 0
			? 'Nothing in the house plays yet'
			: playing.length === 0
				? 'Nothing playing'
				: `${playing.length} playing · ${rows.length - playing.length} not playing`
	);

	const players = $derived(rows.map((r) => r.device));

	/**
	 * What a player has on, and how it is, as every place counts it
	 * (playing.ts): the header's count is the rows that say Playing.
	 */
	function nowOf(d: CoreDevice): { what: string; state: string; on: boolean } {
		const n = playNow(d, players, want(d));
		const on = n.state === 'playing';
		switch (n.state) {
			case 'offline':
				return { what: 'It isn’t answering', state: 'Offline', on };
			case 'off':
				return { what: 'Standing by', state: 'Off', on };
			case 'grouped': {
				const lead = players.find((x) => x.device_id === n.lead);
				return { what: `With ${lead ? playerName(lead) : 'its group'}`, state: 'Grouped', on };
			}
		}
		if (n.screen)
			return {
				what: n.what ?? `The ${brandOf(d.plugin_id)} home screen`,
				state: on ? 'Playing' : n.state === 'open' ? 'Open' : 'Idle',
				on
			};
		if (!n.what) return { what: 'Nothing queued', state: 'Idle', on };
		const artist = artistOf(d);
		return {
			what: artist ? `${n.what} · ${artist}` : n.what,
			state: on ? 'Playing' : 'Paused',
			on
		};
	}
	const artOf = (d: CoreDevice) => (d.available ? cardFor(d, clock.now).art : undefined);

	/** Play or pause: the player's own, else its remote's Play key. */
	const toggleOf = (d: CoreDevice) => transportOf(d, want(d)).toggle ?? remoteKeys(d).play?.cmd;

	// A player that reports no level (a Roku) only steps: each row counts its
	// presses since the page opened, as its own remote would feel.
	let pressed = $state<Record<string, number>>({});
	function step(d: CoreDevice, by: 1 | -1) {
		void send(d, stepCmd(d, by, want(d)));
		if (!volumeOf(d, want(d)).level)
			pressed = { ...pressed, [d.device_id]: (pressed[d.device_id] ?? 0) + by };
	}
	const stepWord = (d: CoreDevice) => {
		const by = pressed[d.device_id] ?? 0;
		return by > 0 ? `Up ${by}` : by < 0 ? `Down ${-by}` : 'Steps only';
	};

	async function pauseAll() {
		const now = playing.filter((r) => toggleOf(r.device) !== undefined);
		if (now.length === 0) return;
		const yes = await ask({
			title: 'Pause everything?',
			body:
				now.length === 1
					? `${playerName(now[0]!.device)} pauses.`
					: `All ${now.length} players playing now pause.`,
			go: 'Pause',
			stay: 'Not now'
		});
		if (!yes) return;
		for (const r of now) void send(r.device, toggleOf(r.device));
	}
</script>

<EvHead title="Media" {summary} glow="#8c64ff">
	<button type="button" class="hbtn" disabled={!may || playing.length === 0} onclick={pauseAll}
		>Pause everything</button
	>
</EvHead>

<section class="evlist" aria-label="Playing in every room">
	{#if rows.length === 0}
		<p class="quiet">No room has a player yet.</p>
	{/if}
	{#each rows as r (r.device.device_id)}
		{@const d = r.device}
		{@const n = nowOf(d)}
		{@const art = artOf(d)}
		{@const vol = volumeOf(d, want(d))}
		{@const toggle = toggleOf(d)}
		<div class="evrow player">
			<span
				class="art"
				class:screen={playerKind(d) === 'screen'}
				style:--tint={`hsl(${hueOf(d.device_id)} 70% 62%)`}
				aria-hidden="true"
				>{#if art}<img src={art} alt="" />{/if}</span
			>
			{#if r.place.room}
				<a class="evname wide" href={`/rooms/${r.place.room.id}?tab=media`}
					><b>{playerName(d, r.place.name)}</b><small>{r.place.name} · {brandOf(d.plugin_id)}</small
					></a
				>
			{:else}
				<div class="evname wide">
					<b>{playerName(d)}</b><small>{r.place.name} · {brandOf(d.plugin_id)}</small>
				</div>
			{/if}
			<div class="evname what">
				<b>{n.what}</b><small class:playing={n.on}>{commands.notes[d.device_id] ?? n.state}</small>
			</div>
			<div class="vol">
				{#if vol.level}
					<Volume2 size={14} strokeWidth={2} class="spk" aria-hidden="true" />
					<Level
						label={`${playerName(d)} volume`}
						value={vol.level.value}
						min={vol.level.min}
						max={vol.level.max}
						muted={vol.muted === true}
						disabled={!may || !d.available}
						waiting={waiting(d)}
						oncommit={(v) => void send(d, volumeCmd(d, v))}
					/>
					<span class="num">{Math.round(vol.level.value)}</span>
				{:else if vol.steps}
					<button
						type="button"
						class="xbtn"
						aria-label={`${playerName(d)} volume down`}
						disabled={!may || !d.available}
						onclick={() => step(d, -1)}>−</button
					>
					<span class="sw">{stepWord(d)}</span>
					<button
						type="button"
						class="xbtn"
						aria-label={`${playerName(d)} volume up`}
						disabled={!may || !d.available}
						onclick={() => step(d, 1)}>+</button
					>
				{/if}
			</div>
			<button
				type="button"
				class="play"
				aria-label={`${n.on ? 'Pause' : 'Play'} ${playerName(d)}`}
				aria-busy={waiting(d) || undefined}
				disabled={!may || !d.available || !toggle}
				onclick={() => void send(d, toggle)}
			>
				{#if n.on}<Pause size={16} fill="currentColor" aria-hidden="true" />{:else}<Play
						size={16}
						fill="currentColor"
						aria-hidden="true"
					/>{/if}
			</button>
		</div>
	{/each}
	{#if silent.length > 0}
		<div class="evrow quietrow">
			<span class="quiet"
				>Rooms with nothing to play: {silent.length === 1
					? '1 room'
					: `${silent.length} rooms`}</span
			>
		</div>
	{/if}
</section>

<style>
	.evrow.player {
		min-height: 64px;
	}
	.art {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 10px;
		overflow: hidden;
		background: radial-gradient(
			circle at 30% 20%,
			color-mix(in srgb, var(--tint) 70%, transparent),
			color-mix(in srgb, var(--tint) 15%, #0c0d14) 75%
		);
		box-shadow: 0 8px 16px -10px rgba(0, 0, 0, 0.9);
	}
	.art.screen {
		background: radial-gradient(circle at 50% 120%, #3a1b6b, #0c0d14 70%);
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.evname.wide {
		width: 260px;
	}
	.evname.what {
		flex: 1 1 auto;
		width: auto;
	}
	.what b {
		font-weight: 500;
	}
	.what small.playing {
		color: var(--media-ink, #b9a3ff);
	}
	.vol {
		flex: none;
		width: 200px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.vol :global(.spk) {
		flex: none;
		color: var(--ink-muted);
	}
	.num {
		width: 24px;
		flex: none;
		font: 500 12px var(--font-num);
		color: var(--ink-muted);
		text-align: right;
	}
	.sw {
		flex: 1;
		font-size: 12px;
		color: var(--ink-muted);
		text-align: center;
		white-space: nowrap;
	}
	.play {
		flex: none;
		width: 42px;
		height: 42px;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--ink);
		color: var(--bg);
		cursor: pointer;
	}
	.play:disabled {
		cursor: default;
		opacity: 0.3;
	}
	.play[aria-busy='true'] {
		opacity: 0.7;
	}
	.quietrow {
		min-height: 40px;
	}
	/* On a phone: the player and its room, what's playing under, the volume across. */
	:global(.ev.phone) .evrow.player {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr) 44px;
		grid-template-areas:
			'art name play'
			'what what what'
			'vol vol vol';
		gap: 6px 12px;
		align-items: center;
	}
	:global(.ev.phone) .art {
		grid-area: art;
	}
	:global(.ev.phone) .evname.wide {
		grid-area: name;
		width: auto;
	}
	:global(.ev.phone) .evname.what {
		grid-area: what;
		min-height: 0;
	}
	:global(.ev.phone) .vol {
		grid-area: vol;
		width: 100%;
	}
	:global(.ev.phone) .play {
		grid-area: play;
		width: 44px;
		height: 44px;
	}
	@media (max-width: 1280px) {
		.evname.wide {
			width: 200px;
		}
		.vol {
			width: 170px;
		}
	}
</style>
