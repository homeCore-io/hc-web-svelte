<!--
	A `sensor` field (G-b): the natural choice ("Average of the room's
	sensors"), none, or sensors chosen in the picker — one, or an average.
	Its options are the field's own; the value is `auto`, `none` or a list of
	device ids.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type Devices } from '#lib/devices.js';
	import { same, type Field } from '#lib/descriptor.js';
	import { sourceOf } from '#lib/options.js';
	import { degrees, percent, sourced } from '#lib/roomBox.js';
	import SensorPicker from './SensorPicker.svelte';

	let {
		field,
		value,
		label,
		onchange
	}: { field: Field; value: unknown; label: string; onchange: (value: unknown) => void } = $props();

	const attr = $derived(field.source?.capability ?? 'temperature');
	// `render: 'one'` (G-c): one device, no average — a chart, a weather card.
	const one = $derived(field.render === 'one');
	// `render: 'many'` (13 §13.1, H1): several, each its own (a chart to compare), never an average.
	const many = $derived(field.render === 'many');
	// A choice of the field's own (`room`, say), as it was given.
	const given = $derived(value ?? field.default);
	const source = $derived(sourceOf(value ?? field.default));
	const ids = $derived(Array.isArray(source) ? source : []);
	let picking = $state(false);

	const text = (n: number | undefined) => (attr === 'humidity' ? percent(n) : degrees(n)) ?? '—';
	const nameOf = (all: Devices, id: string) =>
		all[id] ? displayName(all[id]) : 'A sensor that’s gone';
	const chosenName = $derived(
		ids.length === 1
			? nameOf(devices.byId, ids[0]!)
			: many
				? `${ids.length} sensors`
				: `Average of ${ids.length} sensors`
	);
	const chosenSub = $derived(ids.map((id) => nameOf(devices.byId, id)).join(', '));
</script>

<div class="sources" role="radiogroup" aria-label={label}>
	{#each field.options ?? [] as o (String(o.value))}
		<button
			type="button"
			role="radio"
			aria-checked={same(source, o.value) || (!Array.isArray(given) && same(given, o.value))}
			onclick={() => onchange(o.value)}
		>
			<span class="dot" aria-hidden="true"></span>
			<span class="name">{o.label}</span>
		</button>
	{/each}
	{#if ids.length > 0}
		<button type="button" role="radio" aria-checked="true" onclick={() => (picking = true)}>
			<span class="dot" aria-hidden="true"></span>
			<span class="what">
				<span class="name">{chosenName}</span>
				{#if ids.length > 1}<span class="sub">{chosenSub}</span>{/if}
			</span>
			{#if !many}<span class="mono">{text(sourced(source, attr, devices.byId, []))}</span>{/if}
		</button>
	{/if}
	<button type="button" class="choose" onclick={() => (picking = true)}>
		{ids.length > 0
			? one
				? 'Choose another sensor…'
				: 'Choose other sensors…'
			: 'Choose any sensor in the house…'}
	</button>
</div>
{#if picking}
	<SensorPicker
		{attr}
		{label}
		value={ids}
		near={field.near}
		{one}
		onpick={(next) => onchange(next)}
		close={() => (picking = false)}
	/>
{/if}

<style>
	.sources {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}
	button[role='radio'] {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 12px;
		border-radius: 12px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	button[aria-checked='true'] {
		background: var(--surface);
		border-color: var(--accent);
	}
	.dot {
		width: 16px;
		height: 16px;
		flex: none;
		box-sizing: border-box;
		border-radius: 50%;
		border: 2px solid var(--line);
		background: var(--surface);
	}
	[aria-checked='true'] .dot {
		border: 5px solid var(--accent);
	}
	.what {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-size: 14px;
		font-weight: 600;
		flex: 1;
	}
	.what .name {
		flex: none;
	}
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.mono {
		font-family: var(--font-num);
		font-size: 14px;
	}
	.choose {
		align-self: flex-start;
		min-height: 36px;
		padding: 0 4px;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
</style>
