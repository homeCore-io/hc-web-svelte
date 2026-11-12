<!--
	A camera large (the boards' viewer): live while it's on screen (Live),
	with its name and how it's playing in the corner, HD where it has a main
	stream, full screen, and on the Cameras page the grid. An event picked
	shows its still here in place of the video, named, with Back to live.
-->
<script lang="ts">
	import Maximize from '@lucide/svelte/icons/maximize';
	import { clock } from '#lib/clock.svelte.js';
	import Live from './Live.svelte';
	import { agoWord, fileUrl, kindName, type Cam, type CamEvent } from './cameras.js';
	import type { Playing } from './mse.js';
	import { stills } from './stills.svelte.js';

	let {
		cam,
		hd = false,
		event,
		onhd,
		onback,
		ongrid
	}: {
		cam: Cam;
		hd?: boolean;
		/** An event's still to show in place of the video. */
		event?: CamEvent;
		onhd?: () => void;
		onback?: () => void;
		/** The Cameras page's Grid. */
		ongrid?: () => void;
	} = $props();

	let box = $state<HTMLElement>();
	let playing = $state<Playing>('paused');
	let gone = $state<string | undefined>(undefined);

	const stream = $derived(hd && cam.hd ? cam.hd : cam.stream);
	const poster = $derived(
		(cam.stream ? stills.shots[cam.stream]?.url : undefined) ??
			(cam.snapshot ? fileUrl(cam.device.plugin_id, cam.snapshot) : undefined)
	);
	const shotUrl = $derived(
		event?.snapshot ? fileUrl(cam.device.plugin_id, event.snapshot) : undefined
	);
	const at = (t: number) =>
		new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	const mode = $derived(
		event
			? `snapshot ${at(event.at)}`
			: !cam.device.available
				? 'offline'
				: stills.video === false || !stream
					? 'no live video here'
					: playing === 'live'
						? `LIVE · ${hd && cam.hd ? 'HD' : 'sub stream'}`
						: playing === 'connecting'
							? 'connecting…'
							: playing === 'lost'
								? 'reconnecting…'
								: playing === 'error'
									? 'the stream isn’t answering'
									: playing === 'unsupported'
										? 'this browser can’t play it'
										: 'snapshot'
	);
	function full() {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void box?.requestFullscreen?.().catch(() => {});
	}
</script>

<div class="cv" bind:this={box}>
	{#if event}
		{#if shotUrl && gone !== shotUrl}
			<img
				class="shot"
				src={shotUrl}
				alt={`${kindName(event.kind)} at the ${cam.name}`}
				onerror={() => (gone = shotUrl)}
			/>
		{:else}
			<p class="none">No still was kept of this one.</p>
		{/if}
		<span class="what">{kindName(event.kind)}</span>
	{:else}
		<Live
			stream={cam.device.available && stills.video !== false ? stream : undefined}
			{poster}
			onstate={(s) => (playing = s)}
		/>
	{/if}
	<div class="ov">
		<span class="dot" class:snap={!!event || playing !== 'live'}></span>{cam.name}<small
			>{mode}</small
		>
	</div>
	<div class="tr">
		{#if cam.hd && !event}
			<button type="button" class="cbtn" class:on={hd} aria-pressed={hd} onclick={onhd}>HD</button>
		{/if}
		{#if ongrid}<button type="button" class="cbtn" onclick={ongrid}>Grid</button>{/if}
		<button type="button" class="cbtn" aria-label="Full screen" title="Full screen" onclick={full}
			><Maximize size={13} strokeWidth={2.2} aria-hidden="true" /></button
		>
	</div>
	{#if event}
		<div class="snapbar">
			<span
				>{kindName(event.kind)} at the {cam.name}<small
					>{at(event.at)}, {agoWord(event.at, clock.now)}</small
				></span
			>
			<button type="button" class="cbtn on" onclick={onback}>Back to live</button>
		</div>
	{/if}
</div>

<style>
	.cv {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 16px;
		overflow: hidden;
		background: #05060a;
		color: #e9ecf2;
		box-shadow:
			0 30px 60px -30px rgba(0, 0, 0, 0.8),
			inset 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	.cv:fullscreen {
		border-radius: 0;
	}
	.shot {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.none {
		position: absolute;
		inset: 0;
		margin: 0;
		display: grid;
		place-items: center;
		color: #9aa2b1;
		font-size: 13px;
	}
	.what {
		position: absolute;
		left: 14px;
		top: 50px;
		padding: 2px 8px;
		border-radius: 6px;
		background: #ffc46b;
		color: #1a0f05;
		font-size: 11px;
		font-weight: 700;
	}
	.ov {
		position: absolute;
		left: 14px;
		top: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: calc(100% - 200px);
		padding: 5px 10px;
		border-radius: 999px;
		background: rgba(5, 6, 10, 0.62);
		backdrop-filter: blur(10px);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ov small {
		color: #9aa2b1;
		font-size: 12px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff4d4d;
		box-shadow: 0 0 10px #ff4d4d;
		animation: blink 1.6s infinite;
	}
	.dot.snap {
		background: #ffc46b;
		box-shadow: 0 0 10px #ffc46b;
		animation: none;
	}
	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
	.tr {
		position: absolute;
		right: 12px;
		top: 10px;
		display: flex;
		gap: 6px;
	}
	.cbtn {
		height: 30px;
		padding: 0 11px;
		border: 0;
		border-radius: 9px;
		background: rgba(5, 6, 10, 0.62);
		backdrop-filter: blur(10px);
		color: #e9ecf2;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.cbtn:hover {
		background: rgba(30, 32, 40, 0.85);
	}
	.cbtn.on {
		background: #ffc46b;
		color: #1a0f05;
	}
	.cbtn.on:hover {
		background: #ffd48a;
	}
	.cbtn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.snapbar {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		background: linear-gradient(0deg, rgba(5, 6, 10, 0.85), transparent);
		font-size: 13px;
		font-weight: 600;
	}
	.snapbar small {
		margin-left: 10px;
		color: #aab1be;
		font-weight: 500;
	}
</style>
