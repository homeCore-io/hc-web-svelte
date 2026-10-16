<!--
	A device's card, in one of three forms (03 — C1): Compact (one row),
	Standard (icon, name, state line, one control) and Large (Standard plus the
	next most-used controls). What it shows comes from `cardFor`; this only
	draws it, overlays a command still waiting for the house (C8), and sends
	what a control asks for.

	Only visible controls act (D2); tapping anywhere else on the card opens the
	device's details (D3), in the address (N5).
-->
<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Pause from '@lucide/svelte/icons/pause';
	import SkipBack from '@lucide/svelte/icons/skip-back';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import { cardFor, type Control, type Extra } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { page } from '$app/state';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import Icon from './Icon.svelte';
	import Toggle from './Toggle.svelte';

	type Form = 'compact' | 'standard' | 'large';
	let { device, form = 'standard' }: { device: CoreDevice; form?: Form } = $props();

	const card = $derived(
		withPending(cardFor(device, clock.now), commands.pending[device.device_id])
	);
	const note = $derived(commands.notes[device.device_id]);
	const off = $derived(!card.available);

	function set(want: Record<string, unknown>) {
		void commands.set(device.device_id, card.kind, want, device.attributes);
	}

	function run(control: Control) {
		switch (control.kind) {
			case 'lock':
				return set({ locked: !control.locked });
			case 'play':
				return void commands.act(device.device_id, control.action);
			case 'timer':
				return void commands.timer(
					device.device_id,
					control.running
						? { command: 'cancel' }
						: { command: 'start', duration_secs: control.durationSecs }
				);
			case 'button':
				if (control.confirm && !confirm(control.confirm)) return;
				return void commands.act(device.device_id, control.action);
		}
	}

	// A slider follows the finger, and sends once, when it is let go.
	let dragging = $state<Record<string, number>>({});
	function slide(e: Extra & { kind: 'slider' }, value: number) {
		dragging = { ...dragging, [e.attr]: value };
	}
	function release(e: Extra & { kind: 'slider' }, value: number) {
		const rest = { ...dragging };
		delete rest[e.attr];
		dragging = rest;
		set({ [e.attr]: value, ...(e.attr === 'brightness_pct' ? { on: true } : {}) });
	}
</script>

