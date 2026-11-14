<!--
	Everywhere › Climate (the Everywhere board): every thermostat as a small
	dial with − and +; every fan, turning at its speed, to turn on or off;
	then every temperature and humidity reading in the house, as many across
	as fit (motion sensors and weather stations too, and those with no room
	yet, marked). The readings come last, so in a short window what you control
	stays on screen and the long list scrolls. "Fans off" acts at once.
-->
<script lang="ts">
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { deg } from '#lib/thermostat.js';
	import { units } from '#lib/units.js';
	import EvHead from './EvHead.svelte';
	import ThermoMini from './ThermoMini.svelte';
	import { fanSpeeds, speedLabel, speedWant, spinOf } from './climate.js';
	import { shortName } from './room.js';
	import { apart } from './apart.js';
	import { climateView, working, type Place } from './everywhere.js';

	let { places }: { places: Place[] } = $props();

	const view = $derived(climateView(places, devices.byId));
	const may = $derived(session.mayUse);
	const unit = $derived(units().temperature === 'F' ? '°F' : '°C');
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const nameOf = (d: CoreDevice, room: string) => shortName(d.name_override ?? d.name, room);
	// Two sensors shown with one name (two gateways' "Ch 1") say which is which.
	const readApart = $derived(
		apart(
			view.readings.map((r) => r.reading.device),
			(d) => nameOf(d, view.readings.find((r) => r.reading.device === d)?.where ?? '')
		)
	);
	const roomHref = (p: Place, tab: string) =>
		p.room ? `/rooms/${p.room.id}?tab=${tab}` : undefined;

	// ---- fans ----
	const live = (d: CoreDevice) => ({ ...d, attributes: { ...d.attributes, ...want(d) } });
	const fanOn = (d: CoreDevice) => {
		const s = fanSpeeds(live(d));
		return s ? s.value !== 'off' : live(d).attributes.on === true;
	};
	const speedWord = (d: CoreDevice) => {
		if (!d.available) return 'offline';
		const s = fanSpeeds(live(d));
		return s ? speedLabel(s.value).toLowerCase() : fanOn(d) ? 'on' : 'off';
	};
	const spin = (d: CoreDevice) => {
		const s = fanSpeeds(live(d));
		return s ? spinOf(s) : fanOn(d) ? 1 : 0;
	};
	/** Off; or on as it was, else at its first speed. */
	function fanWant(d: CoreDevice, on: boolean): Record<string, unknown> | undefined {
		const s = fanSpeeds(d);
		if (!on) return s ? speedWant(d, 'off') : { on: false };
		if (d.schema?.attributes.on?.writable) return { on: true };
		const first = s?.options.find((o) => o !== 'off');
		return first ? speedWant(d, first) : undefined;
	}
	function setFan(d: CoreDevice, on: boolean) {
		const w = fanWant(d, on);
		if (w && may && d.available) void commands.set(d.device_id, 'fan', w, d.attributes);
	}
	const fansOn = $derived(view.fans.filter((f) => f.device.available && fanOn(f.device)));
	function allFansOff() {
		for (const f of fansOn) setFan(f.device, false);
	}

	const busy = $derived(view.thermostats.filter((t) => working(t.device)).length);
	const loose = $derived(view.readings.filter((r) => r.where === undefined).length);
	const summary = $derived(
		[
			view.thermostats.length === 1
				? `1 thermostat, ${busy} working`
				: `${view.thermostats.length} thermostats, ${busy} working`,
			view.readings.length === 1
				? '1 temperature sensor'
				: `${view.readings.length} temperature sensors`,
			`${fansOn.length} of ${view.fans.length} fans on`
		].join(' · ')
	);
</script>

<EvHead title="Climate" {summary} glow="#5ab8ff">
	<button
		type="button"
		class="hbtn plain"
		disabled={!may || fansOn.length === 0}
		onclick={allFansOff}>Fans off</button
	>
</EvHead>

