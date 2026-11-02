<!--
	The look (12): Classic or Lit. The house's on Settings › Look; a person's on
	Me, where "Same as the house" leaves it to the house (L1).
-->
<script lang="ts">
	import { LOOKS, type LookId } from '#lib/layers.js';

	let {
		label,
		current,
		house,
		pick
	}: {
		label: string;
		/** The look chosen here; none for "Same as the house". */
		current: LookId | undefined;
		/** The house's look, when a person may leave it to the house. */
		house?: LookId;
		pick: (id: LookId | undefined) => void;
	} = $props();

	const houseName = $derived(LOOKS.find((l) => l.id === house)?.name);
</script>

<div class="looks" role="radiogroup" aria-label={label}>
	{#if house !== undefined}
		<button role="radio" aria-checked={current === undefined} onclick={() => pick(undefined)}>
			<b>Same as the house</b>
			<small>{houseName}</small>
		</button>
	{/if}
	{#each LOOKS as l (l.id)}
		<button role="radio" aria-checked={current === l.id} onclick={() => pick(l.id)}>
			<span class="sample {l.id}" aria-hidden="true"><span></span><span></span><span></span></span>
			<b>{l.name}</b>
			<small>{l.sub}</small>
		</button>
	{/each}
</div>

<style>
	.looks {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 8px;
	}
	button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 12px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		text-align: left;
	}
	button[aria-checked='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	small {
		color: var(--ink-muted);
		font-size: 12px;
		line-height: 1.35;
	}
	/* A hint of each: Classic's even tiles; Lit's glow and a card filled as it dims. */
	.sample {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
		width: 100%;
		height: 34px;
		margin-bottom: 4px;
		padding: 4px;
		box-sizing: border-box;
		border-radius: 8px;
		background: var(--bg);
	}
	.sample span {
		border-radius: 4px;
		background: var(--surface-2);
	}
	.sample.lit {
		background:
			radial-gradient(ellipse 60% 120% at 70% 120%, rgba(255, 180, 90, 0.45), transparent 70%),
			var(--bg);
	}
	.sample.lit span:first-child {
		background: linear-gradient(90deg, rgba(255, 180, 90, 0.25) 70%, var(--surface-2) 70%);
	}
</style>
