<!--
	A `list` field drawn as `order` (G-b): every option with a switch, the
	chosen ones first in their order, each movable up. The value is the chosen
	options' values, in order.
-->
<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import { same, type Field } from '#lib/descriptor.js';
	import Toggle from '../Toggle.svelte';

	let {
		field,
		value,
		label,
		onchange
	}: { field: Field; value: unknown; label: string; onchange: (value: unknown) => void } = $props();

	const opts = $derived(field.options ?? []);
	const chosen = $derived(
		(Array.isArray(value) ? value : Array.isArray(field.default) ? field.default : []).filter(
			(v: unknown) => opts.some((o) => same(o.value, v))
		)
	);
	const rows = $derived([
		...chosen.map((v) => ({ o: opts.find((o) => same(o.value, v))!, on: true })),
		...opts.filter((o) => !chosen.some((v) => same(v, o.value))).map((o) => ({ o, on: false }))
	]);
	function up(i: number) {
		const next = [...chosen];
		[next[i - 1], next[i]] = [next[i], next[i - 1]];
		onchange(next);
	}
	const toggle = (v: unknown, on: boolean) =>
		onchange(on ? [...chosen, v] : chosen.filter((x) => !same(x, v)));
</script>

<ol class="order" aria-label={label}>
	{#each rows as r, i (String(r.o.value))}
		<li class:off={!r.on}>
			<span class="name">{r.o.label}</span>
			{#if r.on}
				<button
					type="button"
					class="up"
					aria-label={`Move ${r.o.label} up`}
					disabled={i === 0}
					onclick={() => up(i)}><ArrowUp size={16} aria-hidden="true" /></button
				>
			{/if}
			<Toggle on={r.on} label={`Show ${r.o.label}`} onchange={(on) => toggle(r.o.value, on)} />
		</li>
	{/each}
</ol>

<style>
	.order {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 2px 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	li.off {
		background: transparent;
		border-style: dashed;
		border-color: var(--line);
	}
	.name {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
	}
	.up {
		width: 34px;
		height: 34px;
		border-radius: 9px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.up:disabled {
		opacity: 0.35;
	}
</style>
