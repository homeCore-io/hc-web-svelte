<!--
	What to tell one device (A3): chosen from what the device says it can do,
	as "Set a device" does — or, for a device that says nothing, as JSON.
	Used where a state stands on its own: per mode, "otherwise", and a
	scene's steps (which pass the device, having no editor around them).
-->
<script lang="ts">
	import { commandOf, commandsOf, rebuild } from '#lib/ruleEdit.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { editor } from './context.js';
	import FieldInput from './FieldInput.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		deviceId,
		value,
		onchange,
		label = 'What to do',
		device: given
	}: {
		deviceId: string;
		value: Json;
		onchange: (v: Json) => void;
		label?: string;
		device?: CoreDevice;
	} = $props();

	const ctx = editor();
	const device = $derived(given ?? ctx?.house.device(deviceId));
	const cmds = $derived(device ? commandsOf(device) : []);
	const current = $derived(value === undefined ? undefined : commandOf(cmds, value));
	function setCommand(key: string, values?: Record<string, unknown>) {
		const cmd = cmds.find((c) => c.key === key);
		if (!cmd) return;
		onchange(rebuild(cmd, values ?? (current?.cmd.key === key ? current.values : {}), value));
	}
</script>

{#if cmds.length}
	<label class="kind">
		<span>{label}</span>
		<select value={current?.cmd.key ?? ''} onchange={(e) => setCommand(e.currentTarget.value, {})}>
			{#if !current}<option value="" disabled
					>{value === undefined
						? 'Choose…'
						: ctx
							? 'As written — see the JSON tab'
							: 'As written, below'}</option
				>{/if}
			{#each cmds as c (c.key)}<option value={c.key}>{c.label}</option>{/each}
		</select>
	</label>
	{#if !current && value !== undefined && !ctx}
		<!-- No JSON tab around it (a scene's step): what it says, as written. -->
		<FieldInput field={{ kind: 'json', name: 'state', label: 'As written' }} {value} {onchange} />
	{/if}
	{#if current}
		{#each current.cmd.fields as field (field.name)}
			<FieldInput
				{field}
				value={current.values[field.name]}
				onchange={(v) => setCommand(current.cmd.key, { ...current.values, [field.name]: v })}
			/>
		{/each}
	{/if}
{:else}
	<FieldInput field={{ kind: 'json', name: 'state', label, optional: true }} {value} {onchange} />
{/if}

<style>
	.kind {
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
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
	}
</style>
