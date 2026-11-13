<!--
	Home on the phone (the PhonePlan board), from the console's Home
	(homeNow.svelte.ts): a greeting with the day and the temperature outside,
	and the house in a line; what needs attention, each with its fix; Every
	light off and the person's favorites in a row that scrolls across; then
	every room as a lit tile, two across in Home's order.
-->
<script lang="ts">
	import LightbulbOff from '@lucide/svelte/icons/lightbulb-off';
	import { devices } from '#lib/devices.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { cardFor } from '#lib/card.js';
	import Icon from '#lib/components/Icon.svelte';
	import HomePills from '../HomePills.svelte';
	import { greetingOf } from '../home.js';
	import { HomeNow } from '../homeNow.svelte.js';
	import PhoneTop from './PhoneTop.svelte';
	import RoomTile from './RoomTile.svelte';

	const h = new HomeNow();
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="phome">
		<div class="hglow" aria-hidden="true"></div>
		<PhoneTop title={greetingOf(h.at.getHours())}>
			<p class="sub">
				{[h.day, h.outside && `${h.outside} outside`].filter(Boolean).join(' · ')}
			</p>
			<p class="line">{h.line}</p>
		</PhoneTop>

		{#if h.issues.length > 0}
			<div class="issues" role="group" aria-label="Needs attention">
				{#each h.issues as i (i.key)}
					{@const pending = 'lock' in i.fix && !!commands.pending[i.fix.lock]}
					<button
						type="button"
						class="ipill"
						class:rest={i.key === 'rest'}
						aria-busy={pending || undefined}
						disabled={'lock' in i.fix && !h.may}
						onclick={() => h.fix(i)}
						><span class="it">{i.text}</span><b>{pending ? 'Locking…' : i.act}</b></button
					>
				{/each}
			</div>
		{/if}
		<div class="cams"><HomePills /></div>

		<div class="favs" role="group" aria-label="Favorites">
			<button
				type="button"
				class="fav"
				class:on={h.lightsOn > 0}
				disabled={!h.may || h.busy || h.lightsOn === 0}
				aria-busy={h.busy || undefined}
				onclick={h.everyLightOff}
			>
				<span class="fi"><LightbulbOff size={16} strokeWidth={2} aria-hidden="true" /></span>
				<span class="ft"
					>Every light off<small
						>{h.busy ? 'Turning off…' : h.lightsOn > 0 ? `${h.lightsOn} on now` : 'All off'}</small
					></span
				>
			</button>
			{#each h.favs as f (f.key)}
				{#if 'device' in f}
					{@const c = cardFor(f.device, clock.now)}
					<button
						type="button"
						class="fav"
						class:on={c.tone === 'on'}
						class:bad={c.icon === 'unlock' || c.alarm !== undefined}
						aria-busy={commands.pending[f.device.device_id] ? true : undefined}
						onclick={() => h.useDevice(f.device)}
					>
						<span class="fi"><Icon name={c.icon} size={16} /></span>
						<span class="ft">{c.name}<small>{c.stateLine || 'Scene'}</small></span>
					</button>
				{:else}
					<button type="button" class="fav" disabled={!h.may} onclick={() => h.runScene(f.scene)}>
						<span class="fi"><Icon name="scene" size={16} /></span>
						<span class="ft">{f.scene.name}<small>House scene</small></span>
					</button>
				{/if}
			{/each}
		</div>
		{#if h.trouble}<p class="trouble" role="alert">{h.trouble}</p>{/if}

		<h2 class="sh">Rooms</h2>
		<section class="tiles" aria-label="Rooms">
			{#each h.tiles as t (t.room.id)}
				<RoomTile {t} />
			{/each}
		</section>
	</div>
{/if}

<style>
	.phome {
		position: relative;
		isolation: isolate;
		padding-bottom: 20px;
	}
	.hglow {
		position: absolute;
		z-index: -1;
		inset: 0 0 auto;
		height: 260px;
		pointer-events: none;
		background:
			radial-gradient(circle at 10% 0%, rgba(255, 170, 80, 0.24), transparent 60%),
			radial-gradient(circle at 90% 5%, rgba(90, 120, 255, 0.14), transparent 55%);
	}
	:global(:root[data-theme='light']) .hglow {
		opacity: 0.5;
	}
	.quiet {
		padding: 24px 16px;
		color: var(--ink-muted);
	}
	.sub,
	.line {
		margin: 2px 0 0;
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 500;
	}
	.line {
		color: color-mix(in srgb, var(--ink) 75%, transparent);
	}

	/* ---- what needs attention ---- */
	.issues {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px 16px 0;
	}
	.ipill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		min-height: 44px;
		box-sizing: border-box;
		padding: 0 6px 0 14px;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 91, 91, 0.16);
		color: #ff9a9a;
		font: 600 13px var(--font);
	}
	:global(:root[data-theme='light']) .ipill {
		color: #b42318;
	}
	.ipill.rest {
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
	}
	.it {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ipill b {
		flex: none;
		padding: 6px 11px;
		border-radius: 999px;
		background: #ff6b6b;
		color: #1a0505;
		font-size: 12px;
	}
	.ipill.rest b {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}
	.cams {
		padding: 0 16px;
	}
	.cams :global(.camchip) {
		height: 44px;
	}

	/* ---- favorites, across ---- */
	.favs {
		display: flex;
		gap: 8px;
		padding: 12px 16px 2px;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.favs::-webkit-scrollbar {
		display: none;
	}
	.fav {
		flex: none;
		width: 150px;
		min-height: 64px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		border: 0;
		border-radius: 16px;
		scroll-snap-align: start;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font: 600 13px var(--font);
		text-align: left;
	}
	.fav.on {
		background: rgba(255, 196, 107, 0.12);
		box-shadow: inset 0 0 0 1px rgba(255, 196, 107, 0.3);
	}
	.fav.bad {
		background: rgba(255, 91, 91, 0.12);
		box-shadow: inset 0 0 0 1px rgba(255, 91, 91, 0.3);
	}
	.fav:disabled {
		opacity: 0.6;
	}
	.fi {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.fav.on .fi {
		background: #ffc46b;
		color: #1a0f05;
	}
	.ft {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.ft,
	.ft small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ft small {
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 500;
		margin-top: 2px;
	}
	.trouble {
		margin: 8px 16px 0;
		color: var(--alert);
		font-size: 13px;
	}

	/* ---- every room ---- */
	.sh {
		margin: 0;
		padding: 18px 16px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		padding: 0 16px;
	}
</style>
