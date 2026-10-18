<!--
	One descriptor field's control, by kind (T4). Numbers are typed as text and
	parsed here; text that doesn't parse stays in the box and is reported up
	with `onfail`, so the value is never half-typed.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Toggle from '../Toggle.svelte';
	import Self from './Control.svelte';
	import {
		MAP_NAME,
		entry,
		numeric,
		parse,
		problem,
		same,
		unitName,
		type Field
	} from '#lib/descriptor.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { sourceOptions } from '#lib/formSources.js';

	let {
		field,
		value,
		id,
		label = field.label ?? field.key ?? '',
		invalid = false,
		onchange,
		onfail = () => {}
	}: {
		field: Field;
		value: unknown;
		id: string;
		label?: string;
		invalid?: boolean;
		onchange: (value: unknown) => void;
		onfail?: (problem: string | null) => void;
	} = $props();

	const disabled = $derived(!!field.read_only);
	// What it chooses from: its own options, or the house's devices or rooms.
	const opts = $derived(
		field.options ?? sourceOptions(field.source, Object.values(devices.byId), rooms.list)
	);
	const fromHouse = $derived(!field.options && opts !== undefined);
	const isSecret = $derived(field.kind === 'secret' || !!field.secret);

	// ---- typed text (text, numbers, secrets) ----
	let text = $state(untrack(() => entry(value)));
	$effect(() => {
		const v = value;
		untrack(() => {
			const p = parse(field, text);
			if (!('value' in p) || !same(p.value, v)) text = entry(v);
		});
	});
	function typed(next: string) {
		text = next;
		const p = parse(field, next);
		if ('error' in p) return onfail(p.error);
		onfail(null);
		onchange(p.value);
	}
	const placeholder = $derived(
		field.placeholder ?? (field.default !== undefined ? entry(field.default) : '')
	);
	const width = $derived(
		numeric(field.kind)
			? '9ch'
			: field.kind === 'host' || field.kind === 'port'
				? '22ch'
				: field.render === 'path' || field.kind === 'url'
					? '100%'
					: '100%'
	);

	// ---- secrets: never shown; replaced, not edited ----
	let replacing = $state(false);
	let before = $state<unknown>(undefined);
	function replace() {
		before = value;
		replacing = true;
	}
	function keep() {
		replacing = false;
		onfail(null);
		onchange(before);
	}
	// A replacement typed then emptied again keeps the old secret.
	function typedSecret(next: string) {
		if (replacing && next === '') return onchange(before);
		typed(next);
	}
	const secretSet = $derived(value !== undefined && value !== '');

	// ---- lists ----
	let adding = $state('');
	let addProblem = $state<string | null>(null);
	const items = $derived(Array.isArray(value) ? value : []);
	const itemField = $derived({
		kind: typeof field.item === 'string' ? field.item : 'text'
	} as Field);
	function add() {
		const p = parse(itemField, adding);
		if ('error' in p) return void (addProblem = p.error);
		if (p.value === undefined) return;
		const wrong = problem(itemField, p.value);
		if (wrong) return void (addProblem = wrong);
		addProblem = null;
		adding = '';
		onchange([...items, p.value]);
	}

	const labelOf = (x: unknown) => opts?.find((o) => same(o.value, x))?.label ?? entry(x);

	// ---- name → value tables ----
	const pairs = $derived(
		value !== null && typeof value === 'object' && !Array.isArray(value)
			? Object.entries(value as Record<string, unknown>)
			: []
	);
	let newName = $state('');
	let newValue = $state('');
	let mapProblem = $state<string | null>(null);
	const setPair = (k: string, v: unknown) =>
		onchange(Object.fromEntries(pairs.map(([n, x]) => [n, n === k ? v : x])));
	function addPair() {
		const k = newName.trim();
		if (!k) return;
		if (!MAP_NAME.test(k))
			return void (mapProblem = 'A name has no spaces — like hc_core or hc_core::engine.');
		if (pairs.some(([n]) => n === k)) return void (mapProblem = `${k} is there already.`);
		const v = opts ? (opts[0] && !newValue ? opts[0].value : newValue) : newValue;
		mapProblem = null;
		newName = '';
		newValue = '';
		onchange(Object.fromEntries([...pairs, [k, v]]));
	}

	// ---- tables ----
	const columns = $derived(Array.isArray(field.item) ? field.item : []);
	const rows = $derived(Array.isArray(value) ? (value as Record<string, unknown>[]) : []);
	const setCell = (i: number, key: string, v: unknown) => {
		const next = rows.map((r) => ({ ...r }));
		if (v === undefined) delete next[i]![key];
		else next[i]![key] = v;
		onchange(next);
	};
</script>

