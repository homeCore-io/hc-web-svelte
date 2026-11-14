<!--
	A door, a lock or a garage door in the Lit look (13 §6.3): drawn as what it
	is, open or shut, locked or not. A lock has Lock and Unlock; a door whose
	card names an Opener has Open and Close, which always ask first.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import type { CardView } from '#lib/card.js';
	import { cardFor, isOpen } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { openDevice } from '#lib/popup.js';

	let {
		device,
		view: v,
		name,
		options = {}
	}: {
		device: CoreDevice;
		view: CardView;
		name: string;
		/** The card's settings on this page: its symbol, its Opener. */
		options?: Record<string, unknown>;
	} = $props();

	const may = $derived(session.mayUse);
	const open = $derived(isOpen(v));
	const isLock = $derived(v.control?.kind === 'lock');
	const locked = $derived(v.control?.kind === 'lock' && v.control.locked);
	// Drawn as an overhead door: a symbol chosen for it wins (Door is a door
	// however it's named); on Automatic its kind, then its name, decide.
	const overhead = $derived.by(() => {
		const chosen = options.symbol;
		if (typeof chosen === 'string' && chosen !== 'auto') return chosen === 'garage';
		return (
			/^(garage|garage_door)$/.test(v.kind) || /\b(garage door|overhead|oh ?\d+)\b/i.test(name)
		);
	});
	const opener = $derived(
		typeof options.opener === 'string' && options.opener !== 'none'
			? devices.byId[options.opener]
			: undefined
	);
	// A lock or opener command that failed says so, as Classic's cards do.
	const note = $derived(
		commands.notes[device.device_id] ?? (opener ? commands.notes[opener.device_id] : undefined)
	);

	async function lock() {
		if (locked && !(await goAhead(device.device_id, v.kind, `Unlock ${name}?`))) return;
		void commands.set(device.device_id, v.kind, { locked: !locked }, device.attributes);
	}
	async function move() {
		const by = opener;
		if (!by) return;
		// The door, not its sensor: "Garage OH1 Door Sensor" asks about "Garage OH1 Door".
		const door = name.replace(/\s+sensor$/i, '');
		// It moves where nobody may be looking: always asked, whatever the house's settings.
		const yes = await ask({
			title: `${open ? 'Close' : 'Open'} ${door}?`,
			body: 'Make sure nothing is in its way.',
			go: open ? 'Close it' : 'Open it',
			stay: 'Not now'
		});
		if (!yes) return;
		if (cardFor(by).kind === 'switch')
			void commands.set(by.device_id, 'switch', { on: by.attributes?.on !== true }, by.attributes);
		else void commands.act(by.device_id, 'activate');
	}
</script>

<div class="door" class:bad={open || (isLock && !locked)}>
	<button
		class="pic"
		aria-label={`${name}: details`}
		onclick={() => openDevice(device.device_id, here.url)}
	>
		{#if isLock}
			<svg
				viewBox="0 0 24 28"
				fill="none"
				stroke-width="1.8"
				stroke-linecap="round"
				aria-hidden="true"
				class:ok={locked}
				><rect x="4" y="12" width="16" height="13" rx="3"></rect><path
					d={locked ? 'M8 12V8a4 4 0 0 1 8 0v4' : 'M8 12V8a4 4 0 0 1 7.5-2'}
				></path></svg
			>
		{:else if overhead}
			<!-- An overhead door: its panels, rolled up when it's open. -->
			<span class="garage" aria-hidden="true"
				><span class="panels" class:open><span></span><span></span><span></span><span></span></span
				></span
			>
		{:else}
			<span class="frame" aria-hidden="true"><span class="leaf" class:open></span></span>
		{/if}
	</button>
	<div class="row">
		<span class="words"><b>{name}</b><small class:note>{note ?? v.stateLine}</small></span>
		{#if isLock && may}
			<button class="pill" class:go={!locked} onclick={lock}>{locked ? 'Unlock' : 'Lock'}</button>
		{:else if opener && may}
			<button class="pill" class:go={open} onclick={move}>{open ? 'Close' : 'Open'}</button>
		{/if}
	</div>
</div>

<style>
	.door {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		border-radius: var(--feel-card-radius);
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--ink);
	}
	.door.bad {
		border-color: color-mix(in srgb, var(--alert) 45%, transparent);
	}
	.pic {
		display: grid;
		place-items: end center;
		height: 64px;
		padding: 0;
		border: none;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--ink);
		overflow: hidden;
	}
	.pic svg {
		width: 34px;
		height: 40px;
		stroke: var(--alert);
		margin-bottom: 10px;
	}
	.pic svg.ok {
		stroke: var(--ok, #6fd39a);
	}
	.frame {
		position: relative;
		width: 30%;
		height: 52px;
		border: 2px solid var(--line);
		border-bottom: none;
		border-radius: 4px 4px 0 0;
	}
	.leaf {
		position: absolute;
		inset: 3px 3px 0;
		border-radius: 3px;
		background: var(--line);
		transform-origin: left;
		transition: transform var(--feel-slow);
	}
	.leaf.open {
		background: var(--accent);
		transform: perspective(200px) rotateY(-60deg);
	}
	.garage {
		position: relative;
		width: 70%;
		height: 52px;
		border: 2px solid var(--line);
		border-bottom: none;
		border-radius: 6px 6px 0 0;
	}
	.panels {
		position: absolute;
		inset: 4px 4px auto;
		height: calc(100% - 4px);
		display: flex;
		flex-direction: column;
		gap: 3px;
		transition: height var(--feel-slow);
	}
	.panels.open {
		height: 14px;
	}
	.panels span {
		flex: 1;
		border-radius: 3px;
		background: var(--line);
	}
	.panels.open span {
		background: var(--accent);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.words {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	small {
		color: var(--ink-muted);
		font-size: 12.5px;
	}
	small.note {
		color: var(--alert);
		font-weight: 600;
	}
	.pill {
		height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.pill.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	@media (max-width: 599px) {
		.door {
			gap: 8px;
			padding: 10px;
			border-radius: 16px;
		}
		.pic {
			height: 56px;
		}
		.frame,
		.garage {
			height: 46px;
		}
		/* The name has the width; the button goes under it. */
		.row {
			flex-direction: column;
			align-items: stretch;
		}
		b {
			font-size: 13px;
		}
	}
</style>
