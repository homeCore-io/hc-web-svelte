<!--
	A room's Switches tab in the console (the LivingRoom board): its switches
	in columns by system (switches.ts), drawn in the person's switch style. A
	numbered set ("Holiday Lights 1" to "4") has a column of its own with All
	on and All off; a plug shows what it draws. Timers, buttons and the like
	are rows that open their page. Sized to the window (`fit`).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Col from './Col.svelte';
	import Row from './Row.svelte';
	import Switch from './Switch.svelte';
	import { fit } from './fit.js';
	import { shortName } from './room.js';
	import { drawOf, flips, switchCols, type SwitchCol } from './switches.js';
	import type { SwitchStyle } from './style.js';

	let {
		list,
		room,
		sw,
		may
	}: {
		list: CoreDevice[];
		room: string;
		sw: SwitchStyle;
		may: boolean;
	} = $props();

	const cols = $derived(switchCols(list));
	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const isOn = (d: CoreDevice) => ({ ...d.attributes, ...want(d) }).on === true;
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const setOn = (d: CoreDevice, on: boolean) =>
		void commands.set(d.device_id, 'switch', { on }, d.attributes);
	const subOf = (d: CoreDevice) => (d.available ? drawOf(d) : 'Offline');

	/** All on or all off, for the switches in a set that can be reached. */
	function setAll(c: SwitchCol, on: boolean) {
		for (const d of c.devices) if (d.available && isOn(d) !== on) setOn(d, on);
	}
	const noteOf = (c: SwitchCol) =>
		c.devices.map((d) => commands.notes[d.device_id]).find((n) => !!n);
</script>

<div class="desk" use:fit={cols}>
	{#each cols as c (c.key)}
		<Col
			title={c.title}
			plugin={c.plugin}
			note={noteOf(c)}
			alert
			width="calc(230px + 60px * var(--k, 1))"
		>
			<div class="rows">
				{#each c.devices as d (d.device_id)}
					{#if flips(d)}
						<Switch
							label={nameOf(d)}
							sub={subOf(d)}
							on={isOn(d)}
							style={sw}
							disabled={!may || !d.available}
							waiting={waiting(d)}
							onchange={(v) => setOn(d, v)}
						/>
					{:else}
						<Row
							name={nameOf(d)}
							sub={d.available ? cardFor(d, clock.now).stateLine : 'Offline'}
							dot={d.available ? 'quiet' : 'alert'}
							onopen={() => open(d)}
						/>
					{/if}
				{/each}
			</div>
			{#if c.together}
				{@const some = c.devices.some((d) => d.available)}
				<div class="all">
					<button
						type="button"
						class="tbtn"
						disabled={!may || !some}
						onclick={() => setAll(c, true)}>All on</button
					>
					<button
						type="button"
						class="tbtn ghost"
						disabled={!may || !some}
						onclick={() => setAll(c, false)}>All off</button
					>
				</div>
			{/if}
		</Col>
	{/each}
</div>

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: calc(4px + 6px * var(--k, 1));
	}
	.all {
		display: flex;
		gap: 8px;
		margin-top: calc(2px + 4px * var(--k, 1));
	}
	.tbtn {
		height: 34px;
		padding: 0 14px;
		border: 0;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
		font: 600 12.5px var(--font);
		cursor: pointer;
	}
	.tbtn.ghost {
		background: none;
		box-shadow: inset 0 0 0 1px var(--con-edge-strong);
	}
	.tbtn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 18%, transparent);
	}
	.tbtn:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.tbtn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
