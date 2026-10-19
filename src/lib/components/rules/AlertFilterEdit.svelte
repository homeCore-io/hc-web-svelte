<!--
	Which alerts a part of a rule means: from homeCore or a plugin, which kind,
	on which device, how serious at least. Every choice narrows; "any" leaves
	it open.
-->
<script lang="ts">
	import { alertKinds, BUILT_IN_KINDS, pluginName } from '#lib/alertKinds.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { byRoomName } from '#lib/ruleEdit.js';
	import { editor } from './context.js';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let { value, onchange }: { value: Json; onchange: (v: Json) => void } = $props();

	const ctx = editor();
	$effect(() => alertKinds.ensure());
	const f = $derived((value ?? {}) as Record<string, Json>);
	const from = $derived(
		typeof f.plugin_id === 'string'
			? `plugin:${f.plugin_id}`
			: typeof f.kind === 'string' && f.kind !== 'plugin'
				? 'core'
				: f.kind === 'plugin'
					? 'plugins'
					: ''
	);
	const plugins = $derived([...new Set(alertKinds.list.map((k) => k.plugin_id))].sort());
	const topics = $derived(
		typeof f.plugin_id === 'string'
			? alertKinds.list.filter((k) => k.plugin_id === f.plugin_id)
			: []
	);
	const devices = $derived(
		ctx.devices.filter((d) => typeof f.plugin_id !== 'string' || d.plugin_id === f.plugin_id)
	);
	const groups = $derived(byRoomName(devices, ctx.roomOf));
	const deviceId = $derived(Array.isArray(f.device_ids) ? (f.device_ids[0] ?? '') : '');

	/** The filter with `changes`, a field set to undefined left out. */
	function set(changes: Record<string, Json>) {
		const next: Record<string, Json> = { ...f, ...changes };
		for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
		onchange(next);
	}
	function setFrom(v: string) {
		if (v === '') set({ kind: undefined, plugin_id: undefined, topic: undefined, key: undefined });
		else if (v === 'core')
			set({ kind: 'offline', plugin_id: undefined, topic: undefined, key: undefined });
		else if (v === 'plugins') set({ kind: 'plugin', plugin_id: undefined, topic: undefined });
		else
			set({
				kind: 'plugin',
				plugin_id: v.slice('plugin:'.length),
				topic: undefined,
				key: undefined
			});
	}
</script>

<div class="filter">
	<label>
		<span>From</span>
		<select value={from} onchange={(e) => setFrom(e.currentTarget.value)}>
			<option value="">Anywhere</option>
			<option value="core">homeCore</option>
			<option value="plugins">Any plugin</option>
			{#each plugins as p (p)}<option value={`plugin:${p}`}>{pluginName(p)}</option>{/each}
			{#if typeof f.plugin_id === 'string' && !plugins.includes(f.plugin_id)}
				<option value={`plugin:${f.plugin_id}`}>{pluginName(f.plugin_id)}</option>
			{/if}
		</select>
	</label>
	{#if from === 'core'}
		<label>
			<span>Kind</span>
			<select value={f.kind} onchange={(e) => set({ kind: e.currentTarget.value })}>
				{#each BUILT_IN_KINDS as k (k.value)}<option value={k.value}>{k.label}</option>{/each}
			</select>
		</label>
	{:else if typeof f.plugin_id === 'string'}
		<label>
			<span>Kind</span>
			<select value={f.topic ?? ''} onchange={(e) => set({ topic: e.currentTarget.value })}>
				<option value="">Any of its alerts</option>
				{#each topics as k (k.topic)}<option value={k.topic}>{k.label}</option>{/each}
				{#if typeof f.topic === 'string' && !topics.some((k) => k.topic === f.topic)}
					<option value={f.topic}>{f.topic}</option>
				{/if}
			</select>
		</label>
	{/if}
	<label>
		<span>On</span>
		<select
			value={deviceId}
			onchange={(e) =>
				set({ device_ids: e.currentTarget.value ? [e.currentTarget.value] : undefined })}
		>
			<option value="">Any device</option>
			{#if deviceId && !ctx.house.device(deviceId)}<option value={deviceId}
					>{deviceId} — not in the house</option
				>{/if}
			{#each groups as g (g.room)}
				<optgroup label={g.room}>
					{#each g.devices as d (d.device_id)}<option value={d.device_id}>{displayName(d)}</option
						>{/each}
				</optgroup>
			{/each}
		</select>
	</label>
	<label>
		<span>At least</span>
		<select
			value={f.min_severity ?? ''}
			onchange={(e) => set({ min_severity: e.currentTarget.value })}
		>
			<option value="">Any</option>
			<option value="warning">A warning</option>
			<option value="error">An error</option>
			<option value="critical">Critical</option>
		</select>
	</label>
	{#if typeof f.key === 'string'}
		<label>
			<span>About</span>
			<input value={f.key} onchange={(e) => set({ key: e.currentTarget.value })} />
		</label>
	{/if}
</div>

<style>
	.filter {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 10px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	select,
	input {
		height: 40px;
		max-width: 100%;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 400;
	}
</style>