{#snippet control(c: Control | null)}
	{#if c?.kind === 'switch'}
		<Toggle on={c.on} label={card.name} disabled={off} onchange={(on) => set({ [c.attr]: on })} />
	{:else if c?.kind === 'play'}
		<button
			class="round"
			aria-label={c.playing ? `Pause ${card.name}` : `Play ${card.name}`}
			disabled={off}
			onclick={() => run(c)}
		>
			{#if c.playing}<Pause size={18} fill="currentColor" />{:else}<Play
					size={18}
					fill="currentColor"
				/>{/if}
		</button>
	{:else if c}
		<button class="pill" disabled={off} onclick={() => run(c)}>
			{c.kind === 'lock'
				? c.locked
					? 'Unlock'
					: 'Lock'
				: c.kind === 'timer'
					? c.running
						? 'Cancel'
						: 'Start'
					: c.label}
		</button>
	{/if}
{/snippet}

<article
	class="card {form}"
	class:lit={card.tone === 'on'}
	class:alert={card.tone === 'alert'}
	class:offline={off}
	aria-label={card.name}
>
	<a
		class="cover"
		href={deviceHref(device.device_id, page.url)}
		aria-label={`${card.name} — details`}
		onclick={(e) => {
			if (e.metaKey || e.ctrlKey || e.shiftKey) return;
			e.preventDefault();
			openDevice(device.device_id, page.url);
		}}
	></a>
	<div class="top">
		<span class="icon"><Icon name={card.icon} size={form === 'compact' ? 18 : 20} /></span>
		{#if form === 'compact'}
			<span class="text">
				<span class="name">{card.name}</span>
				<span class="state">{note ?? card.stateLine}</span>
			</span>
		{/if}
		{#if card.channels.length === 0}{@render control(card.control)}{/if}
	</div>

	{#if form !== 'compact'}
		<div class="text">
			<span class="name">{card.name}</span>
			<span class="state" class:note>
				{#if card.waiting}<span class="working" aria-label="Waiting for the house"></span>{/if}
				{note ?? card.stateLine}
			</span>
		</div>
	{/if}

	{#if card.channels.length > 0}
		<ul class="channels">
			{#each card.channels as ch (ch.attr)}
				<li>
					<span>{ch.label}</span>
					<Toggle
						on={ch.on}
						label={`${card.name} ${ch.label}`}
						disabled={off}
						onchange={(on) => set({ [ch.attr]: on })}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	{#if form === 'large' && card.extras.length > 0}
		<div class="extras">
			{#each card.extras as e (e.kind + ('attr' in e ? e.attr : ''))}
				{#if e.kind === 'slider'}
					<label class="slider">
						<span>{e.label}</span>
						<input
							type="range"
							min={e.min}
							max={e.max}
							step={e.step}
							value={dragging[e.attr] ?? e.value}
							disabled={off}
							oninput={(ev) => slide(e, Number(ev.currentTarget.value))}
							onchange={(ev) => release(e, Number(ev.currentTarget.value))}
						/>
						<span class="num"
							>{Math.round(dragging[e.attr] ?? e.value)}{e.unit === '%' ? '%' : ''}</span
						>
					</label>
				{:else if e.kind === 'steps'}
					<div class="steps" role="radiogroup" aria-label={e.label}>
						{#each e.options as o (o)}
							<button
								role="radio"
								aria-checked={e.value === o}
								disabled={off}
								onclick={() => set({ [e.attr]: o })}>{o.replace(/[-_]/g, ' ')}</button
							>
						{/each}
					</div>
				{:else if e.kind === 'transport'}
					<div class="transport">
						{#if e.previous}
							<button
								class="round quiet"
								aria-label="Previous"
								disabled={off}
								onclick={() => commands.act(device.device_id, e.previous!)}
								><SkipBack size={18} /></button
							>
						{/if}
						{#if e.next}
							<button
								class="round quiet"
								aria-label="Next"
								disabled={off}
								onclick={() => commands.act(device.device_id, e.next!)}
								><SkipForward size={18} /></button
							>
						{/if}
					</div>
				{:else}
					<p class="reading"><span>{e.label}</span><span class="num">{e.value}</span></p>
				{/if}
			{/each}
		</div>
	{/if}
</article>

<style>
	.card {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 116px;
		padding: 12px 12px 14px 14px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		box-shadow: var(--shadow);
		min-width: 0;
	}
	.cover {
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		z-index: 1;
	}
	.channels,
	.extras {
		position: relative;
		z-index: 2;
	}
	.card.compact {
		min-height: 56px;
		padding: 8px 10px 8px 10px;
		justify-content: center;
	}
	.card.large {
		grid-column: span 2;
	}
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.compact .top {
		align-items: center;
	}
	.compact :global(.toggle),
	.compact .pill,
	.compact .round {
		margin: 0;
	}
	.icon {
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: var(--radius-chip);
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.compact .icon {
		width: 34px;
		height: 34px;
	}
	.lit {
		background: var(--lit-bg);
		border-color: var(--lit-card-line);
	}
	.lit .icon {
		background: var(--fill);
		color: var(--lit-ink);
	}
	.alert {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.alert .icon {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.alert .state {
		color: var(--alert);
		font-weight: 600;
	}
	.offline .icon,
	.offline .name {
		opacity: 0.55;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.compact .text {
		flex: 1;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.25;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow-wrap: anywhere;
	}
	.compact .name {
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}
	.state {
		font-size: 13px;
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lit .state {
		color: var(--lit-ink);
	}
	.state.note {
		color: var(--alert);
		font-weight: 600;
	}
	.working {
		width: 7px;
		height: 7px;
		flex: none;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	.pill {
		position: relative;
		z-index: 2;
		height: var(--target);
		margin: -8px -4px 0 0;
		padding: 0 14px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		font-size: 13px;
		font-weight: 600;
		flex: none;
	}
	.round {
		position: relative;
		z-index: 2;
		width: var(--target);
		height: var(--target);
		margin: -6px -4px 0 0;
		border-radius: 50%;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.round.quiet {
		margin: 0;
		background: var(--surface-2);
		color: var(--ink);
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.channels {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.channels li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 14px;
		min-height: var(--target);
	}
	.channels :global(.toggle) {
		margin: 0;
	}
	.extras {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 2px;
	}
	.slider {
		display: grid;
		grid-template-columns: 76px 1fr 44px;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.slider input {
		width: 100%;
		accent-color: var(--track-on);
		height: var(--target);
		margin: 0;
	}
	.slider .num {
		text-align: right;
		color: var(--ink);
	}
	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.steps button {
		height: 36px;
		padding: 0 12px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 13px;
		font-weight: 600;
		text-transform: capitalize;
	}
	.steps button[aria-checked='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.transport {
		display: flex;
		gap: 8px;
	}
	.reading {
		margin: 0;
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
