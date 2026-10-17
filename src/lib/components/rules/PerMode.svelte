<!--
	A step that depends on the mode (A3): wait, set a device or run a scene —
	one way in each mode named, and a way for any other. A table of modes,
	not JSON.
-->
<script lang="ts">
	import { displayName } from '#lib/devices.js';
	import { editor } from './context.js';
	import FieldInput from './FieldInput.svelte';
	import StateEdit from './StateEdit.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		tag,
		body,
		onchange
	}: {
		tag: 'DelayPerMode' | 'SetDeviceStatePerMode' | 'ActivateScenePerMode';
		body: Json;
		onchange: (body: Json) => void;
	} = $props();

	const ctx = editor();
	const rows = $derived<Json[]>(Array.isArray(body.modes) ? body.modes : []);
	const modeOptions = $derived(
		ctx.modes.map((m) => ({ value: m.device_id, label: displayName(m) }))
	);
	const sceneOptions = $derived(ctx.scenes.map((s) => ({ value: s.id, label: s.name })));
	const DEFAULT: Record<typeof tag, string> = {
		DelayPerMode: 'default_secs',
		SetDeviceStatePerMode: 'default_state',
		ActivateScenePerMode: 'default_scene_id'
	};
	const setRows = (list: Json[]) => onchange({ ...body, modes: list });
	const setRow = (i: number, patch: Json) =>
		setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	function setDefault(v: unknown) {
		const next = { ...body };
		if (v === undefined || v === '') delete next[DEFAULT[tag]];
		else next[DEFAULT[tag]] = v;
		onchange(next);
	}
	function fresh(): Json {
		const used = new Set(rows.map((r) => r.mode));
		const mode = ctx.modes.find((m) => !used.has(m.device_id))?.device_id ?? '';
		if (tag === 'DelayPerMode') return { mode, duration_secs: 60 };
		if (tag === 'ActivateScenePerMode') return { mode, scene_id: ctx.scenes[0]?.id ?? '' };
		return { mode, state: undefined };
	}
	const noDevice = $derived(tag === 'SetDeviceStatePerMode' && !body.device_id);
</script>

<div class="table" role="group" aria-label="By mode">
	{#if noDevice}<p class="sub">Choose the device first.</p>{/if}
	{#each rows as r, i (i)}
		<div class="row">
			<FieldInput
				field={{ kind: 'choice', name: 'mode', label: 'In', options: modeOptions }}
				value={r.mode}
				onchange={(v) => setRow(i, { mode: v })}
			/>
			{#if tag === 'DelayPerMode'}
				<FieldInput
					field={{ kind: 'duration', name: 'duration_secs', label: 'Wait' }}
					value={r.duration_secs}
					onchange={(v) => setRow(i, { duration_secs: v })}
				/>
			{:else if tag === 'ActivateScenePerMode'}
				<FieldInput
					field={{ kind: 'choice', name: 'scene_id', label: 'Run', options: sceneOptions }}
					value={r.scene_id}
					onchange={(v) => setRow(i, { scene_id: v })}
				/>
			{:else if !noDevice}
				<StateEdit
					deviceId={body.device_id}
					value={r.state}
					onchange={(v) => setRow(i, { state: v })}
				/>
			{/if}
			<button
				type="button"
				class="x"
				aria-label="Remove this mode"
				onclick={() => setRows(rows.filter((_, j) => j !== i))}>×</button
			>
		</div>
	{/each}
	<button type="button" class="add" onclick={() => setRows([...rows, fresh()])}
		>+ In another mode</button
	>
	<div class="row other">
		<span class="lbl">In any other mode</span>
		{#if tag === 'DelayPerMode'}
			<FieldInput
				field={{ kind: 'duration', name: 'default_secs', label: 'Wait', optional: true }}
				value={body.default_secs}
				onchange={setDefault}
			/>
		{:else if tag === 'ActivateScenePerMode'}
			<FieldInput
				field={{
					kind: 'choice',
					name: 'default_scene_id',
					label: 'Run',
					options: [{ value: '', label: 'nothing' }, ...sceneOptions]
				}}
				value={body.default_scene_id ?? ''}
				onchange={setDefault}
			/>
		{:else if !noDevice}
			<StateEdit
				deviceId={body.device_id}
				value={body.default_state}
				label="Do"
				onchange={setDefault}
			/>
			{#if body.default_state !== undefined}
				<button type="button" class="link" onclick={() => setDefault(undefined)}
					>Do nothing then</button
				>
			{/if}
		{/if}
	</div>
</div>

<style>
	.table {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px;
	}
	.row.other {
		padding-top: 8px;
		border-top: 1px solid var(--line);
	}
	.lbl {
		flex-basis: 100%;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.sub {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.x {
		height: 40px;
		width: 40px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		font-size: 18px;
	}
	.add,
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 2px 0;
		color: var(--accent);
		font-weight: 600;
	}
</style>
