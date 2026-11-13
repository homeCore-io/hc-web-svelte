<!--
	Home in the console's look (the HomeConsole board): a greeting with the
	day, the time and the weather outside, and the house in a line; what
	needs attention, each with its fix; the house's favorites; every room as
	a tile, its drawing lit live by its lights, with its temperature and
	what's going on; and what's playing in the house, along the bottom.
	What the cameras saw lately shows under the greeting, as the household
	chose (HomePills).

	A screen can open on a room instead (opensOn.ts). Loaded only by the
	console's look.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Cloud from '@lucide/svelte/icons/cloud';
	import CloudSun from '@lucide/svelte/icons/cloud-sun';
	import CloudMoon from '@lucide/svelte/icons/cloud-moon';
	import LightbulbOff from '@lucide/svelte/icons/lightbulb-off';
	import Music from '@lucide/svelte/icons/music';
	import Tv from '@lucide/svelte/icons/tv';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { displayName } from '#lib/devices.js';
	import Icon from '#lib/components/Icon.svelte';
	import RoomPicture from './RoomPicture.svelte';
	import HomePills from './HomePills.svelte';
	import { anyLit } from './pictures.js';
	import RoomPhoto from './RoomPhoto.svelte';
	import { photoLit } from './photo.js';
	import { greetingOf } from './home.js';
	import { HomeNow } from './homeNow.svelte.js';
	import { openingRoom } from './opensOn.js';

	// The page draws its own title, the greeting.
	$effect(() => heading.ownTitle());

	// A screen chosen to open on a room goes there, the first time it opens at Home.
	// It waits for the rooms to arrive, so it knows the room is still there.
	let opening = openingRoom();
	$effect(() => {
		const to = opening;
		if (!to || !rooms.list.some((r) => r.id === to)) return;
		opening = undefined;
		void goto(`/rooms/${to}`, { replaceState: true });
	});

	// Home as it is now (homeNow.svelte.ts).
	const h = new HomeNow();
	const may = $derived(h.may);

	// ---- the greeting, and the weather outside ----
	const at = $derived(h.at);
	const day = $derived(h.day);
	const time = $derived(h.time);
	const night = $derived(h.night);
	const outside = $derived(h.outside);
	const station = $derived(h.station);
	const humidity = $derived(h.humidity);
	const condition = $derived(h.condition);
	const cloudy = $derived(h.cloudy);
	const partly = $derived(h.partly);

	// ---- every room as a tile, the house in a line, what needs attention ----
	const tiles = $derived(h.tiles);
	const lightsOn = $derived(h.lightsOn);
	const issues = $derived(h.issues);
	const playing = $derived(h.playing);
	const line = $derived(h.line);
	const fix = h.fix;

	// ---- favorites ----
	const favs = $derived(h.favs);
	const busy = $derived(h.busy);
	const trouble = $derived(h.trouble);
	const { everyLightOff, useDevice, runScene } = h;

	// ---- what's playing ----
	const DOCK_SHOWN = 2;
	const artOf = (id: string) => {
		const d = devices.byId[id];
		return d ? cardFor(d, clock.now).art : undefined;
	};
	const playingNow = $derived(playing.filter((p) => p.playing).length);
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="chome">
		<section class="homehead">
			<div class="hglow" aria-hidden="true"></div>
			<div class="hello">
				<p class="when">{day} · {time}</p>
				<h1 class="title">{greetingOf(at.getHours())}</h1>
				<p class="line">{line}</p>
				<HomePills />
			</div>
			{#if outside}
				<div class="outside" title={station ? `From ${displayName(station)}` : undefined}>
					<span class="sky" aria-hidden="true">
						{#if cloudy && partly}
							{#if night}<CloudMoon size={40} strokeWidth={1.5} />{:else}<CloudSun
									size={40}
									strokeWidth={1.5}
								/>{/if}
						{:else if cloudy}<Cloud size={40} strokeWidth={1.5} />
						{:else if night}<Moon size={40} strokeWidth={1.5} />
						{:else}<Sun size={40} strokeWidth={1.5} />{/if}
					</span>
					<div>
						<b>{outside}</b>
						<small
							>{['Outside', humidity && `${humidity} humidity`].filter(Boolean).join(' · ')}</small
						>
						{#if condition || station}<small class="from"
								>{condition ?? `From ${displayName(station!)}`}</small
							>{/if}
					</div>
				</div>
			{/if}
		</section>

		{#if issues.length > 0}
			<div class="issues" role="group" aria-label="Needs attention">
				{#each issues as i (i.key)}
					{@const pending = 'lock' in i.fix && !!commands.pending[i.fix.lock]}
					<button
						type="button"
						class="ipill"
						class:rest={i.key === 'rest'}
						aria-busy={pending || undefined}
						disabled={'lock' in i.fix && !may}
						onclick={() => fix(i)}
						><i aria-hidden="true"></i>{i.text}<b>{pending ? 'Locking…' : i.act}</b></button
					>
				{/each}
			</div>
		{/if}

		<div class="favs" role="group" aria-label="Favorites">
			<button
				type="button"
				class="fav"
				class:on={lightsOn > 0}
				disabled={!may || busy || lightsOn === 0}
				aria-busy={busy || undefined}
				onclick={everyLightOff}
			>
				<span class="fi"><LightbulbOff size={16} strokeWidth={2} aria-hidden="true" /></span>
				<span class="ft"
					>Every light off<small
						>{busy ? 'Turning off…' : lightsOn > 0 ? `${lightsOn} on now` : 'All off'}</small
					></span
				>
			</button>
			{#each favs as f (f.key)}
				{#if 'device' in f}
					{@const c = cardFor(f.device, clock.now)}
					<button
						type="button"
						class="fav"
						class:on={c.tone === 'on'}
						class:bad={c.icon === 'unlock' || c.alarm !== undefined}
						aria-busy={commands.pending[f.device.device_id] ? true : undefined}
						onclick={() => useDevice(f.device)}
					>
						<span class="fi"><Icon name={c.icon} size={16} /></span>
						<span class="ft">{c.name}<small>{c.stateLine || 'Scene'}</small></span>
					</button>
				{:else}
					<button type="button" class="fav" disabled={!may} onclick={() => runScene(f.scene)}>
						<span class="fi"><Icon name="scene" size={16} /></span>
						<span class="ft">{f.scene.name}<small>House scene</small></span>
					</button>
				{/if}
			{/each}
			{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
		</div>

		<section class="tiles" aria-label="Rooms">
			{#each tiles as t (t.room.id)}
				<a
					class="tile"
					class:alarm={t.alarm}
					href={`/rooms/${t.room.id}`}
					aria-label={`${t.room.name}, ${[t.temp, t.status].filter(Boolean).join(', ')}`}
				>
					{#if t.photo}<RoomPhoto
							src={t.photo.src}
							focus={t.photo.focus}
							glow={t.glow}
							size="tile"
							shade={false}
						/>{:else if !t.plain}<RoomPicture picture={t.picture} g={t.g} />{/if}
					<span
						class="tdim"
						class:off={t.photo ? !photoLit(t.glow) : !anyLit(t.picture, t.g)}
						aria-hidden="true"
					></span>
					<span class="tshade" aria-hidden="true"></span>
					<span class="tinfo"><b>{t.room.name}</b><small>{t.status}</small></span>
					{#if t.temp}<span class="ttemp">{t.temp}</span>{/if}
					<span class="tdot" class:on={t.lightsOn > 0} class:bad={t.alarm} aria-hidden="true"
					></span>
				</a>
			{/each}
		</section>

		{#if playing.length > 0}
			<footer class="dock" aria-label="Playing in the house">
				{#each playing.slice(0, DOCK_SHOWN) as p (p.id)}
					{@const art = artOf(p.id)}
					<a class="now" href={p.href ?? '/'}>
						{#if art}<img class="art" src={art} alt="" />{:else}<span
								class="art"
								class:tv={p.screen}
								aria-hidden="true"
								>{#if p.screen}<Tv size={20} strokeWidth={1.8} />{:else}<Music
										size={20}
										strokeWidth={1.8}
									/>{/if}</span
							>{/if}
						<span class="np"><b>{p.title}</b><small>{p.sub}</small></span>
					</a>
				{/each}
				<span class="gap"></span>
				<a class="count" href="/everywhere/media" title="Everywhere › Media"
					>{playingNow === 0
						? 'Nothing playing now'
						: playingNow === 1
							? '1 playing'
							: `${playingNow} playing`}{playing.length > DOCK_SHOWN
						? ` · ${playing.length - DOCK_SHOWN} more`
						: ''}</a
				>
			</footer>
		{/if}
	</div>
{/if}

<style>
	.chome {
		/* Tiles four across with the sidebar open, five with it folded (HomeConsole). */
		container: home / inline-size;
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--header-h, 52px));
	}
	.quiet {
		padding: 24px 28px;
		color: var(--ink-muted);
	}

	/* ---- the greeting ---- */
	.homehead {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 20px;
		padding: 24px 28px 16px;
	}
	.hglow {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(circle at 15% 0%, rgba(255, 170, 80, 0.28), transparent 55%),
			radial-gradient(circle at 85% 10%, rgba(90, 120, 255, 0.18), transparent 50%);
		/* The glow fades out below the greeting, under what needs attention. */
		bottom: -60px;
		mask-image: linear-gradient(180deg, #000 55%, transparent);
	}
	:global(:root[data-theme='light']) .hglow {
		opacity: 0.5;
	}
	.hello {
		position: relative;
		flex: 1 1 360px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.when {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.title {
		margin: 0;
		font-size: 46px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.line {
		margin: 4px 0 0;
		font-size: 13.5px;
		color: color-mix(in srgb, var(--ink) 80%, transparent);
	}
	.hello :global(.pills) {
		margin-top: 4px;
	}
	.outside {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		border-radius: 16px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.sky {
		display: grid;
		color: #c7d2e6;
	}
	:global(:root[data-theme='light']) .sky {
		color: #5a6478;
	}
	.outside b {
		display: block;
		font-size: 28px;
		font-weight: 700;
		line-height: 1;
	}
	.outside small {
		display: block;
		margin-top: 2px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.outside .from {
		font-size: 11px;
	}

	/* ---- what needs attention ---- */
	.issues {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0 28px 10px;
	}
	.ipill {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 38px;
		padding: 0 6px 0 14px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--alert) 14%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--alert) 50%, transparent);
		color: color-mix(in srgb, var(--alert) 45%, var(--ink));
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.ipill i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--alert);
		box-shadow: 0 0 8px var(--alert);
	}
	.ipill b {
		height: 28px;
		padding: 0 10px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		background: var(--alert);
		color: #1a0605;
		font-size: 12px;
	}
	.ipill.rest {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		box-shadow: none;
		color: var(--ink);
	}
	.ipill.rest i {
		background: var(--ink-muted);
		box-shadow: none;
	}
	.ipill.rest b {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink);
	}
	.ipill:disabled {
		cursor: default;
		opacity: 0.7;
	}

	/* ---- favorites ---- */
	.favs {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 28px;
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
	.fav:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.fav:disabled {
		cursor: default;
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
	.fav.bad {
		background: color-mix(in srgb, var(--alert) 16%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--alert) 50%, transparent);
	}
	.fav.bad .fi {
		background: var(--alert);
		color: #1a0605;
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
	.trouble {
		margin: 0;
		font-size: 12.5px;
		color: var(--alert);
	}

	/* ---- the rooms ---- */
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		padding: 14px 28px 18px;
		align-content: start;
		flex: 1;
	}
	@container home (min-width: 1250px) {
		.tiles {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
		.tile {
			height: 108px;
		}
	}
	@container home (max-width: 820px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@container home (max-width: 560px) {
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 12px 16px 16px;
		}
		.homehead,
		.issues,
		.favs {
			padding-left: 16px;
			padding-right: 16px;
		}
		.title {
			font-size: 36px;
		}
	}
	.tile {
		position: relative;
		height: 100px;
		border-radius: 14px;
		overflow: hidden;
		text-decoration: none;
		color: #e9ecf2;
		background: #0e1016;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.06),
			0 14px 28px -18px rgba(0, 0, 0, 0.9);
		transition: transform 0.15s;
	}
	.tile:hover {
		transform: translateY(-2px);
	}
	.tile:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.tile.alarm {
		box-shadow:
			inset 0 0 0 1.5px rgba(255, 107, 91, 0.7),
			0 0 18px rgba(255, 107, 91, 0.25);
	}
	.tdim {
		position: absolute;
		inset: 0;
		background: #07080b;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.4s;
	}
	.tdim.off {
		opacity: 0.18;
	}
	.tshade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(0deg, rgba(7, 8, 11, 0.85), rgba(7, 8, 11, 0) 60%);
	}
	/* Over the drawing, a tile's words sit on the dark however the page is lit. */
	.tinfo {
		position: absolute;
		left: 12px;
		bottom: 9px;
		right: 60px;
		display: flex;
		flex-direction: column;
	}
	.tinfo b {
		font-size: 14.5px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tinfo small {
		color: #c7cdd8;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ttemp {
		position: absolute;
		right: 12px;
		bottom: 9px;
		font-size: 16px;
		font-weight: 700;
	}
	.tdot {
		position: absolute;
		right: 12px;
		top: 10px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.tdot.on {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.tdot.bad {
		background: #ff6b5b;
		box-shadow: 0 0 8px #ff6b5b;
	}

	/* A shorter window: a slimmer greeting and tiles, so more of the rooms show at once. */
	@media (max-height: 820px) {
		.homehead {
			padding-top: 16px;
			padding-bottom: 10px;
		}
		.title {
			font-size: 34px;
		}
		.issues {
			padding-bottom: 6px;
		}
		.favs {
			padding-top: 8px;
			padding-bottom: 8px;
		}
		.fav {
			height: 42px;
		}
		.tiles {
			padding-top: 10px;
			gap: 10px;
		}
		.tile {
			height: 88px;
		}
	}

	/* ---- what's playing ---- */
	.dock {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 24px;
		min-height: 76px;
		box-sizing: border-box;
		padding: 10px 18px;
		margin-top: auto;
		background: linear-gradient(180deg, rgba(28, 24, 40, 0.92), rgba(18, 16, 26, 0.95));
		backdrop-filter: blur(30px);
		-webkit-backdrop-filter: blur(30px);
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
	.now {
		min-width: 0;
		flex: 0 1 320px;
		display: flex;
		align-items: center;
		gap: 14px;
		color: inherit;
		text-decoration: none;
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
		width: 44px;
		height: 44px;
		background: radial-gradient(circle at 50% 120%, #3a1b6b, #0c0d14 70%);
	}
	.np {
		min-width: 0;
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
	.gap {
		flex: 1 1 0;
	}
	.count {
		flex: none;
		text-decoration: none;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(160, 123, 255, 0.18);
		color: #c9b8ff;
		font-size: 12.5px;
		font-weight: 600;
	}
	:global(:root[data-theme='light']) .count {
		color: #5b3fb8;
	}
	@container home (max-width: 820px) {
		.now:nth-of-type(2) {
			display: none;
		}
	}
</style>
