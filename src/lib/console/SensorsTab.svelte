<!--
	A room's Sensors tab in the console (the Garage, Office and FamilyRoom
	boards): each temperature as a big number, with humidity and the sensor's
	own limits where it keeps them; what's being watched (motion, occupancy,
	vibration) as rows; and every battery in the room (sensors.ts). Nothing
	here is switched. Sized to the window (`fit`).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { batteriesOf } from '#lib/batteries.js';
	import { openDevice } from '#lib/popup.js';
	import { deg } from '#lib/thermostat.js';
	import { units } from '#lib/units.js';
	import Col from './Col.svelte';
	import Row from './Row.svelte';
	import Place from './Place.svelte';
	import { fit } from './fit.js';
	import SwitchSet from './SwitchSet.svelte';
	import { setsWithSwitches, setTitle } from './switches.js';
	import { brandOf, shortName } from './room.js';
	import { between, sensorsTab, type Reading } from './sensors.js';

	let {
		list,
		all,
		room
	}: {
		list: CoreDevice[];
		/** Every device in the room, for its batteries. */
		all: CoreDevice[];
		room: string;
	} = $props();

	const tab = $derived(sensorsTab(list));
	// A switch or timer the household put here sits as it would with the switches.
	const switched = $derived(tab.watch.filter(setsWithSwitches));
	const watched = $derived(tab.watch.filter((d) => !switched.includes(d)));
	const unit = $derived(units().temperature === 'F' ? '°F' : '°C');
	const batteries = $derived(batteriesOf(all));
	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const byId = $derived(new Map(all.map((d) => [d.device_id, d])));
	// Up to two readings get a column each; more share one, as tiles.
	const tiles = $derived(tab.readings.length > 2);

	const limitWords = (r: Reading) =>
		r.state === 'cold'
			? 'Below its limit'
			: r.state === 'warm'
				? 'Above its limit'
				: r.state === 'ok'
					? 'Within its limits'
					: undefined;
	const card = (d: CoreDevice) => cardFor(d, clock.now);
	const dotOf = (d: CoreDevice): 'quiet' | 'busy' | 'alert' =>
		!d.available || card(d).tone === 'alert' ? 'alert' : card(d).tone === 'on' ? 'busy' : 'quiet';
</script>

