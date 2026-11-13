<!--
	Everywhere › Water (the Everywhere board): a sensor finding water comes
	first, as a pill that shuts the water off; then every valve, its handle
	across the pipe when shut, with Shut off or Turn water on; then every leak
	sensor, room by room. Shutting one valve off goes at once and turning it
	back on asks, as in its room's Water tab; "Shut off all water" asks first.
-->
<script lang="ts">
	import Droplet from '@lucide/svelte/icons/droplet';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import EvHead from './EvHead.svelte';
	import { shortName } from './room.js';
	import { valveOpen, valveWant, wet } from './water.js';
	import { openValves, waterView, type Place } from './everywhere.js';

	let { places }: { places: Place[] } = $props();

	const view = $derived(waterView(places));
	const open = $derived(openValves(view, commands.pending));
	const may = $derived(session.mayUse);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const nameOf = (d: CoreDevice, p: Place) =>
		shortName((d.name_override ?? d.name).replace(/\s+sensor$/i, ''), p.room ? p.name : '');
	const sensors = $derived(view.leaks.reduce((n, r) => n + r.sensors.length, 0));

	const summary = $derived(
		[
			view.wet.length === 0 ? 'All dry' : `${view.wet.length} leaking`,
			...(sensors > 0 ? [`${sensors - view.wet.length} of ${sensors} leak sensors dry`] : []),
			...(view.valves.length > 0
				? [
						view.valves.length === 1
							? `the valve is ${open.length ? 'open' : 'shut'}`
							: `${open.length} of ${view.valves.length} valves open`
					]
				: [])
		].join(' · ')
	);

	async function setValve(d: CoreDevice, p: Place, on: boolean) {
		if (!may || !d.available) return;
		if (on) {
			const leaking = view.wet.some((w) => w.place.key === p.key);
			const yes = await ask({
				title: `Turn the water on at ${nameOf(d, p)}?`,
				body: leaking ? `A leak sensor in ${p.name} still finds water.` : undefined,
				go: 'Turn on',
				stay: 'Not now'
			});
			if (!yes) return;
		}
		void commands.set(d.device_id, 'valve', valveWant(d, on), d.attributes);
	}
	async function shutAll() {
		if (open.length === 0) return;
		const yes = await ask({
			title: 'Shut off all water?',
			body:
				open.length === 1
					? `${nameOf(open[0]!.device, open[0]!.place)} shuts, and no water comes into the house until it's turned back on.`
					: `All ${open.length} valves shut, and no water comes in until they're turned back on.`,
			go: 'Shut off',
			stay: 'Not now'
		});
		if (!yes) return;
		for (const v of open)
			void commands.set(
				v.device.device_id,
				'valve',
				valveWant(v.device, false),
				v.device.attributes
			);
	}
</script>

<EvHead title="Water" {summary} glow="#3a8cff">
	<button type="button" class="hbtn" disabled={!may || open.length === 0} onclick={shutAll}
		>Shut off all water</button
	>
</EvHead>

