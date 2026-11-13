<!--
	The room's audio, along the bottom of a room in the console (the
	FamilyRoom and Office boards' dock): what the room's audio device is
	playing, play and skip, which device the room plays through, and its
	volume. A Sonos reports its level, so it gets a slider; a Roku doesn't,
	so it gets steps.

	Which device is the room's is chosen here ("Plays through"), and kept
	with the house's layout (media.ts).

	On a phone it comes in two parts (`as`): a slim bar pinned over the
	page, with what's playing and play or pause, that opens the rest in a
	sheet, the whole bar stacked.
-->
<script lang="ts">
	import Music from '@lucide/svelte/icons/music';
	import Tv from '@lucide/svelte/icons/tv';
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import Level from './Level.svelte';
	import {
		artistOf,
		currentApp,
		isOn,
		playerKind,
		playerName,
		transportOf,
		volumeOf,
		type AudioChoice
	} from './media.js';
	import { brandOf } from './room.js';
	import { send } from './send.js';

	let {
		room,
		audio,
		choice,
		choices,
		may,
		stepNote,
		onchoose,
		onstep,
		onmute,
		onlevel,
		as = 'dock',
		onopen
	}: {
		room: string;
		/** The device the room plays through; none when someone chose none. */
		audio: CoreDevice | undefined;
		/** The picker's value: the device's id, or `''` for none. */
		choice: string;
		choices: AudioChoice[];
		may: boolean;
		/** For a device with steps only: what its keys did last. */
		stepNote: string;
		onchoose: (id: string) => void;
		onstep: (by: 1 | -1) => void;
		onmute: () => void;
		onlevel: (v: number) => void;
		/** Along a room's bottom; a phone's slim bar; or the whole of it, in a phone's sheet. */
		as?: 'dock' | 'compact' | 'sheet';
		/** The slim bar's: opens the rest. */
		onopen?: () => void;
	} = $props();

	const want = $derived(audio ? commands.pending[audio.device_id]?.want : undefined);
	const vol = $derived(audio ? volumeOf(audio, want) : undefined);
	const t = $derived(audio ? transportOf(audio, want) : undefined);
	const live = $derived(!!audio && audio.available && may);
	const screen = $derived(!!audio && playerKind(audio) === 'screen');
	const nameOf = (d: CoreDevice) => playerName(d);

	const now = $derived.by((): { title: string; sub: string; art?: string } => {
		if (!audio)
			return {
				title: `No audio in the ${room} yet`,
				sub: 'Choose the device this room plays through'
			};
		const name = nameOf(audio);
		if (!audio.available) return { title: 'Offline', sub: `${name} isn’t answering` };
		if (!isOn({ ...audio, attributes: { ...audio.attributes, ...want } }))
			return { title: 'Off', sub: name };
		if (screen) {
			const app = currentApp(audio);
			return { title: app ?? 'Home screen', sub: `${name} · ${t?.playing ? 'playing' : 'on'}` };
		}
		const c = cardFor(audio, clock.now);
		if (!c.nowPlaying) return { title: 'Nothing playing', sub: name };
		const artist = artistOf(audio);
		return {
			title: c.nowPlaying,
			sub: [artist, name, t?.playing ? 'playing' : 'paused'].filter(Boolean).join(' · '),
			art: c.art
		};
	});
	const muted = $derived(vol?.muted === true);
</script>

