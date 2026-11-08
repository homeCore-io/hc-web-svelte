<!--
	A look's areas (14 §8, N2): rows of named areas on the room's 12 columns.
	Click one to rename it, size it against its neighbor, split it, move it
	along its row or remove it. Each area says what starts in it (N3).
-->
<script lang="ts">
	import { AREA_SHAPES, addRow, remove, rename, resize, shift, split } from '#lib/looks/areas.js';
	import { LIT_AREAS, areaFor, type Area, type Grouping } from '#lib/looks/model.js';

	let {
		grouping,
		set
	}: {
		grouping: Grouping;
		set: (rows: Area[][]) => void;
	} = $props();

	const rows = $derived(grouping.areas ?? LIT_AREAS);
	let sel = $state<string | null>(null);
	const picked = $derived(rows.flat().find((a) => a.id === sel));
	const shape = $derived(
		AREA_SHAPES.find((s) => JSON.stringify(s.rows) === JSON.stringify(rows))?.id
	);
	const last = $derived(rows.flat().at(-1)?.id);
	/** What starts in each area, by its rules' titles; the last also takes the rest. */
	const takes = $derived.by(() => {
		const out = new Map<string, string[]>();
		for (const r of grouping.room ?? []) {
			const a = areaFor(grouping, r);
			if (a) out.set(a.id, [...(out.get(a.id) ?? []), r.title]);
		}
		if (last) out.set(last, [...(out.get(last) ?? []), 'anything else']);
		return out;
	});
	const hue = (i: number) => `hsl(${(i * 67 + 40) % 360} 70% 60%)`;
	const order = $derived(new Map(rows.flat().map((a, i) => [a.id, i])));
</script>

<div class="areas">
	<div class="shapes" role="group" aria-label="Start from">
		<span class="quiet">Start from</span>
		{#each AREA_SHAPES as s (s.id)}
			<button
				class="shape"
				aria-pressed={shape === s.id}
				onclick={() => {
					set(structuredClone(s.rows));
					sel = null;
				}}>{s.name}</button
			>
		{/each}
	</div>
	{#each rows as row, r (r)}
		<div class="row12" role="group" aria-label={`Row ${r + 1} of areas`}>
			{#each row as a (a.id)}
				<button
					class="area"
					style={`grid-column: span ${a.w}; --hue: ${hue(order.get(a.id) ?? 0)}`}
					aria-pressed={sel === a.id}
					onclick={() => (sel = sel === a.id ? null : a.id)}
				>
					<b>{a.name}</b>
					<small>{a.w} wide</small>
					<small class="what">{(takes.get(a.id) ?? []).join(', ') || 'nothing yet'}</small>
				</button>
			{/each}
		</div>
	{/each}
	{#if picked}
		<div class="picked">
			<label
				>Name <input
					value={picked.name}
					oninput={(e) => set(rename(rows, picked.id, e.currentTarget.value))}
				/></label
			>
			<div class="line">
				<span class="quiet">Width</span>
				<button class="icon" aria-label="Narrower" onclick={() => set(resize(rows, picked.id, -1))}
					>−</button
				>
				<span class="n">{picked.w}</span>
				<button class="icon" aria-label="Wider" onclick={() => set(resize(rows, picked.id, 1))}
					>+</button
				>
				<span class="quiet">its neighbor gives or takes</span>
			</div>
			<div class="line">
				<button
					class="plain"
					disabled={picked.w < 4}
					onclick={() => {
						const out = split(rows, picked.id);
						set(out.rows);
						if (out.id) sel = out.id;
					}}>Split in two</button
				>
				<button class="plain" onclick={() => set(shift(rows, picked.id, -1))}>← Move</button>
				<button class="plain" onclick={() => set(shift(rows, picked.id, 1))}>Move →</button>
				<button
					class="plain danger"
					disabled={rows.flat().length < 2}
					onclick={() => {
						set(remove(rows, picked.id));
						sel = null;
					}}>Remove</button
				>
			</div>
			<small class="quiet"
				>{picked.w <= 4
					? 'Four columns or fewer: its cards are one a row, as wide as it.'
					: 'Its cards sit side by side, at their own sizes.'}</small
			>
		</div>
	{/if}
	<button
		class="plain"
		onclick={() => {
			const out = addRow(rows);
			set(out.rows);
			sel = out.id;
		}}>+ A row of areas</button
	>
</div>

<style>
	.areas {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.shapes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		font-size: 12.5px;
	}
	.shape {
		min-height: 30px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
	}
	.shape[aria-pressed='true'] {
		border-color: var(--accent);
		color: var(--accent);
	}
	.row12 {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 4px;
		padding: 4px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
	}
	.area {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 60px;
		min-width: 0;
		padding: 4px;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--hue) 45%, transparent);
		background: color-mix(in srgb, var(--hue) 10%, transparent);
		color: var(--ink);
	}
	.area[aria-pressed='true'] {
		border: 2px solid var(--hue);
		background: color-mix(in srgb, var(--hue) 22%, transparent);
	}
	.area b {
		font-size: 12.5px;
		white-space: nowrap;
	}
	.area small {
		font-size: 11px;
		color: var(--ink-muted);
	}
	.area .what {
		color: var(--ink);
		text-align: center;
		line-height: 1.3;
	}
	.picked {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface-2);
	}
	.picked label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12.5px;
	}
	.picked input {
		flex: 1;
		min-width: 0;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		font-size: 12.5px;
	}
	.n {
		width: 24px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.icon {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
	}
	.plain {
		min-height: 32px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		align-self: flex-start;
	}
	.plain:disabled {
		opacity: 0.5;
	}
	.danger {
		color: var(--bad, #e58a8a);
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
