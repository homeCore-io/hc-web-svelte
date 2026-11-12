<!--
	What a camera does (the boards' controls): its spotlight as a switch in
	the person's style, its siren, which always asks before it sounds and
	stops at once, and where it can
	turn, a pan and tilt pad with zoom and its saved positions. Each part
	shows only when the camera has it. Every send goes through `commands`.
-->
<script lang="ts">
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import Switch from './Switch.svelte';
	import type { SwitchStyle } from './style.js';
	import type { Cam } from './cameras.js';

	let {
		cam,
		may,
		sw,
		side = false
	}: {
		cam: Cam;
		may: boolean;
		sw: SwitchStyle;
		/** Down the side of a room's tab, rather than in a row under the view. */
		side?: boolean;
	} = $props();

	const spot = $derived(cam.spotlight);
	const siren = $derived(cam.siren);
	const spotOn = $derived(
		spot ? { ...spot.attributes, ...commands.pending[spot.device_id]?.want }.on === true : false
	);
	/** Sounding, as the camera's plugin says, or as asked a moment ago. */
	const sounding = $derived(
		siren ? { ...siren.attributes, ...commands.pending[siren.device_id]?.want }.on === true : false
	);
	const note = $derived(
		[cam.id, spot?.device_id, siren?.device_id]
			.map((id) => (id ? commands.notes[id] : undefined))
			.find((n) => !!n)
	);
	// The position picked last, on this screen.
	let preset = $state<{ cam: string; value: number } | null>(null);

	const setSpot = (on: boolean) => {
		if (spot && may) void commands.set(spot.device_id, 'light', { on }, spot.attributes);
	};
	async function sound() {
		if (!siren || !may) return;
		const yes = await ask({
			title: `Sound the ${cam.name} siren?`,
			body: 'It’s loud, and everyone near the camera hears it. It sounds until you stop it, and stops on its own after a time limit.',
			go: 'Sound it',
			stay: 'Not now',
			danger: true
		});
		if (!yes) return;
		void commands.set(siren.device_id, 'siren', { on: true }, siren.attributes);
	}
	/** Stopping never asks. */
	const stop = () => {
		if (siren && may) void commands.set(siren.device_id, 'siren', { on: false }, siren.attributes);
	};
	const turn = (direction: string) => {
		if (may) void commands.act(cam.id, 'ptz_move', { direction, duration_ms: 400 });
	};
	const goTo = (value: number) => {
		if (!may) return;
		preset = { cam: cam.id, value };
		void commands.act(cam.id, 'goto_preset', { preset: value });
	};
	const off = $derived(!may || !cam.device.available);
</script>

<div class="ctl" class:side>
	{#if spot || siren}
		<div class="grp">
			{#if spot}
				<Switch
					label="Spotlight"
					sub={spot.available ? (spotOn ? 'On' : 'Off') : 'Offline'}
					on={spotOn}
					style={sw}
					disabled={!may || !spot.available}
					waiting={commands.pending[spot.device_id] !== undefined}
					onchange={setSpot}
				/>
			{/if}
			{#if siren}
				{#if sounding}
					<button
						type="button"
						class="siren loud"
						disabled={!may || !siren.available}
						onclick={stop}>Stop the siren</button
					>
				{:else}
					<button type="button" class="siren" disabled={!may || !siren.available} onclick={sound}
						>Sound the siren…</button
					>
				{/if}
			{/if}
			{#if note}<span class="note bad" role="status">{note}</span>{/if}
		</div>
	{/if}
	{#if cam.ptz}
		<div class="ptz" role="group" aria-label={`Turn the ${cam.name}`}>
			<button type="button" class="up" aria-label="Up" disabled={off} onclick={() => turn('up')}
				><ChevronUp size={16} strokeWidth={2.4} aria-hidden="true" /></button
			>
			<button type="button" class="dn" aria-label="Down" disabled={off} onclick={() => turn('down')}
				><ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" /></button
			>
			<button type="button" class="lf" aria-label="Left" disabled={off} onclick={() => turn('left')}
				><ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" /></button
			>
			<button
				type="button"
				class="rt"
				aria-label="Right"
				disabled={off}
				onclick={() => turn('right')}
				><ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" /></button
			>
			<span class="zoom">
				<button type="button" aria-label="Zoom in" disabled={off} onclick={() => turn('zoom_in')}
					><Plus size={13} strokeWidth={2.4} aria-hidden="true" /></button
				>
				<button type="button" aria-label="Zoom out" disabled={off} onclick={() => turn('zoom_out')}
					><Minus size={13} strokeWidth={2.4} aria-hidden="true" /></button
				>
			</span>
		</div>
	{/if}
	{#if cam.presets.length > 0}
		<div class="grp pre">
			<span class="lbl">Positions</span>
			<div class="chips" role="group" aria-label="Saved positions">
				{#each cam.presets as p (p.value)}
					<button
						type="button"
						class:on={preset?.cam === cam.id && preset.value === p.value}
						disabled={off}
						onclick={() => goTo(p.value)}>{p.label}</button
					>
				{/each}
			</div>
			<span class="note">Saved on the camera.</span>
		</div>
	{/if}
</div>

<style>
	.ctl {
		display: flex;
		align-items: center;
		gap: 18px;
		min-width: 0;
	}
	.ctl.side {
		flex-wrap: wrap;
		gap: 12px 14px;
	}
	.grp {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.ctl:not(.side) .grp:first-child {
		flex: none;
	}
	.side .grp:first-child {
		flex: 1 1 100%;
		flex-direction: row;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px 14px;
	}
	.lbl {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.note {
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.note.bad {
		color: var(--alert);
	}
	.siren {
		align-self: flex-start;
		height: 34px;
		padding: 0 13px;
		border: 0;
		border-radius: 10px;
		background: rgba(255, 107, 91, 0.14);
		color: #ffb3a8;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}
	:global(:root[data-theme='light']) .siren {
		color: #b0291a;
	}
	.siren:hover:not(:disabled) {
		background: rgba(255, 107, 91, 0.24);
	}
	/* Sounding: a solid stop that's hard to miss. */
	.siren.loud {
		background: #ff6b5b;
		color: #1a0605;
		box-shadow: 0 0 18px rgba(255, 107, 91, 0.55);
	}
	.siren.loud:hover:not(:disabled) {
		background: #ff8475;
	}
	.siren:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.ptz {
		--pad: clamp(84px, 13vh, 112px);
		position: relative;
		flex: none;
		width: var(--pad);
		height: var(--pad);
		border-radius: 50%;
		background: radial-gradient(
			circle at 50% 40%,
			color-mix(in srgb, var(--ink) 14%, #1a1d26),
			color-mix(in srgb, var(--ink) 4%, #12141a)
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 10px 24px -12px rgba(0, 0, 0, 0.8);
	}
	.side .ptz {
		--pad: clamp(80px, 11vh, 100px);
	}
	.ptz button {
		position: absolute;
		width: 30%;
		height: 30%;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: #c7cdd8;
		cursor: pointer;
	}
	.ptz button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.ptz button:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.ptz button:focus-visible,
	.chips button:focus-visible,
	.siren:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.up {
		left: 35%;
		top: 2%;
	}
	.dn {
		left: 35%;
		bottom: 2%;
	}
	.lf {
		left: 2%;
		top: 35%;
	}
	.rt {
		right: 2%;
		top: 35%;
	}
	.zoom {
		position: absolute;
		left: 33%;
		top: 33%;
		width: 34%;
		height: 34%;
		display: flex;
		flex-direction: column;
		border-radius: 50%;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
	}
	.zoom button {
		position: static;
		width: 100%;
		height: 50%;
		border-radius: 0;
	}
	.pre {
		max-width: 240px;
	}
	.side .pre {
		flex: 1 1 120px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.chips button.on {
		background: color-mix(in srgb, var(--ink) 16%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--ink);
	}
	.chips button:disabled {
		cursor: default;
		opacity: 0.5;
	}
</style>
