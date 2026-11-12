<!--
	A timer as a small clock (timer.ts): the time it has left in large figures,
	counting down each second while it runs, else "idle" or "done" dimmed; its
	name under it; and Start or Cancel. Several sit side by side and wrap. The
	name opens the timer's page.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { openDevice } from '#lib/popup.js';
	import { timerView } from './timer.js';

	let { d, name, may }: { d: CoreDevice; name: string; may: boolean } = $props();

	const view = $derived(timerView(d, clock.now));
	// While it runs, the clock moves every second.
	$effect(() => {
		if (view.running) return clock.hold();
	});
	let busy = $state(false);
	const note = $derived(d.available ? (commands.notes[d.device_id] ?? view.note) : 'Offline');

	async function press() {
		const p = view.press;
		if (!p || !may || !d.available || busy) return;
		if (!(await goAhead(d.device_id, 'timer', `${p.label} ${name}?`))) return;
		busy = true;
		if ('command' in p) await commands.timer(d.device_id, p.command);
		else await commands.act(d.device_id, p.action);
		busy = false;
	}
</script>

<div class="tile" class:run={view.running && d.available}>
	<b class="fig" class:dim={view.dim || !d.available}>{view.figure}</b>
	<button type="button" class="nm" onclick={() => openDevice(d.device_id, page.url)}
		>{name}{#if note}<small class:bad={!d.available || !!commands.notes[d.device_id]}>{note}</small
			>{/if}</button
	>
	{#if view.press}
		<button
			type="button"
			class="tb"
			class:stop={view.press.label === 'Cancel'}
			aria-busy={busy || undefined}
			disabled={!may || !d.available || busy}
			onclick={press}>{view.press.label}</button
		>
	{/if}
</div>

<style>
	.tile {
		box-sizing: border-box;
		width: calc(140px + 8px * var(--k, 1));
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(2px + 3px * var(--k, 1));
		padding: calc(8px + 4px * var(--k, 1)) 12px;
		border-radius: 14px;
		background: var(--con-raise, color-mix(in srgb, var(--ink) 7%, transparent));
		box-shadow: inset 0 0 0 1px var(--con-edge);
	}
	.tile.run {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, #ffc46b 45%, transparent);
	}
	.fig {
		font-family: var(--font-num);
		font-size: calc(22px + 6px * var(--k, 1));
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.fig.dim {
		color: var(--ink-muted);
		opacity: 0.7;
	}
	.nm {
		max-width: 100%;
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: 500 12px var(--font);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm:hover {
		text-decoration: underline;
	}
	.nm small {
		display: block;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.nm small.bad {
		color: var(--alert);
	}
	.tb {
		margin-top: 2px;
		height: 26px;
		padding: 0 12px;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
		font: 600 12px var(--font);
		cursor: pointer;
	}
	.tb.stop {
		background: none;
		box-shadow: inset 0 0 0 1px
			var(--con-edge-strong, color-mix(in srgb, var(--ink) 18%, transparent));
	}
	.tb:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 18%, transparent);
	}
	.tb:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.nm:focus-visible,
	.tb:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