{#snippet reading(r: Reading, small: boolean)}
	{@const at = between(r)}
	{@const words = limitWords(r)}
	<div class="reads" class:small>
		{#if r.temp !== undefined}
			<div>
				<small>Temperature</small><b>{r.device.available ? deg(r.temp, unit) : '–'}</b>
			</div>
		{/if}
		{#if r.humidity !== undefined}
			<div>
				<small>Humidity</small><b>{r.device.available ? `${Math.round(r.humidity)}%` : '–'}</b>
			</div>
		{/if}
	</div>
	{#if at !== undefined}
		<div
			class="range"
			role="img"
			aria-label={`${deg(r.temp!, unit)}, its limits ${deg(r.low!, unit)} to ${deg(r.high!, unit)}`}
		>
			<i style:left={`${Math.round(at * 100)}%`}></i>
		</div>
	{/if}
	{#if !r.device.available}
		<div class="ok"><span class="dot bad" aria-hidden="true"></span>Offline</div>
	{:else if words}
		<div class="ok">
			<span class="dot" class:bad={r.state !== 'ok'} aria-hidden="true"></span>{words}
			{#if r.low !== undefined && r.high !== undefined}<span class="lim"
					>{deg(r.low, unit)} to {deg(r.high, unit)}</span
				>{/if}
		</div>
	{/if}
{/snippet}

<div class="desk" use:fit={tab}>
	{#if tiles}
		<Col title="Readings" flex="1 1 400px">
			<div class="tiles">
				{#each tab.readings as r (r.device.device_id)}
					<div class="tw">
						<button type="button" class="tile" onclick={() => open(r.device)}>
							<span class="tn"
								><span class="tag">{brandOf(r.device.plugin_id)}</span>{nameOf(r.device)}</span
							>
							{@render reading(r, true)}
						</button>
						<Place d={r.device} corner />
					</div>
				{/each}
			</div>
		</Col>
	{:else}
		{#each tab.readings as r (r.device.device_id)}
			<Col
				title={nameOf(r.device)}
				plugin={r.device.plugin_id}
				width="calc(200px + 50px * var(--k, 1))"
				onopen={() => open(r.device)}
				place={r.device}
			>
				{@render reading(r, false)}
			</Col>
		{/each}
	{/if}

	{#if watched.length > 0}
		<Col title="Watching" width="calc(200px + 50px * var(--k, 1))">
			<div class="list">
				{#each watched as d (d.device_id)}
					<Row
						name={nameOf(d)}
						sub={brandOf(d.plugin_id)}
						dot={dotOf(d)}
						word={card(d).stateLine.split(' · ')[0]}
						onopen={() => open(d)}
						place={d}
					/>
				{/each}
			</div>
		</Col>
	{/if}

	{#if switched.length > 0}
		<Col title={setTitle(switched)} width="calc(230px + 60px * var(--k, 1))">
			<SwitchSet list={switched} {room} may={session.mayUse} />
		</Col>
	{/if}

	{#if batteries.length > 0}
		<Col title="Batteries" flex="0 0 auto">
			<div class="batts" class:two={batteries.length > 12}>
				{#each batteries as b (b.id)}
					{@const d = byId.get(b.id)}
					<button type="button" class="batt" onclick={() => d && open(d)}>
						<span class="bn" title={d ? nameOf(d) : b.name}>{d ? nameOf(d) : b.name}</span>
						<span class="cell" class:low={b.low} aria-hidden="true"
							><i style:width={`${b.pct}%`}></i></span
						>
						<span class="pct" class:low={b.low}>{b.pct}%</span>
					</button>
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
	.reads {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.reads small {
		display: block;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.reads b {
		font-size: calc(28px + 10px * var(--k, 1));
		font-weight: 700;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.reads.small b {
		font-size: calc(22px + 8px * var(--k, 1));
	}
	.range {
		position: relative;
		height: 10px;
		margin: 4px 0;
		border-radius: 5px;
		background: linear-gradient(90deg, #3a8cff, #9fe4ff 50%, #ffb35c);
	}
	.range i {
		position: absolute;
		top: -4px;
		width: 6px;
		height: 18px;
		margin-left: -3px;
		border-radius: 3px;
		background: #fff;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
	}
	:global(:root[data-theme='light']) .range i {
		background: #1b1d22;
		box-shadow: none;
	}
	.ok {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		font-size: 12.5px;
		color: var(--ink);
	}
	.lim {
		margin-left: auto;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--good, #4fe0a0);
		box-shadow: 0 0 8px var(--good, #4fe0a0);
	}
	.dot.bad {
		background: var(--alert);
		box-shadow: 0 0 8px var(--alert);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 10px;
	}
	.tw {
		position: relative;
		display: flex;
	}
	.tile {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: calc(4px + 4px * var(--k, 1));
		padding: calc(8px + 4px * var(--k, 1)) 12px;
		border: 0;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.tile:hover {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.tn {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		font-weight: 700;
		min-width: 0;
		/* Clear of its "⋯". */
		padding-right: 22px;
	}
	.tag {
		flex: none;
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
	}
	.list {
		display: flex;
		flex-direction: column;
	}
	.batts {
		display: grid;
		column-gap: 24px;
		width: calc(220px + 40px * var(--k, 1));
	}
	.batts.two {
		width: calc(440px + 60px * var(--k, 1));
		grid-template-columns: 1fr 1fr;
	}
	.batt {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: calc(3px + 3px * var(--k, 1)) 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 12.5px;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.batt:hover .bn {
		text-decoration: underline;
	}
	.bn {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cell {
		position: relative;
		flex: none;
		width: 52px;
		height: 14px;
		padding: 2px;
		box-sizing: border-box;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ink) 25%, transparent);
	}
	.cell::after {
		content: '';
		position: absolute;
		right: -4px;
		top: 4px;
		width: 2px;
		height: 6px;
		border-radius: 0 2px 2px 0;
		background: color-mix(in srgb, var(--ink) 25%, transparent);
	}
	.cell i {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: linear-gradient(90deg, #4fe0a0, #9ff0c9);
	}
	.cell.low i {
		background: linear-gradient(90deg, #ffb35c, #ffd28a);
	}
	.pct {
		flex: none;
		width: 38px;
		text-align: right;
		font: 500 12px var(--font-num);
		color: var(--ink-muted);
	}
	.pct.low {
		color: var(--alert);
	}
	.tile:focus-visible,
	.batt:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
