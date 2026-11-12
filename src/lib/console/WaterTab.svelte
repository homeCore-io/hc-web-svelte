<!--
	A room's Water tab in the console (the Garage board): each leak sensor,
	a drop that fills when it finds water, and each valve, its handle across
	the pipe when shut (water.ts). Shutting the water off goes at once;
	turning it back on asks first. Sized to the window (`fit`).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { unitOf } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { batteryOf } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import { deg } from '#lib/thermostat.js';
	import { shownUnit, toShown } from '#lib/units.js';
	import Col from './Col.svelte';
	import { fit } from './fit.js';
	import SwitchSet from './SwitchSet.svelte';
	import { setTitle } from './switches.js';
	import { shortName } from './room.js';
	import { valveOpen, valveWant, waterTab, wet } from './water.js';

	let { list, room, may }: { list: CoreDevice[]; room: string; may: boolean } = $props();

	const tab = $derived(waterTab(list));
	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const anyWet = $derived(tab.leaks.some((d) => d.available && wet(d)));

	/** Under the drop: its battery and the temperature at it, where it says. */
	function about(d: CoreDevice): string {
		const parts: string[] = [];
		const b = batteryOf(d);
		if (b !== undefined) parts.push(`battery ${Math.round(b)}%`);
		const t = d.attributes.temperature;
		if (typeof t === 'number') {
			const unit = unitOf(d, 'temperature') ?? '°C';
			parts.push(`${deg(toShown(t, unit), shownUnit(unit) ?? '°')} at the sensor`);
		}
		if (d.attributes.freeze_warning === true) parts.push('freezing');
		return parts.join(' · ');
	}

	async function setValve(d: CoreDevice, on: boolean) {
		if (!may || !d.available) return;
		if (on) {
			const yes = await ask({
				title: `Turn the water on at ${nameOf(d)}?`,
				body: anyWet ? 'A leak sensor here still finds water.' : undefined,
				go: 'Turn on',
				stay: 'Not now'
			});
			if (!yes) return;
		}
		void commands.set(d.device_id, 'valve', valveWant(d, on), d.attributes);
	}
</script>

<div class="desk" use:fit={tab}>
	{#each tab.leaks as d (d.device_id)}
		{@const isWet = d.available && wet(d)}
		<Col
			title={nameOf(d)}
			plugin={d.plugin_id}
			note={d.available ? undefined : 'Offline'}
			alert
			width="calc(190px + 70px * var(--k, 1))"
			onopen={() => open(d)}
			place={d}
		>
			<div class="drop">
				<svg viewBox="0 0 80 100" class:wet={isWet} aria-hidden="true">
					<path d="M40 6 C40 6 10 44 10 64 a30 30 0 0 0 60 0 C70 44 40 6 40 6z" />
				</svg>
				<div>
					<b class:wet={isWet}>{!d.available ? 'Offline' : isWet ? 'Water!' : 'Dry'}</b>
					<small>{about(d)}</small>
				</div>
			</div>
		</Col>
	{/each}

	{#each tab.valves as d (d.device_id)}
		{@const on = valveOpen(d, want(d))}
		<Col
			title={nameOf(d)}
			plugin={d.plugin_id}
			note={commands.notes[d.device_id] ?? (d.available ? undefined : 'Offline')}
			alert
			width="calc(200px + 90px * var(--k, 1))"
			onopen={() => open(d)}
			place={d}
		>
			<svg class="valve" class:on viewBox="0 0 160 90" aria-hidden="true">
				<rect class="pipe" x="0" y="34" width="160" height="22" rx="4" />
				<rect class="flow" x="0" y="38" width="160" height="14" rx="3" />
				<circle class="wheel" cx="80" cy="45" r="22" />
				<rect class="handle" x="62" y="41" width="36" height="8" rx="4" />
			</svg>
			<div class="state">
				<b class:shut={!on}>{d.available ? (on ? 'Open' : 'Closed') : 'Offline'}</b>
				<button
					type="button"
					class="dbtn"
					class:close={on}
					aria-busy={waiting(d) || undefined}
					disabled={!may || !d.available}
					onclick={() => setValve(d, !on)}>{on ? 'Shut off water' : 'Turn water on'}</button
				>
			</div>
			{#if anyWet}
				<span class="sub alert"
					>{on ? 'A sensor here finds water.' : 'Shut while a sensor here finds water.'}</span
				>
			{/if}
		</Col>
	{/each}

	{#if tab.other.length > 0}
		<Col title={setTitle(tab.other)} grow>
			<SwitchSet list={tab.other} {room} {may} />
		</Col>
	{/if}
</div>

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
	}
	.drop {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.drop svg {
		flex: none;
		width: calc(48px + 16px * var(--k, 1));
		height: auto;
	}
	.drop path {
		fill: #14202e;
		stroke: #2c4a66;
		stroke-width: 3;
		transition: fill 0.4s;
	}
	.drop svg.wet path {
		fill: #3a8cff;
		stroke: #9fe4ff;
	}
	:global(:root[data-theme='light']) .drop path {
		fill: #dbe7f3;
		stroke: #8fb0cf;
	}
	.drop b {
		display: block;
		font-size: calc(26px + 8px * var(--k, 1));
		font-weight: 700;
		letter-spacing: -0.02em;
		color: color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink));
	}
	.drop b.wet {
		color: #6fb6ff;
	}
	.drop small,
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.sub.alert {
		color: var(--alert);
	}
	.valve {
		width: calc(120px + 40px * var(--k, 1));
		height: auto;
	}
	.pipe {
		fill: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	:global(:root[data-theme='light']) .pipe {
		fill: #cfcac0;
	}
	.flow {
		fill: #3a8cff;
		opacity: 0;
		transition: opacity 0.4s;
	}
	.valve.on .flow {
		opacity: 0.8;
	}
	.wheel {
		fill: #2a2e38;
		stroke: #3a3f4b;
		stroke-width: 3;
	}
	.handle {
		fill: #ff6b5b;
		transform-box: view-box;
		transform-origin: 80px 45px;
		transform: rotate(90deg);
		transition: transform 0.5s;
	}
	.valve.on .handle {
		fill: #4fe0a0;
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.handle {
			transition: none;
		}
	}
	.state {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.state b {
		font-size: calc(18px + 4px * var(--k, 1));
		font-weight: 700;
		color: color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink));
	}
	.state b.shut {
		color: #ffb38a;
	}
	:global(:root[data-theme='light']) .state b.shut {
		color: #b4471c;
	}
	.dbtn {
		height: calc(36px + 8px * var(--k, 1));
		padding: 0 16px;
		border: 0;
		border-radius: 12px;
		font: 700 13.5px var(--font);
		cursor: pointer;
		color: #1d1006;
		background: linear-gradient(180deg, #ffd28a, #ffb35c);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 8px 18px -8px rgba(255, 170, 80, 0.7);
	}
	.dbtn.close {
		color: #fff;
		background: linear-gradient(180deg, #ff7d6b, #e5483a);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.35),
			0 8px 18px -8px rgba(255, 90, 70, 0.8);
	}
	.dbtn:disabled {
		cursor: default;
		opacity: 0.45;
		box-shadow: none;
	}
	.dbtn[aria-busy='true'] {
		opacity: 0.65;
	}
	.dbtn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
