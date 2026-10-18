<!--
	Any part homeCore has (A3, E7): its kind from homeCore's own vocabulary,
	and its fields as homeCore describes them — for what the editor doesn't
	offer by name.
-->
<script lang="ts">
	import {
		PER_MODE,
		newCheck,
		newOf,
		readingsOf,
		vocabFields,
		withPickers,
		type VariantSpec
	} from '#lib/ruleEdit.js';
	import { editor } from './context.js';
	import { tagOf } from '#lib/ruleWords.js';
	import FieldInput from './FieldInput.svelte';
	import StepList from './StepList.svelte';
	import CheckEdit from './CheckEdit.svelte';
	import PerMode from './PerMode.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		value,
		onchange,
		specs,
		label = 'Kind'
	}: { value: Json; onchange: (v: Json) => void; specs: VariantSpec[]; label?: string } = $props();

	const tag = $derived(tagOf(value)[0]);
	const body = $derived(tagOf(value)[1]);
	const spec = $derived(specs.find((s) => s.tag === tag));
	const ctx = editor();
	const perMode = $derived(PER_MODE.has(tag));
	// A part naming a device offers that device's readings for its attribute.
	const lists = $derived(
		typeof body?.device_id === 'string' && body.device_id
			? { ...ctx.lists, attributes: readingsOf(ctx.house.device(body.device_id)) }
			: ctx.lists
	);
	// A per-mode step's table covers its modes and its "any other mode".
	const fields = $derived(
		spec
			? vocabFields(spec)
					.map((f) => withPickers(tag, f, lists))
					.filter((f) => !perMode || !(f.name === 'modes' || f.name.startsWith('default_')))
			: []
	);
	const words = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2');
	// Kinds in A–Z order, as people look for them.
	const sorted = $derived([...specs].sort((a, b) => words(a.tag).localeCompare(words(b.tag))));

	function set(name: string, v: unknown) {
		const next = { ...body };
		if (v === undefined) delete next[name];
		else next[name] = v;
		onchange({ [tag]: next });
	}
</script>

<label class="kind">
	<span>{label}</span>
	<select
		value={tag}
		onchange={(e) => onchange(newOf(specs.find((s) => s.tag === e.currentTarget.value)!))}
	>
		{#if !spec}<option value={tag}>{words(tag)}</option>{/if}
		{#each sorted as s (s.tag)}<option value={s.tag}>{words(s.tag)}</option>{/each}
	</select>
</label>
{#each fields as f (f.name)}
	{#if f.kind === 'steps'}
		{@const steps = Array.isArray(body[f.name]) ? body[f.name] : []}
		<div class="nested">
			<span class="lbl">{f.label}</span>
			<StepList {steps} onchange={(l) => set(f.name, l)} />
		</div>
	{:else if f.kind === 'checks'}
		{@const list: Json[] = Array.isArray(body[f.name]) ? body[f.name] : []}
		<div class="nested">
			<span class="lbl">{f.label}</span>
			{#each list as c, i (i)}
				<CheckEdit
					value={c}
					onchange={(v) =>
						set(
							f.name,
							list.map((x, j) => (j === i ? v : x))
						)}
					onremove={() =>
						set(
							f.name,
							list.filter((_, j) => j !== i)
						)}
				/>
			{/each}
			<button type="button" class="add" onclick={() => set(f.name, [...list, newCheck('device')])}
				>+ A check</button
			>
		</div>
	{:else if f.kind === 'check'}
		<div class="nested">
			<span class="lbl">{f.label}</span>
			<CheckEdit value={body[f.name] ?? newCheck('device')} onchange={(v) => set(f.name, v)} />
		</div>
	{:else}
		<FieldInput field={f} value={body[f.name]} onchange={(v) => set(f.name, v)} />
	{/if}
{/each}
{#if perMode}
	<PerMode tag={tag as 'DelayPerMode'} {body} onchange={(b) => onchange({ [tag]: b })} />
{/if}

<style>
	.nested {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 0 8px 12px;
		border-left: 2px solid var(--line);
	}
	.lbl {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.add {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 2px 0;
		color: var(--accent);
		font-weight: 600;
	}
	.kind {
		display: flex;
		flex-direction: column;
		gap: 4px;
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
