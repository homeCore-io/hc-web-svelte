<!--
	Switches and timers where they sit together (switches.ts's `partsOf`), as
	the person chose (style.ts): as rows, each switch with its toggle and the
	timers' clocks below them; or as tiles of one size, switches and timers
	side by side. Anything else is a row that opens its page. The Switches
	tab draws its columns with it, and any other tab what it was given to show
	that it has no drawing of its own for. In a room, each has its "⋯"
	(Place): at a row's end, with "moved here" under its name (Moved); at a
	tile's top right.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import Row from './Row.svelte';
	import Place from './Place.svelte';
	import Moved from './Moved.svelte';
	import Switch from './Switch.svelte';
	import SwitchTile from './SwitchTile.svelte';
	import TimerTile from './TimerTile.svelte';
	import { shortName } from './room.js';
	import { namesApart } from './apart.js';
	import { drawOf, partsOf } from './switches.js';
	import { switchesAs, switchStyle, type SetLook } from './style.js';

	let {
		list,
		room,
		may,
		look,
		named
	}: {
		list: CoreDevice[];
		room: string;
		may: boolean;
		/** Rows or tiles; unset, as the person chose. */
		look?: SetLook;
		/** Their names, as the tab around them has them; else each set's own. */
		named?: (d: CoreDevice) => string;
	} = $props();

	const as = $derived(look ?? switchesAs(personal.doc.console));
	const sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	const parts = $derived(partsOf(list));
	const tiled = $derived(
		as === 'tiles' ? list.filter((d) => !parts.others.includes(d)) : parts.timers
	);

	// Two with one name say which is which.
	const nameOf = $derived(
		named ?? namesApart(list, (d) => shortName(d.name_override ?? d.name, room))
	);
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const isOn = (d: CoreDevice) =>
		({ ...d.attributes, ...commands.pending[d.device_id]?.want }).on === true;
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const setOn = (d: CoreDevice, on: boolean) =>
		void commands.set(d.device_id, 'switch', { on }, d.attributes);
	const subOf = (d: CoreDevice) =>
		d.available ? (commands.notes[d.device_id] ?? drawOf(d)) : 'Offline';
</script>

<div class="set">
	{#if as === 'rows' && parts.switches.length > 0}
		<div class="rows">
			{#each parts.switches as d (d.device_id)}
				<div class="line">
					<div class="one">
						<Switch
							label={nameOf(d)}
							sub={subOf(d)}
							on={isOn(d)}
							style={sw}
							disabled={!may || !d.available}
							waiting={waiting(d)}
							onchange={(v) => setOn(d, v)}
						>
							{#snippet tag()}<Moved {d} />{/snippet}
						</Switch>
					</div>
					<Place {d} tag={false} />
				</div>
			{/each}
		</div>
	{/if}
	{#if tiled.length > 0}
		<div class="tiles">
			{#each tiled as d (d.device_id)}
				<div class="tw">
					{#if parts.timers.includes(d)}
						<TimerTile {d} name={nameOf(d)} {may} />
					{:else}
						<SwitchTile
							name={nameOf(d)}
							sub={subOf(d)}
							on={isOn(d)}
							disabled={!may || !d.available}
							waiting={waiting(d)}
							onchange={(v) => setOn(d, v)}
							onopen={() => open(d)}
						/>
					{/if}
					<Place {d} corner />
				</div>
			{/each}
		</div>
	{/if}
	{#if parts.others.length > 0}
		<div class="rows">
			{#each parts.others as d (d.device_id)}
				<Row
					name={nameOf(d)}
					sub={d.available ? cardFor(d, clock.now).stateLine : 'Offline'}
					dot={d.available ? 'quiet' : 'alert'}
					onopen={() => open(d)}
					place={d}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.set {
		display: flex;
		flex-direction: column;
		gap: calc(8px + 6px * var(--k, 1));
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: calc(4px + 6px * var(--k, 1));
	}
	.line {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.one {
		flex: 1;
		min-width: 0;
	}
	.tw {
		position: relative;
	}
	.tiles {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>
