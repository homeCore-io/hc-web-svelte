<!--
	A room's Climate tab in the console (the Garage, Office and FamilyRoom
	boards): what sets the room's air (climate.ts). Each thermostat with its
	ring and the switch it runs; each fan, turning at its speed, with its
	speeds to choose; then the switches named for a heater or humidifier.
	Readings stay in Sensors. Sized to the window (`fit`), so it doesn't scroll.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Col from './Col.svelte';
	import Fader from './Fader.svelte';
	import Switch from './Switch.svelte';
	import Thermo from './Thermo.svelte';
	import { fit } from './fit.js';
	import { climateTab, fanSpeeds, speedLabel, speedWant, spinOf } from './climate.js';
	import { shortName } from './room.js';
	import type { FaderStyle, SwitchStyle } from './style.js';

	let {
		list,
		room,
		fader,
		sw,
		may
	}: {
		list: CoreDevice[];
		room: string;
		fader: FaderStyle;
		sw: SwitchStyle;
		may: boolean;
	} = $props();

	const tab = $derived(climateTab(list, devices.byId));
	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const isOn = (d: CoreDevice) => ({ ...d.attributes, ...want(d) }).on === true;
	const canSwitch = (d: CoreDevice) => d.schema?.attributes.on?.writable === true;

	// The switch a thermostat runs gets its own column while there's room across.
	const across = $derived(
		tab.thermostats.reduce((n, t) => n + (t.runs ? 2 : 1), 0) +
			tab.fans.length +
			(tab.switches.length > 0 ? 1 : 0)
	);
	const apart = $derived(across <= 4);

	// ---- fans ----
	const speedsOf = (d: CoreDevice) => {
		const s = fanSpeeds({ ...d, attributes: { ...d.attributes, ...want(d) } });
		return s;
	};
	const pct = (d: CoreDevice) => {
		const a = { ...d.attributes, ...want(d) };
		return a.on === false ? 0 : typeof a.speed_pct === 'number' ? Math.round(a.speed_pct) : 0;
	};
	const setSpeed = (d: CoreDevice, o: string) =>
		void commands.set(d.device_id, 'fan', speedWant(d, o), d.attributes);
	const setPct = (d: CoreDevice, v: number) =>
		void commands.set(
			d.device_id,
			'fan',
			v <= 0 ? { on: false } : { on: true, speed_pct: v },
			d.attributes
		);
	const setOn = (d: CoreDevice, on: boolean) =>
		void commands.set(d.device_id, 'switch', { on }, d.attributes);
</script>

<div class="desk" use:fit={tab}>
	{#each tab.thermostats as t (t.device.device_id)}
		<Thermo device={t.device} runs={t.runs} {room} {may} {apart} />
	{/each}

	{#each tab.fans as f (f.device_id)}
		{@const speeds = speedsOf(f)}
		{@const spin = speeds ? spinOf(speeds) : isOn(f) ? 1 : 0}
		{@const c = cardFor(f, clock.now)}
		<Col
			title={nameOf(f)}
			plugin={f.plugin_id}
			note={commands.notes[f.device_id] ?? (f.available ? c.stateLine : 'offline')}
			alert={!!commands.notes[f.device_id] || !f.available}
			width="calc(190px + 70px * var(--k, 1))"
			onopen={() => open(f)}
		>
			<svg
				class="fan"
				class:still={spin === 0}
				style:--spin={`${spin || 1}s`}
				viewBox="0 0 120 120"
				aria-hidden="true"
			>
				<circle cx="60" cy="60" r="58" class="halo" class:on={spin > 0} />
				<g class="blades">
					<ellipse cx="60" cy="24" rx="12" ry="30" />
					<ellipse cx="60" cy="96" rx="12" ry="30" />
					<ellipse cx="24" cy="60" rx="30" ry="12" />
					<ellipse cx="96" cy="60" rx="30" ry="12" />
				</g>
				<circle cx="60" cy="60" r="12" class="hub" />
			</svg>
			{#if speeds}
				<div
					class="speeds"
					role="radiogroup"
					aria-label={`${nameOf(f)} speed`}
					style:--n={speeds.options.length}
				>
					{#each speeds.options as o (o)}
						<button
							type="button"
							role="radio"
							aria-checked={speeds.value === o}
							class:on={speeds.value === o}
							class:waiting={waiting(f) && speeds.value === o}
							disabled={!may || !f.available}
							onclick={() => setSpeed(f, o)}>{speedLabel(o)}</button
						>
					{/each}
				</div>
			{:else if f.schema?.attributes.speed_pct?.writable}
				<Fader
					label={nameOf(f)}
					value={pct(f)}
					style={fader}
					height={110}
					disabled={!may || !f.available}
					waiting={waiting(f)}
					oncommit={(v) => setPct(f, v)}
				/>
			{:else if canSwitch(f)}
				<Switch
					label={nameOf(f)}
					on={isOn(f)}
					style={sw}
					disabled={!may || !f.available}
					waiting={waiting(f)}
					onchange={(v) => setOn(f, v)}
				/>
			{/if}
		</Col>
	{/each}

	{#if tab.switches.length > 0}
		<Col title="Switches" grow>
			<div class="rows">
				{#each tab.switches as s (s.device_id)}
					{#if canSwitch(s)}
						<Switch
							label={nameOf(s)}
							sub={s.available ? undefined : 'Offline'}
							on={isOn(s)}
							style={sw}
							disabled={!may || !s.available}
							waiting={waiting(s)}
							onchange={(v) => setOn(s, v)}
						/>
					{:else}
						<button type="button" class="plain" onclick={() => open(s)}
							>{nameOf(s)}<small>{cardFor(s, clock.now).stateLine}</small></button
						>
					{/if}
					{#if commands.notes[s.device_id]}<span class="warn" role="status"
							>{commands.notes[s.device_id]}</span
						>{/if}
				{/each}
			</div>
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
	.fan {
		width: calc(76px + 54px * var(--k, 1));
		height: calc(76px + 54px * var(--k, 1));
	}
	.halo {
		fill: color-mix(in srgb, var(--ink) 4%, transparent);
	}
	.halo.on {
		fill: rgba(127, 184, 255, 0.12);
	}
	.blades {
		fill: color-mix(in srgb, var(--ink) 30%, transparent);
		transform-box: fill-box;
		transform-origin: center;
		animation: spin var(--spin) linear infinite;
	}
	.still .blades {
		animation: none;
	}
	.hub {
		fill: #4a4f5c;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.blades {
			animation: none;
		}
	}
	.speeds {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 2px;
		padding: 4px;
		border-radius: 14px;
		background: linear-gradient(180deg, #0c0d11, #17191f);
		box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8);
	}
	:global(:root[data-theme='light']) .speeds {
		background: linear-gradient(180deg, #cfcac0, #e6e2d9);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}
	.speeds button {
		height: calc(32px + 10px * var(--k, 1));
		padding: 0 2px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--ink-muted);
		font: 700 11.5px var(--font);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.speeds button.on {
		background: linear-gradient(180deg, #9fe4ff, #5ab8ff);
		color: #06202c;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 0 20px rgba(90, 184, 255, 0.45);
	}
	.speeds button.waiting {
		opacity: 0.7;
	}
	.speeds button:disabled {
		cursor: default;
	}
	.speeds button:disabled:not(.on) {
		opacity: 0.5;
	}
	.speeds button:focus-visible,
	.plain:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: calc(6px + 6px * var(--k, 1));
	}
	.plain {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		text-align: left;
		cursor: pointer;
	}
	.plain small {
		display: block;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.warn {
		font-size: 11.5px;
		color: var(--alert);
	}
</style>
