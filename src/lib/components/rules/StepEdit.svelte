<!--
	A step (A3): set a device by what it says it can do, run a scene, wait,
	tell someone, if/otherwise, at the same time, a mode — or anything else
	homeCore's vocabulary has.
-->
<script lang="ts">
	import StepList from './StepList.svelte';
	import { displayName } from '#lib/devices.js';
	import { stepLine, tagOf } from '#lib/ruleWords.js';
	import {
		STEP_KINDS,
		commandOf,
		commandable,
		commandsOf,
		ifChecks,
		ifCondition,
		ifKinds,
		newCheck,
		newStep,
		rebuild,
		stepKindOf,
		type StepKind
	} from '#lib/ruleEdit.js';
	import { editor } from './context.js';
	import Row from './Row.svelte';
	import Pick from './Pick.svelte';
	import FieldInput from './FieldInput.svelte';
	import CheckEdit from './CheckEdit.svelte';
	import Other from './Other.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		value,
		onchange,
		onremove,
		onup,
		ondown,
		number,
		off = false,
		ontoggle,
		open = $bindable(false)
	}: {
		value: Json;
		onchange: (v: Json) => void;
		onremove?: () => void;
		onup?: () => void;
		ondown?: () => void;
		number?: number;
		off?: boolean;
		ontoggle?: (on: boolean) => void;
		open?: boolean;
	} = $props();

	const ctx = editor();
	const kind = $derived(stepKindOf(value));
	const tag = $derived(tagOf(value)[0]);
	const f = $derived(tagOf(value)[1]);
	const set = (field: string, v: unknown) => {
		const next = { ...f };
		if (v === undefined) delete next[field];
		else next[field] = v;
		onchange({ [tag]: next });
	};

	// ---- set a device ----
	const device = $derived(kind === 'device' ? ctx.house.device(f.device_id ?? '') : undefined);
	const cmds = $derived(device ? commandsOf(device) : []);
	const current = $derived(commandOf(cmds, f.state));
	function setCommand(key: string, values?: Record<string, unknown>) {
		const cmd = cmds.find((c) => c.key === key);
		if (!cmd) return;
		set('state', rebuild(cmd, values ?? (current?.cmd.key === key ? current.values : {}), f.state));
	}
	function setDevice(id: string) {
		const d = ctx.house.device(id);
		const next = d ? commandsOf(d) : [];
		const keep = current && next.find((c) => c.key === current.cmd.key);
		const state = keep ? keep.build(current!.values) : (next[0]?.build({}) ?? f.state);
		onchange({ SetDeviceState: { ...f, device_id: id, state } });
	}

	// ---- if / otherwise ----
	const asked = $derived(kind === 'if' ? ifChecks(f.condition) : undefined);
	const allowed = $derived(ifKinds(ctx.features));
	function ask(list: Json[], field = 'condition', branch?: number) {
		const c = list.length ? ifCondition(list, ctx.features) : '';
		if (c === undefined) return;
		if (branch === undefined) return set(field, c);
		set(
			'else_if',
			(f.else_if ?? []).map((b: Json, j: number) => (j === branch ? { ...b, condition: c } : b))
		);
	}
	const branches = $derived<Json[]>(f.else_if ?? []);
	const channels = $derived([...new Set(['all', ...ctx.channels])]);
</script>

