<!--
	A check (A3): asked at the moment a rule starts, or by an if/otherwise —
	a device's state in its own words, a mode, a time window, "any of", or
	anything else homeCore's vocabulary has.
-->
<script lang="ts">
	import Self from './CheckEdit.svelte';
	import { displayName } from '#lib/devices.js';
	import { checkPhrase, tagOf } from '#lib/ruleWords.js';
	import {
		CHECK_KINDS,
		checkKindOf,
		newCheck,
		stateOf,
		statesOf,
		type CheckKind
	} from '#lib/ruleEdit.js';
	import { editor } from './context.js';
	import Row from './Row.svelte';
	import Pick from './Pick.svelte';
	import FieldInput from './FieldInput.svelte';
	import Other from './Other.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		value,
		onchange,
		onremove,
		kinds = CHECK_KINDS.map((k) => k.kind),
		open = $bindable(false)
	}: {
		value: Json;
		onchange: (v: Json) => void;
		onremove?: () => void;
		kinds?: CheckKind[];
		open?: boolean;
	} = $props();

	const ctx = editor();
	const kind = $derived(checkKindOf(value));
	const f = $derived(tagOf(value)[1]);

	const now = $derived(stateOf(value));
	const id = $derived(now?.id ?? (typeof f.device_id === 'string' ? f.device_id : ''));
	const device = $derived(ctx.house.device(id));
	const states = $derived(device ? statesOf(device) : []);
	const state = $derived(states.find((s) => s.key === now?.key));
	function setState(key: string, v: { id?: string; value?: number } = {}) {
		const target = v.id ?? id;
		const d = ctx.house.device(target);
		const list = d ? statesOf(d) : [];
		const s = list.find((x) => x.key === key) ?? list[0];
		onchange(
			s
				? s.build(target, { value: v.value ?? now?.value ?? 0 })
				: { DeviceState: { device_id: target, attribute: 'on', op: 'Eq', value: true } }
		);
	}

	const inner = $derived<Json[]>(kind === 'any' ? (f.conditions ?? []) : []);
	const setInner = (list: Json[]) => onchange({ Or: { conditions: list } });
	const set = (field: string, v: unknown) => onchange({ [tagOf(value)[0]]: { ...f, [field]: v } });
	const offered = $derived(CHECK_KINDS.filter((k) => kinds.includes(k.kind) || k.kind === kind));
</script>

<Row words={checkPhrase(ctx.house, value)} bind:open {onremove}>
	<label class="kind">
		<span>Check</span>
		<select value={kind} onchange={(e) => onchange(newCheck(e.currentTarget.value as CheckKind))}>
			{#each offered as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
		</select>
	</label>
	{#if kind === 'device'}
		<Pick value={id} onchange={(v) => setState(now?.key ?? '', { id: v })} />
		{#if device}
			<label class="kind">
				<span>{displayName(device)}…</span>
				<select value={now?.key ?? ''} onchange={(e) => setState(e.currentTarget.value)}>
					{#if !state}<option value="" disabled>Choose…</option>{/if}
					{#each states as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
				</select>
			</label>
			{#if state?.number}
				<FieldInput
					field={{
						kind: 'number',
						name: 'value',
						label: state.number.label,
						unit: state.number.unit
					}}
					value={now?.value ?? 0}
					onchange={(v) => setState(state.key, { value: Number(v) })}
				/>
			{/if}
		{/if}
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
				name: 'on',
				label: 'Is',
				options: [
					{ value: 'true', label: 'on' },
					{ value: 'false', label: 'off' }
				]
			}}
			value={String(f.on)}
			onchange={(v) => set('on', v === 'true')}
		/>
	{:else if kind === 'time'}
		<FieldInput
			field={{ kind: 'time', name: 'start', label: 'From' }}
			value={f.start}
			onchange={(v) => set('start', v)}
		/>
		<FieldInput
			field={{ kind: 'time', name: 'end', label: 'To' }}
			value={f.end}
			onchange={(v) => set('end', v)}
		/>
	{:else if kind === 'any'}
		<div class="inner">
			{#each inner as c, i (i)}
				<Self
					value={c}
					{kinds}
					onchange={(v) => setInner(inner.map((x, j) => (j === i ? v : x)))}
					onremove={() => setInner(inner.filter((_, j) => j !== i))}
				/>
			{/each}
			<button type="button" class="add" onclick={() => setInner([...inner, newCheck('device')])}
				>+ Another</button
			>
		</div>
	{:else if ctx.vocab}
		<Other {value} {onchange} specs={ctx.vocab.conditions} label="Check" />
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
	.inner {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
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
</style>
