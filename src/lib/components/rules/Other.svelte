<!--
	Any part homeCore has (A3, E7): its kind from homeCore's own vocabulary,
	and its fields as homeCore describes them — for what the editor doesn't
	offer by name.
-->
<script lang="ts">
	import { newOf, vocabFields, type VariantSpec } from '#lib/ruleEdit.js';
	import { tagOf } from '#lib/ruleWords.js';
	import FieldInput from './FieldInput.svelte';

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
	const fields = $derived(spec ? vocabFields(spec) : []);
	const words = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2');

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
		{#each specs as s (s.tag)}<option value={s.tag}>{words(s.tag)}</option>{/each}
	</select>
</label>
{#each fields as f (f.name)}
	<FieldInput field={f} value={body[f.name]} onchange={(v) => set(f.name, v)} />
{/each}

<style>
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