{#snippet checks(
	list: Json[] | undefined,
	onlist: (l: Json[]) => void,
	script: string,
	onscript: (s: string) => void
)}
	{#if list === undefined}
		<label class="script">
			<span>Asks (a script)</span>
			<textarea rows="2" value={script} oninput={(e) => onscript(e.currentTarget.value)}></textarea>
			<button type="button" class="link" onclick={() => onlist([newCheck('device')])}
				>Ask with checks instead</button
			>
		</label>
	{:else}
		<div class="checks">
			{#each list as c, i (i)}
				<CheckEdit
					value={c}
					kinds={allowed}
					open={c && tagOf(c)[1].device_id === ''}
					onchange={(v) => onlist(list.map((x, j) => (j === i ? v : x)))}
					onremove={() => onlist(list.filter((_, j) => j !== i))}
				/>
			{/each}
			<button type="button" class="add" onclick={() => onlist([...list, newCheck('device')])}
				>{list.length ? '+ And' : '+ What it asks'}</button
			>
		</div>
	{/if}
{/snippet}

<Row words={stepLine(ctx.house, value)} bind:open {number} {off} {onremove} {onup} {ondown}>
	<label class="kind">
		<span>Step</span>
		<select
			value={kind}
			onchange={(e) =>
				onchange(newStep(e.currentTarget.value as StepKind, ctx.scenes[0]?.id ?? ''))}
		>
			{#each STEP_KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
		</select>
	</label>
	{#if ontoggle}
		<label class="on"
			><input type="checkbox" checked={!off} onchange={(e) => ontoggle(e.currentTarget.checked)} /> On</label
		>
	{/if}

	{#if kind === 'device'}
		<Pick value={f.device_id ?? ''} only={commandable} onchange={setDevice} />
		{#if device}
			<label class="kind">
				<span>{displayName(device)}: what to do</span>
				<select
					value={current?.cmd.key ?? ''}
					onchange={(e) => setCommand(e.currentTarget.value, {})}
				>
					{#if !current}<option value="" disabled>As written — see the JSON tab</option>{/if}
					{#each cmds as c (c.key)}<option value={c.key}>{c.label}</option>{/each}
				</select>
			</label>
			{#if current}
				{#each current.cmd.fields as field (field.name)}
					<FieldInput
						{field}
						value={current.values[field.name]}
						onchange={(v) => setCommand(current.cmd.key, { ...current.values, [field.name]: v })}
					/>
				{/each}
			{/if}
		{/if}
	{:else if kind === 'scene'}
		<FieldInput
			field={{
				kind: 'choice',
				name: 'scene',
				label: 'Scene',
				options: ctx.scenes.map((s) => ({ value: s.id, label: s.name }))
			}}
			value={f.default_scene_id}
			onchange={(v) => set('default_scene_id', v)}
		/>
	{:else if kind === 'wait'}
		<FieldInput
			field={{ kind: 'duration', name: 'duration_secs', label: 'For' }}
			value={f.duration_secs}
			onchange={(v) => set('duration_secs', v)}
		/>
		<FieldInput
			field={{ kind: 'bool', name: 'cancelable', label: 'Another rule may cut it short' }}
			value={f.cancelable === true}
			onchange={(v) => set('cancelable', v === true)}
		/>
		{#if f.cancelable}
			<FieldInput
				field={{
					kind: 'text',
					name: 'cancel_key',
					label: 'Its name, for “cancel waits” (optional)',
					optional: true
				}}
				value={f.cancel_key ?? undefined}
				onchange={(v) => set('cancel_key', v || undefined)}
			/>
		{/if}
	{:else if kind === 'notify'}
		<FieldInput
			field={{ kind: 'text', name: 'channel', label: 'Channel', suggest: channels }}
			value={f.channel}
			onchange={(v) => set('channel', v ?? 'all')}
		/>
		<FieldInput
			field={{ kind: 'text', name: 'title', label: 'Title', optional: true }}
			value={f.title ?? undefined}
			onchange={(v) => set('title', v ?? null)}
		/>
		<FieldInput
			field={{ kind: 'text', name: 'message', label: 'Message', long: true }}
			value={f.message}
			onchange={(v) => set('message', v)}
		/>
	{:else if kind === 'mode'}
		<FieldInput
			field={{
				kind: 'choice',
				name: 'mode_id',
				label: 'Mode',
				options: ctx.modes.map((m) => ({ value: m.device_id, label: displayName(m) }))
			}}
			value={f.mode_id}
			onchange={(v) => set('mode_id', v)}
		/>
		<FieldInput
			field={{
				kind: 'choice',
				name: 'command',
				label: 'Turn it',
				options: [
					{ value: 'On', label: 'on' },
					{ value: 'Off', label: 'off' },
					{ value: 'Toggle', label: 'over' }
				]
			}}
			value={f.command}
			onchange={(v) => set('command', v)}
		/>
	{:else if kind === 'together'}
		<StepList
			steps={f.actions ?? []}
			onchange={(l) => set('actions', l)}
			addLabel="+ Add a step to do at the same time"
		/>
	{:else if kind === 'if'}
		<div class="branch">
			<strong>If</strong>
			{@render checks(
				asked,
				(l) => ask(l),
				typeof f.condition === 'string' ? f.condition : '',
				(s) => set('condition', s)
			)}
			<strong>Then</strong>
			<StepList steps={f.then_actions ?? []} onchange={(l) => set('then_actions', l)} />
			{#each branches as b, i (i)}
				<strong
					>Otherwise, if <button
						type="button"
						class="link"
						onclick={() =>
							set(
								'else_if',
								branches.filter((_, j) => j !== i)
							)}>take out</button
					></strong
				>
				{@render checks(
					ifChecks(b.condition),
					(l) => ask(l, 'condition', i),
					typeof b.condition === 'string' ? b.condition : '',
					(s) =>
						set(
							'else_if',
							branches.map((x, j) => (j === i ? { ...x, condition: s } : x))
						)
				)}
				<StepList
					steps={b.actions ?? []}
					onchange={(l) =>
						set(
							'else_if',
							branches.map((x, j) => (j === i ? { ...x, actions: l } : x))
						)}
				/>
			{/each}
			<button
				type="button"
				class="add"
				onclick={() => set('else_if', [...branches, { condition: '', actions: [] }])}
				>+ Otherwise, if…</button
			>
			<strong>Otherwise</strong>
			<StepList
				steps={f.else_actions ?? []}
				onchange={(l) => set('else_actions', l)}
				addLabel="+ Add a step for otherwise"
			/>
		</div>
	{:else if ctx.vocab}
		<Other {value} {onchange} specs={ctx.vocab.actions} label="Step" />
	{/if}
</Row>

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
	.on {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		font-size: 14px;
	}
	.branch,
	.checks {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.branch > strong {
		margin-top: var(--space-2);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.script {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.script textarea {
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-num);
		font-size: 12.5px;
	}
	.add {
		align-self: flex-start;
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px dashed var(--line);
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0 4px;
		color: var(--accent);
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		text-transform: none;
		letter-spacing: 0;
	}
</style>