{#if field.kind === 'toggle'}
	<Toggle on={!!(value ?? field.default)} {label} {disabled} onchange={(on) => onchange(on)} />
{:else if field.kind === 'enum' && (field.render === 'segmented' || field.render === 'pills' || field.render === 'radio')}
	<div class="segmented" role="radiogroup" aria-label={label}>
		{#each field.options ?? [] as o (String(o.value))}
			<button
				type="button"
				role="radio"
				aria-checked={same(value ?? field.default, o.value)}
				{disabled}
				onclick={() => onchange(o.value)}>{o.label}</button
			>
		{/each}
	</div>
{:else if field.kind === 'enum' || (field.kind === 'select' && field.options && !field.allow_create) || (fromHouse && field.kind !== 'list' && field.kind !== 'table')}
	<select
		{id}
		{disabled}
		class:invalid
		value={JSON.stringify(value ?? field.default ?? null)}
		onchange={(e) => onchange(JSON.parse(e.currentTarget.value))}
	>
		{#if value === undefined && field.default === undefined}
			<option value="null" disabled>Choose…</option>
		{:else if value !== undefined && !(opts ?? []).some((o) => same(o.value, value))}
			<option value={JSON.stringify(value)}
				>{entry(value)}{fromHouse ? ' — not in the house' : ''}</option
			>
		{/if}
		{#each opts ?? [] as o (String(o.value))}
			<option value={JSON.stringify(o.value)}>{o.label}</option>
		{/each}
	</select>
{:else if isSecret}
	{#if secretSet && !replacing}
		<div class="secret">
			<span class="dots">•••••••• set</span>
			{#if !disabled}<button type="button" class="small" onclick={replace}>Replace</button>{/if}
		</div>
	{:else}
		<div class="secret">
			<input
				{id}
				type="password"
				autocomplete="new-password"
				class:invalid
				{disabled}
				placeholder={secretSet ? 'The new one' : placeholder}
				value={replacing && same(value, before) ? '' : text}
				oninput={(e) => typedSecret(e.currentTarget.value)}
			/>
			{#if replacing}
				<button type="button" class="small" onclick={keep}>Keep the old one</button>
			{/if}
		</div>
	{/if}
{:else if field.kind === 'list'}
	<div class="list">
		{#each items as x, i (i)}
			<span class="chip"
				>{labelOf(x)}{#if !disabled}<button
						type="button"
						aria-label={`Remove ${entry(x)}`}
						onclick={() => onchange(items.filter((_, j) => j !== i))}
						><X size={14} aria-hidden="true" /></button
					>{/if}</span
			>
		{/each}
		{#if !disabled && opts}
			<select
				class="pick"
				aria-label={`Add to ${label}`}
				value=""
				onchange={(e) => {
					const v = e.currentTarget.value;
					e.currentTarget.value = '';
					if (v !== '') onchange([...items, JSON.parse(v)]);
				}}
			>
				<option value="">Add…</option>
				{#each opts.filter((o) => !items.some((x) => same(x, o.value))) as o (String(o.value))}
					<option value={JSON.stringify(o.value)}>{o.label}</option>
				{/each}
			</select>
		{:else if !disabled}
			<div class="add">
				<input
					{id}
					bind:value={adding}
					class:invalid={addProblem !== null}
					placeholder={field.placeholder ?? 'Add…'}
					aria-label={`Add to ${label}`}
					oninput={() => (addProblem = null)}
					onkeydown={(e) => {
						if (e.key !== 'Enter') return;
						e.preventDefault();
						add();
					}}
				/>
				<button type="button" class="small" disabled={adding.trim() === ''} onclick={add}
					><Plus size={14} aria-hidden="true" />Add</button
				>
			</div>
			{#if addProblem}<span class="problem" role="alert">{addProblem}</span>{/if}
		{/if}
	</div>
{:else if field.kind === 'map'}
	<div class="map">
		{#each pairs as [k, x] (k)}
			<div class="pair">
				<span class="mono name">{k}</span>
				{#if opts}
					<select
						aria-label={`${k} — ${label}`}
						value={JSON.stringify(x)}
						{disabled}
						onchange={(e) => setPair(k, JSON.parse(e.currentTarget.value))}
					>
						{#if !opts.some((o) => same(o.value, x))}<option value={JSON.stringify(x)}
								>{entry(x)}</option
							>{/if}
						{#each opts as o (String(o.value))}<option value={JSON.stringify(o.value)}
								>{o.label}</option
							>{/each}
					</select>
				{:else}
					<input
						aria-label={`${k} — ${label}`}
						value={entry(x)}
						{disabled}
						oninput={(e) => setPair(k, e.currentTarget.value)}
					/>
				{/if}
				{#if !disabled}<button
						type="button"
						class="small remove"
						aria-label={`Remove ${k}`}
						onclick={() => onchange(Object.fromEntries(pairs.filter(([n]) => n !== k)))}
						><X size={14} aria-hidden="true" /></button
					>{/if}
			</div>
		{/each}
		{#if !disabled}
			<div class="pair">
				<input
					{id}
					class="mono name"
					bind:value={newName}
					placeholder={field.placeholder ?? 'name'}
					aria-label={`New name for ${label}`}
					spellcheck="false"
					oninput={() => (mapProblem = null)}
					onkeydown={(e) => {
						if (e.key !== 'Enter') return;
						e.preventDefault();
						addPair();
					}}
				/>
				{#if opts}
					<select bind:value={newValue} aria-label={`Its value`}>
						{#each opts as o (String(o.value))}<option value={o.value}>{o.label}</option>{/each}
					</select>
				{:else}
					<input bind:value={newValue} aria-label="Its value" />
				{/if}
				<button type="button" class="small" disabled={newName.trim() === ''} onclick={addPair}
					><Plus size={14} aria-hidden="true" />Add</button
				>
			</div>
			{#if mapProblem}<span class="problem" role="alert">{mapProblem}</span>{/if}
		{/if}
	</div>
{:else if field.kind === 'table'}
	<div class="table">
		{#each rows as row, i (i)}
			<fieldset class="row">
				<legend>{entry(row[field.key_by ?? columns[0]?.key ?? ''] ?? '') || `Row ${i + 1}`}</legend>
				{#each columns.filter((c) => c.key !== undefined) as c (c.key)}
					<label class="cell">
						<span>{c.label ?? c.key}</span>
						<Self
							field={c}
							value={row[c.key!]}
							id={`${id}-${i}-${c.key}`}
							label={c.label ?? c.key}
							onchange={(v) => setCell(i, c.key!, v)}
						/>
					</label>
				{/each}
				{#if !disabled}
					<button
						type="button"
						class="small remove"
						onclick={() => onchange(rows.filter((_, j) => j !== i))}>Remove</button
					>
				{/if}
			</fieldset>
		{/each}
		{#if !disabled}
			<button type="button" class="small" onclick={() => onchange([...rows, {}])}
				><Plus size={14} aria-hidden="true" />Add</button
			>
		{/if}
	</div>
{:else}
	<div class="typed">
		<input
			{id}
			class:invalid
			class:mono={numeric(field.kind) ||
				field.kind === 'host' ||
				field.kind === 'url' ||
				field.render === 'path'}
			style:width
			{disabled}
			{placeholder}
			inputmode={numeric(field.kind)
				? field.kind === 'number'
					? 'decimal'
					: 'numeric'
				: undefined}
			type={field.kind === 'url' ? 'url' : 'text'}
			autocomplete="off"
			spellcheck="false"
			value={text}
			oninput={(e) => typed(e.currentTarget.value)}
		/>
		{#if field.unit}<span class="unit">{unitName(field.unit)}</span>{/if}
		{#if value === undefined && field.default !== undefined}<span class="default">default</span
			>{/if}
	</div>
{/if}

<style>
	.map {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	.pair {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.pair .name {
		flex: 1 1 auto;
		min-width: 0;
	}
	.pair span.name {
		overflow-wrap: anywhere;
	}
	input,
	select {
		height: 40px;
		box-sizing: border-box;
		max-width: 100%;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		outline: none;
	}
	input:focus,
	select:focus {
		border-color: var(--accent);
	}
	input.invalid,
	select.invalid {
		border-color: var(--alert);
	}
	input:disabled,
	select:disabled {
		opacity: 0.6;
	}
	.mono {
		font-family: var(--font-num);
	}
	.typed,
	.secret {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		min-width: 0;
	}
	.typed input {
		flex: 0 1 auto;
	}
	.unit,
	.default {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.default {
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--surface-2);
	}
	.dots {
		font-family: var(--font-num);
		color: var(--ink-muted);
	}
	.small {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.small:disabled {
		opacity: 0.5;
	}
	.segmented {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.segmented button {
		height: 34px;
		padding: 0 14px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
	}
	.segmented button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: 32px;
		padding: 0 4px 0 12px;
		border-radius: 16px;
		background: var(--surface-2);
		font-family: var(--font-num);
		font-size: 13px;
	}
	.chip button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: 13px;
		background: none;
		color: var(--ink-muted);
	}
	.add {
		display: flex;
		gap: 6px;
	}
	.pick {
		height: 34px;
		width: auto;
	}
	.add input {
		height: 34px;
		width: 18ch;
	}
	.problem {
		flex-basis: 100%;
		color: var(--alert);
		font-size: 13px;
	}
	.table {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--space-2) var(--space-3);
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: 12px;
	}
	legend {
		padding: 0 6px;
		font-weight: 700;
		font-family: var(--font-num);
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.remove {
		justify-self: start;
		align-self: end;
		color: var(--alert);
	}
</style>