<section class="evlist parts" aria-label="Climate in every room">
	{#if view.thermostats.length > 0}
		<h2 class="ch">Thermostats</h2>
		<div class="dials">
			{#each view.thermostats as t (t.device.device_id)}
				<ThermoMini
					device={t.device}
					room={t.place.name}
					href={roomHref(t.place, 'climate')}
					{may}
				/>
			{/each}
		</div>
	{/if}

	{#if view.fans.length > 0}
		<h2 class="ch">Fans</h2>
		<div class="fans">
			{#each view.fans as f (f.device.device_id)}
				{@const d = f.device}
				{@const s = spin(d)}
				{@const on = fanOn(d)}
				<div class="fanrow">
					<svg
						class="fan"
						class:still={s === 0}
						style:--spin={`${s || 1}s`}
						viewBox="0 0 120 120"
						aria-hidden="true"
					>
						<g class="blades">
							<ellipse cx="60" cy="24" rx="12" ry="30" />
							<ellipse cx="60" cy="96" rx="12" ry="30" />
							<ellipse cx="24" cy="60" rx="30" ry="12" />
							<ellipse cx="96" cy="60" rx="30" ry="12" />
						</g>
						<circle cx="60" cy="60" r="12" class="hub" />
					</svg>
					<a class="evname" href={roomHref(f.place, 'climate') ?? '/rooms/none'}
						><b>{f.place.name}</b><small
							>{nameOf(d, f.place.name)} · {commands.notes[d.device_id] ?? speedWord(d)}</small
						></a
					>
					<button
						type="button"
						class="rbtn"
						aria-busy={commands.pending[d.device_id] ? true : undefined}
						disabled={!may || !d.available || fanWant(d, !on) === undefined}
						onclick={() => setFan(d, !on)}>{on ? 'Turn off' : 'Turn on'}</button
					>
				</div>
			{/each}
		</div>
	{/if}

	{#if view.readings.length > 0}
		<h2 class="ch">
			Temperature and humidity<small
				>{view.readings.length} sensors{loose > 0 ? ` · ${loose} with no room yet` : ''}</small
			>
		</h2>
		<div class="temps">
			{#each view.readings as r (r.reading.device.device_id)}
				{@const d = r.reading.device}
				{@const bad = r.reading.state === 'cold' || r.reading.state === 'warm'}
				<div class="trd">
					<a
						class="evname"
						href={roomHref(r.place, 'sensors') ?? `/rooms/none`}
						title={d.name_override ?? d.name}
						><b>{nameOf(d, r.where ?? '')}</b><small class:noroom={r.where === undefined}
							>{r.where ?? 'No room'} · {r.from}{readApart.has(d.device_id)
								? ` · ${readApart.get(d.device_id)}`
								: ''}</small
						></a
					>
					<span class="tval" class:bad class:gone={!d.available}
						>{!d.available
							? 'offline'
							: r.reading.temp !== undefined
								? deg(r.reading.temp, unit)
								: ''}</span
					>
					<span class="hum"
						>{d.available && r.reading.humidity !== undefined
							? `${Math.round(r.reading.humidity)}%`
							: ''}</span
					>
				</div>
			{/each}
		</div>
	{/if}

	{#if view.thermostats.length + view.readings.length + view.fans.length === 0}
		<p class="quiet">No thermostats, fans or temperature sensors in the house yet.</p>
	{/if}
</section>

<style>
	.parts {
		gap: 10px;
	}
	.parts .ch:not(:first-child) {
		margin-top: 10px;
	}
	.dials {
		display: flex;
		flex-wrap: wrap;
		gap: 14px 10px;
	}
	.temps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0 26px;
	}
	.trd {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		height: 40px;
		border-top: 1px solid var(--con-edge);
	}
	.trd .evname {
		flex: 1;
		width: auto;
	}
	.trd .evname b {
		font-size: 12.5px;
	}
	.trd .evname small {
		font-size: 10.5px;
	}
	.trd .evname small.noroom {
		color: var(--warm-ink, #ffc46b);
	}
	.tval {
		width: 52px;
		flex: none;
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.tval.bad {
		color: var(--alert);
	}
	.tval.gone {
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.hum {
		width: 36px;
		flex: none;
		font: 500 12px var(--font-num);
		color: var(--cool-ink, #8fb8e6);
		text-align: right;
	}
	/* The fans share the row's width, so a long name has room instead of empty columns beside it. */
	.fans {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0 22px;
	}
	.fanrow {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 0;
		border-top: 1px solid var(--con-edge);
	}
	.fanrow .evname {
		flex: 1;
		width: auto;
	}
	.fan {
		width: 40px;
		height: 40px;
		flex: none;
	}
	.blades {
		fill: #7fd8ff;
		transform-origin: 60px 60px;
		animation: turn var(--spin) linear infinite;
	}
	.still .blades {
		fill: color-mix(in srgb, var(--ink) 22%, transparent);
		animation: none;
	}
	.hub {
		fill: color-mix(in srgb, var(--ink) 30%, transparent);
	}
	@keyframes turn {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.blades {
			animation: none;
		}
	}
</style>