{#snippet art()}
	{#if now.art}
		<img class="art" src={now.art} alt="" />
	{:else}
		<span class="art" class:tv={screen} class:none={!audio} aria-hidden="true"
			>{#if screen}<Tv size={20} strokeWidth={1.8} />{:else}<Music
					size={20}
					strokeWidth={1.8}
				/>{/if}</span
		>
	{/if}
{/snippet}

{#if as === 'compact'}
	<footer class="dock compact" aria-label={`${room} audio`}>
		<button
			type="button"
			class="open"
			aria-haspopup="dialog"
			aria-label={`${room} audio: ${now.title}. More`}
			onclick={onopen}
		>
			{@render art()}
			<span class="np" aria-live="polite"><b>{now.title}</b><small>{now.sub}</small></span>
		</button>
		{#if audio && t?.toggle}
			<button
				type="button"
				class="rb big"
				aria-label={t.playing ? 'Pause' : 'Play'}
				disabled={!live}
				onclick={() => send(audio, t.toggle)}
				>{#if t.playing}<Pause fill="currentColor" size={17} strokeWidth={2.4} />{:else}<Play
						fill="currentColor"
						size={17}
						strokeWidth={2.4}
					/>{/if}</button
			>
		{/if}
	</footer>
{:else}
	<footer class="dock" class:sheet={as === 'sheet'} aria-label={`${room} audio`}>
		{@render art()}
		<div class="np" aria-live="polite">
			<b>{now.title}</b>
			<small>{now.sub}</small>
		</div>
		{#if audio && t && (t.toggle || t.previous || t.next)}
			<div class="tp" role="group" aria-label="Playing">
				<button
					type="button"
					class="rb"
					aria-label="Previous"
					disabled={!live || !t.previous}
					onclick={() => send(audio, t.previous)}><SkipBack size={15} strokeWidth={2.2} /></button
				>
				<button
					type="button"
					class="rb big"
					aria-label={t.playing ? 'Pause' : 'Play'}
					disabled={!live || !t.toggle}
					onclick={() => send(audio, t.toggle)}
					>{#if t.playing}<Pause fill="currentColor" size={17} strokeWidth={2.4} />{:else}<Play
							fill="currentColor"
							size={17}
							strokeWidth={2.4}
						/>{/if}</button
				>
				<button
					type="button"
					class="rb"
					aria-label="Next"
					disabled={!live || !t.next}
					onclick={() => send(audio, t.next)}><SkipForward size={15} strokeWidth={2.2} /></button
				>
			</div>
		{/if}
		<span class="gap"></span>
		<label class="via">
			<small>Plays through</small>
			<select
				aria-label={`${room}'s audio device`}
				value={choice}
				disabled={!may}
				onchange={(e) => onchoose(e.currentTarget.value)}
			>
				{#each choices.filter((c) => c.here) as c (c.id)}
					<option value={c.id}>{c.label}</option>
				{/each}
				<option value="">None</option>
				{#if choices.some((c) => !c.here)}
					<optgroup label="Elsewhere in the house">
						{#each choices.filter((c) => !c.here) as c (c.id)}
							<option value={c.id}>{c.label}</option>
						{/each}
					</optgroup>
				{/if}
			</select>
		</label>
		<div class="vol" role="group" aria-label={`${room} volume`}>
			<button
				type="button"
				class="rb"
				class:mute={muted}
				aria-label={vol?.muted === undefined
					? 'Mute or unmute'
					: muted
						? `Unmute ${room}`
						: `Mute ${room}`}
				aria-pressed={vol?.muted}
				disabled={!live || !vol?.canMute}
				onclick={onmute}
				>{#if muted}<VolumeX size={16} strokeWidth={2.2} />{:else}<Volume2
						size={16}
						strokeWidth={2.2}
					/>{/if}</button
			>
			<button
				type="button"
				class="rb"
				aria-label="Volume down"
				disabled={!live || (!vol?.steps && !vol?.level)}
				onclick={() => onstep(-1)}><Minus size={16} strokeWidth={2.4} /></button
			>
			{#if vol?.level}
				<Level
					label={`${room} volume`}
					value={vol.level.value}
					min={vol.level.min}
					max={vol.level.max}
					{muted}
					width={as === 'sheet' ? 120 : 150}
					disabled={!live}
					waiting={want?.volume !== undefined}
					oncommit={onlevel}
				/>
			{:else}
				<span class="steps">{audio ? stepNote : ''}</span>
			{/if}
			<button
				type="button"
				class="rb"
				aria-label="Volume up"
				disabled={!live || (!vol?.steps && !vol?.level)}
				onclick={() => onstep(1)}><Plus size={16} strokeWidth={2.4} /></button
			>
			<span class="num">{vol?.level ? (muted ? 'mute' : Math.round(vol.level.value)) : ''}</span>
		</div>
		{#if audio && commands.notes[audio.device_id]}
			<span class="warn" role="status">{commands.notes[audio.device_id]}</span>
		{/if}
	</footer>
{/if}

<style>
	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 76px;
		padding: 10px 18px;
		margin-top: auto;
		background: linear-gradient(180deg, rgba(28, 24, 40, 0.92), rgba(18, 16, 26, 0.95));
		backdrop-filter: blur(30px);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 -12px 30px -16px rgba(0, 0, 0, 0.8);
		color: #e9ecf2;
	}
	:global(:root[data-theme='light']) .dock {
		background: linear-gradient(180deg, rgba(246, 243, 252, 0.94), rgba(236, 232, 245, 0.96));
		box-shadow:
			inset 0 1px 0 rgba(0, 0, 0, 0.08),
			0 -12px 30px -16px rgba(0, 0, 0, 0.25);
		color: var(--ink);
	}
	.art {
		width: 52px;
		height: 52px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 12px;
		object-fit: cover;
		color: rgba(255, 255, 255, 0.8);
		background: conic-gradient(from 210deg at 30% 40%, #2b1250, #8a2a5c, #d0532e, #3a1b6b, #2b1250);
		box-shadow: 0 8px 18px -8px rgba(138, 42, 92, 0.8);
	}
	.art.tv {
		background: radial-gradient(circle at 50% 120%, #3a1b6b, #0c0d14 70%);
	}
	.art.none {
		background: color-mix(in srgb, currentColor 6%, transparent);
		color: color-mix(in srgb, currentColor 50%, transparent);
		box-shadow: none;
	}
	.np {
		min-width: 0;
		flex: 0 1 260px;
	}
	.np b {
		display: block;
		font-size: 13.5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.np small {
		display: block;
		margin-top: 2px;
		font-size: 11.5px;
		opacity: 0.7;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tp,
	.vol {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.gap {
		flex: 1 1 0;
	}
	.rb {
		width: 36px;
		height: 36px;
		flex: none;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, currentColor 9%, transparent);
		color: inherit;
		cursor: pointer;
	}
	.rb:hover:not(:disabled) {
		background: color-mix(in srgb, currentColor 16%, transparent);
	}
	.rb.big {
		width: 46px;
		height: 46px;
		background: #fff;
		color: #0b0d12;
	}
	:global(:root[data-theme='light']) .rb.big {
		background: #14161c;
		color: #fff;
	}
	.rb.mute {
		background: #ff6b5b;
		color: #1a0605;
	}
	.rb:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.via {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding-left: 16px;
		border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent);
	}
	.via small {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	:global(:root[data-theme='light']) .via small {
		color: var(--ink-muted);
		opacity: 1;
	}
	.via select {
		height: 28px;
		max-width: 220px;
		padding: 0 8px;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, currentColor 10%, transparent);
		color: inherit;
		font-size: 12px;
		font-weight: 500;
	}
	.via option,
	.via optgroup {
		background: #1c1828;
		color: #e9ecf2;
	}
	.vol :global(.lvl) {
		flex: none;
	}
	.steps {
		min-width: 150px;
		text-align: center;
		font-size: 11.5px;
		font-weight: 500;
		opacity: 0.7;
	}
	.num {
		width: 36px;
		text-align: right;
		font: 500 13px var(--font-num);
	}
	.warn {
		font-size: 11.5px;
		color: var(--alert);
	}

	/* ---- on a phone: the slim bar, over the page, and the whole of it in a sheet ---- */
	.dock.compact {
		position: fixed;
		left: max(10px, env(safe-area-inset-left));
		right: max(10px, env(safe-area-inset-right));
		bottom: calc(var(--tabbar-h, 0px) + 8px);
		z-index: 15;
		min-height: 60px;
		gap: 8px;
		padding: 0 8px 0 0;
		border-radius: 18px;
		margin: 0;
	}
	.open {
		flex: 1;
		min-width: 0;
		min-height: 60px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 0 0 9px;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	.compact .art {
		width: 42px;
		height: 42px;
		border-radius: 10px;
	}
	.compact .np {
		flex: 1;
	}
	.compact .rb.big {
		width: 44px;
		height: 44px;
	}
	.dock.sheet {
		position: static;
		flex-wrap: wrap;
		gap: 14px 12px;
		min-height: 0;
		padding: 4px 0 0;
		background: none;
		backdrop-filter: none;
		box-shadow: none;
		color: inherit;
	}
	.sheet .np {
		flex: 1 1 180px;
	}
	.sheet .gap {
		display: none;
	}
	.sheet .tp {
		width: 100%;
		justify-content: center;
		gap: 18px;
	}
	.sheet .rb {
		width: 44px;
		height: 44px;
	}
	.sheet .rb.big {
		width: 56px;
		height: 56px;
	}
	.sheet .via {
		width: 100%;
		padding-left: 0;
		border-left: 0;
	}
	.sheet .via select {
		max-width: none;
		height: 44px;
		font-size: 14px;
	}
	.sheet .vol {
		width: 100%;
		justify-content: space-between;
	}

	@media (max-width: 1100px) {
		.dock {
			flex-wrap: wrap;
			gap: 10px 14px;
			padding: 10px 16px;
		}
		.gap {
			display: none;
		}
		.np {
			flex: 1 1 180px;
		}
		.via {
			padding-left: 0;
			border-left: 0;
		}
	}
</style>
