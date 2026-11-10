<!--
	A player as its artwork (13 §13.1, mini-media-player): while it plays,
	the picture homeCore fetches fills the card, with what's playing, play,
	skip and its volume. One that isn't playing is its plain card (G3,
	`children`). A station's logo is shown whole, on the card's own color.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardView } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';

	let {
		device,
		view,
		name,
		room,
		open,
		children
	}: {
		device: CoreDevice;
		view: CardView;
		name: string;
		room: string;
		open: () => void;
		children: Snippet;
	} = $props();

	const play = $derived(view.control?.kind === 'play' ? view.control : null);
	const playing = $derived(!!play?.playing);
	const a = $derived(device.attributes ?? {});
	const artist = $derived(
		[a.artist, a.media_artist].find((x): x is string => typeof x === 'string' && !!x.trim())
	);
	const transport = $derived(view.extras.find((e) => e.kind === 'transport'));
	const volume = $derived(view.extras.find((e) => e.kind === 'slider' && e.attr === 'volume'));
	const may = $derived(session.mayUse);

	// The volume follows the finger; it's sent once, when let go.
	let held = $state<number | null>(null);
	const act = (action: string | undefined) =>
		action && may && void commands.act(device.device_id, action);
</script>

{#if !playing}
	{@render children()}
{:else}
	<div class="art" class:logo={view.artLogo} class:none={!view.art}>
		{#if view.art}<img src={view.art} alt="" />{/if}
		<span class="shade"></span>
		<button class="where" onclick={open}
			><span>{room ? `${room} · ${name}` : name}</span><span>Playing</span></button
		>
		<div class="what">
			<b>{view.nowPlaying ?? name}</b>
			{#if artist}<span>{artist}</span>{/if}
			<div class="controls">
				{#if transport?.kind === 'transport' && transport.previous}
					<button
						class="round"
						aria-label="Previous"
						disabled={!may}
						onclick={() => act(transport.previous)}>⏮</button
					>
				{/if}
				<button
					class="round big"
					aria-label="Pause"
					disabled={!may}
					onclick={() => act(play?.action)}>❚❚</button
				>
				{#if transport?.kind === 'transport' && transport.next}
					<button
						class="round"
						aria-label="Next"
						disabled={!may}
						onclick={() => act(transport.next)}>⏭</button
					>
				{/if}
				<span class="grow"></span>
				{#if volume?.kind === 'slider'}
					<input
						type="range"
						min={volume.min}
						max={volume.max}
						step={volume.step}
						value={held ?? volume.value}
						disabled={!may}
						aria-label={`${name}, volume`}
						oninput={(e) => (held = Number(e.currentTarget.value))}
						onchange={(e) => {
							const v = Number(e.currentTarget.value);
							held = null;
							void commands.set(device.device_id, view.kind, { volume: v }, device.attributes);
						}}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.art {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: 190px;
		padding: 16px;
		box-sizing: border-box;
		border-radius: var(--feel-card-radius);
		background: var(--surface-2);
		color: #fff;
	}
	.none {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent) 50%, #000),
			color-mix(in srgb, var(--accent) 15%, #000)
		);
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.logo img {
		object-fit: contain;
		padding: 20px 20px 90px;
		box-sizing: border-box;
	}
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 10%, rgba(0, 0, 0, 0.8));
	}
	.where {
		position: absolute;
		top: 12px;
		left: 16px;
		right: 16px;
		display: flex;
		justify-content: space-between;
		padding: 0;
		border: none;
		background: none;
		color: rgba(255, 255, 255, 0.85);
		font: inherit;
		font-size: 12px;
	}
	.what {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	b {
		font-size: 19px;
	}
	.what > span {
		font-size: 13.5px;
		color: rgba(255, 255, 255, 0.8);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 10px;
	}
	.round {
		width: 38px;
		height: 38px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		color: #fff;
	}
	.round.big {
		width: 46px;
		height: 46px;
		background: #fff;
		color: #111;
	}
	.grow {
		flex: 1;
	}
	input[type='range'] {
		width: 110px;
		accent-color: #fff;
	}
</style>
