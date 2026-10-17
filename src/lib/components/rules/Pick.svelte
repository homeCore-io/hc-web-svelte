<!--
	Choosing a device for a rule (A3): by room, by name; the ones a part can
	use only. A device the rule names that the house lacks stays chosen, marked.
-->
<script lang="ts">
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { byRoomName } from '#lib/ruleEdit.js';
	import { editor } from './context.js';

	let {
		value,
		onchange,
		label = 'Device',
		only = () => true,
		optional = false
	}: {
		value: string;
		onchange: (id: string) => void;
		label?: string;
		only?: (d: CoreDevice) => boolean;
		optional?: boolean;
	} = $props();

	const ctx = editor();
	const groups = $derived(byRoomName(ctx.devices.filter(only), ctx.roomOf));
	const known = $derived(value === '' || !!ctx.house.device(value));
	// A name in rules (`kitchen.ceiling`) shows as the device it is.
	const shown = $derived(ctx.house.device(value)?.device_id ?? value);
</script>

<label class="pick">
	<span>{label}</span>
	<select value={shown} class:missing={!known} onchange={(e) => onchange(e.currentTarget.value)}>
		<option value="" disabled={!optional}>{optional ? 'None' : 'Choose a device…'}</option>
		{#if !known}<option {value}>{value} — not in the house</option>{/if}
		{#each groups as g (g.room)}
			<optgroup label={g.room}>
				{#each g.devices as d (d.device_id)}<option value={d.device_id}>{displayName(d)}</option
					>{/each}
			</optgroup>
		{/each}
	</select>
</label>

<style>
	.pick {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	select {
		height: 40px;
		max-width: 100%;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
	}
	.missing {
		border-color: var(--alert);
		color: var(--alert);
	}
</style>
