<!--
	Choosing a phone bar (N2): up to four places, in order, then More. Used on
	Me for a person's own bar and in Settings for the household's.
-->
<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';
	import { BAR_CHOICES, BAR_SIZE, nudgeFavourite } from '#lib/layers.js';
	import { rooms } from '#lib/rooms.svelte.js';

	let { bar, label, set }: { bar: string[]; label: string; set: (next: string[]) => void } =
		$props();

	const NAMES: Record<string, string> = {
		home: 'Home',
		pages: 'Pages',
		scenes: 'Scenes',
		alerts: 'Alerts',
		search: 'Search'
	};
	const nameOf = (d: string) =>
		d.startsWith('room:')
			? (rooms.list.find((r) => `room:${r.id}` === d)?.name ?? 'Room')
			: NAMES[d]!;
	const addable = $derived([
		...BAR_CHOICES.filter((d) => !bar.includes(d)),
		...rooms.list.map((r) => `room:${r.id}`).filter((d) => !bar.includes(d))
	]);
</script>

<ol class="bar" aria-label={label}>
	{#each bar as d, i (d)}
		<li>
			<span>{nameOf(d)}</span>
			<button
				aria-label={`Move ${nameOf(d)} left`}
				disabled={i === 0}
				onclick={() => set(nudgeFavourite(bar, d, -1))}><ArrowUp size={16} /></button
			>
			<button
				aria-label={`Move ${nameOf(d)} right`}
				disabled={i === bar.length - 1}
				onclick={() => set(nudgeFavourite(bar, d, 1))}><ArrowDown size={16} /></button
			>
			<button
				aria-label={`Take ${nameOf(d)} off the bar`}
				disabled={bar.length === 1}
				onclick={() => set(bar.filter((x) => x !== d))}><X size={16} /></button
			>
		</li>
	{/each}
	<li class="more"><span>More</span></li>
</ol>
{#if bar.length < BAR_SIZE}
	<label class="add">
		<span>Add</span>
		<select
			value=""
			onchange={(e) => {
				const v = e.currentTarget.value;
				if (v) set([...bar, v]);
				e.currentTarget.value = '';
			}}
		>
			<option value="" disabled>Choose a place…</option>
			{#each addable as d (d)}<option value={d}>{nameOf(d)}</option>{/each}
		</select>
	</label>
{/if}

<style>
	.bar {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar li {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: var(--target);
		padding: 0 6px 0 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.bar li span {
		flex: 1;
		font-weight: 600;
	}
	.bar li button {
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bar li button:disabled {
		opacity: 0.3;
	}
	.bar .more {
		color: var(--ink-muted);
		background: none;
		border-style: dashed;
	}
	.add {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
	}
	.add select {
		flex: 1;
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
</style>
