<!--
	A room's Switches tab in the console (the LivingRoom board): its switches
	and timers (SwitchSet), as the person chose. As rows, they're in columns
	by system (switches.ts), each switch drawn in the person's switch style
	and the timers' clocks below; a numbered set ("Holiday Lights 1" to "4")
	has a column of its own with All on and All off; a plug shows what it
	draws. As tiles, switches and timers sit side by side in one set. Buttons
	and the like are rows that open their page. Sized to the window (`fit`).
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import Col from './Col.svelte';
	import SwitchSet from './SwitchSet.svelte';
	import { fit } from './fit.js';
	import { partsOf, setTitle, switchCols, type SwitchCol } from './switches.js';
	import { switchesAs } from './style.js';

	let {
		list,
		room,
		may
	}: {
		list: CoreDevice[];
		room: string;
		may: boolean;
	} = $props();

	const as = $derived(switchesAs(personal.doc.console));
	const cols = $derived(switchCols(list));
	const isOn = (d: CoreDevice) =>
		({ ...d.attributes, ...commands.pending[d.device_id]?.want }).on === true;
	const setOn = (d: CoreDevice, on: boolean) =>
		void commands.set(d.device_id, 'switch', { on }, d.attributes);

	/** All on or all off, for the switches in a set that can be reached. */
	function setAll(c: SwitchCol, on: boolean) {
		for (const d of c.devices) if (d.available && isOn(d) !== on) setOn(d, on);
	}
	/** A column with timers is wide enough for two of their clocks. */
	const widthOf = (c: SwitchCol) =>
		partsOf(c.devices).timers.length > 1
			? 'calc(335px + 15px * var(--k, 1))'
			: 'calc(230px + 60px * var(--k, 1))';
</script>

{#if as === 'tiles'}
	<div class="desk" use:fit={list}>
		<Col title={setTitle(list)} grow>
			<SwitchSet {list} {room} {may} look="tiles" />
		</Col>
	</div>
{:else}
	<div class="desk" use:fit={cols}>
		{#each cols as c (c.key)}
			<Col title={c.title} plugin={c.plugin} width={widthOf(c)}>
				<SwitchSet list={c.devices} {room} {may} look="rows" />
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
{/if}

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
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