<section class="evlist" aria-label="Water in every room">
	{#if view.wet.length > 0}
		<div class="issues" role="group" aria-label="Finding water">
			{#each view.wet as w (w.device.device_id)}
				<button
					type="button"
					class="ipill wet"
					disabled={!may || open.length === 0}
					onclick={shutAll}
					><i aria-hidden="true"></i>{w.place.name}: {nameOf(w.device, w.place)} found water<b
						>{open.length > 0 ? 'Shut off water' : 'Water is off'}</b
					></button
				>
			{/each}
		</div>
	{/if}

	{#if view.valves.length > 0}
		<h2 class="ch">Valves</h2>
		{#each view.valves as v (v.device.device_id)}
			{@const d = v.device}
			{@const on = valveOpen(d, want(d))}
			<div class="evrow valve">
				<svg class="pipe" class:on viewBox="0 0 160 90" aria-hidden="true">
					<rect class="tube" x="0" y="34" width="160" height="22" rx="4" />
					<rect class="flow" x="0" y="38" width="160" height="14" rx="3" />
					<circle class="wheel" cx="80" cy="45" r="22" />
					<rect class="handle" x="62" y="41" width="36" height="8" rx="4" />
				</svg>
				{#if v.place.room}
					<a class="evname wide" href={`/rooms/${v.place.room.id}?tab=water`}
						><b>{nameOf(d, v.place)}</b><small>{v.place.name}</small></a
					>
				{:else}
					<div class="evname wide"><b>{nameOf(d, v.place)}</b><small>{v.place.name}</small></div>
				{/if}
				<b class="word" class:shut={d.available && !on}
					>{commands.notes[d.device_id] ??
						(!d.available ? 'Offline' : on ? 'Open · water on' : 'Shut · water off')}</b
				>
				<button
					type="button"
					class="rbtn"
					class:close={on}
					aria-busy={commands.pending[d.device_id] ? true : undefined}
					disabled={!may || !d.available}
					onclick={() => setValve(d, v.place, !on)}
					>{on ? 'Shut off water' : 'Turn water on'}</button
				>
			</div>
		{/each}
	{/if}

	{#if view.leaks.length > 0}
		<h2 class="ch later">Leak sensors</h2>
		{#each view.leaks as r (r.place.key)}
			<div class="evrow">
				{#if r.place.room}
					<a class="evname" href={`/rooms/${r.place.room.id}?tab=water`}><b>{r.place.name}</b></a>
				{:else}
					<div class="evname"><b>{r.place.name}</b></div>
				{/if}
				<div class="pills">
					{#each r.sensors as d (d.device_id)}
						{@const isWet = d.available && wet(d)}
						<span
							class="spill"
							class:wet={isWet}
							class:ok={d.available && !isWet}
							class:bad={!d.available}
							><Droplet size={13} strokeWidth={2.4} aria-hidden="true" />{nameOf(d, r.place)}: {!d.available
								? 'Offline'
								: isWet
									? 'Water!'
									: 'Dry'}</span
						>
					{/each}
				</div>
			</div>
		{/each}
	{/if}

	{#if view.valves.length === 0 && view.leaks.length === 0}
		<p class="quiet">No leak sensors or water valves in the house yet.</p>
	{/if}
</section>

<style>
	.later {
		margin-top: 14px;
	}
	.valve {
		min-height: 64px;
	}
	.pipe {
		width: 80px;
		height: 45px;
		flex: none;
	}
	.tube {
		fill: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.flow {
		fill: #3a8cff;
		opacity: 0;
		transition: opacity 0.3s;
	}
	.pipe.on .flow {
		opacity: 0.8;
	}
	.wheel {
		fill: #2a2e38;
		stroke: #3a3f4b;
		stroke-width: 3;
	}
	.handle {
		fill: #ff6b5b;
		transform: rotate(90deg);
		transform-origin: 80px 45px;
		transition: transform 0.3s;
	}
	.pipe.on .handle {
		fill: #4fe0a0;
		transform: none;
	}
	.wide {
		width: 220px;
	}
	.word {
		flex: 1;
		min-width: 0;
		font-size: 16px;
		font-weight: 700;
		color: #8fbfff;
	}
	.word.shut {
		color: #ffb38a;
	}
	/* On a phone: the pipe and its name, then how it is and its button. */
	:global(.ev.phone) .valve {
		display: grid;
		grid-template-columns: 80px minmax(0, 1fr);
		grid-template-areas:
			'pipe name'
			'word btn';
		gap: 6px 12px;
		align-items: center;
	}
	:global(.ev.phone) .pipe {
		grid-area: pipe;
	}
	:global(.ev.phone) .wide {
		grid-area: name;
		width: auto;
	}
	:global(.ev.phone) .word {
		grid-area: word;
		font-size: 14px;
	}
	:global(.ev.phone) .rbtn {
		grid-area: btn;
		justify-self: end;
	}
	.rbtn.close {
		background: color-mix(in srgb, var(--alert) 85%, transparent);
		color: var(--alert-ink);
	}
	.rbtn.close:hover:not(:disabled) {
		background: var(--alert);
	}
</style>
