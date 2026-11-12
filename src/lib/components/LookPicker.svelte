<!--
	The look (13 §3): Classic, Lit, Console, the house's own, a person's own. The
	house's on Settings › Look; a person's on Me, where "Same as the house"
	leaves it to the house (L1).
-->
<script lang="ts">
	import { drawingOf, shellOf, type Look } from '#lib/looks/model.js';

	let {
		label,
		looks,
		current,
		house,
		pick
	}: {
		label: string;
		/** The looks to choose from. */
		looks: readonly Look[];
		/** The look chosen here; none for "Same as the house". */
		current: string | undefined;
		/** The house's look, when a person may leave it to the house. */
		house?: Look;
		pick: (id: string | undefined) => void;
	} = $props();

	// A hint of each: Lit's glow where a look draws lights its way.
	const glows = (l: Look) => drawingOf(l, 'lights') === 'lit';
	// The console's dark desk, with a lit fader in it.
	const desk = (l: Look) => shellOf(l) === 'console';
</script>

<div class="looks" role="radiogroup" aria-label={label}>
	{#if house !== undefined}
		<button role="radio" aria-checked={current === undefined} onclick={() => pick(undefined)}>
			<b>Same as the house</b>
			<small>{house.name}</small>
		</button>
	{/if}
	{#each looks as l (l.id)}
		<button role="radio" aria-checked={current === l.id} onclick={() => pick(l.id)}>
			<span class="sample" class:lit={glows(l)} class:desk={desk(l)} aria-hidden="true"
				><span></span><span></span><span></span></span
			>
			<b>{l.name}</b>
			{#if l.sub}<small>{l.sub}</small>{/if}
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
	.sample.desk {
		grid-template-columns: 1fr 3fr;
		background: linear-gradient(180deg, #1a1d24, #0c0d11);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}
	.sample.desk span {
		background: rgba(255, 255, 255, 0.07);
	}
	.sample.desk span:first-child {
		grid-row: span 2;
	}
	.sample.desk span:nth-child(2) {
		background: linear-gradient(90deg, #ff8a3d, #ffd9a8 60%, rgba(255, 255, 255, 0.07) 60%);
		box-shadow: 0 0 8px rgba(255, 170, 80, 0.45);
	}
	.sample.lit span:first-child {
		background: linear-gradient(90deg, rgba(255, 180, 90, 0.25) 70%, var(--surface-2) 70%);
	}
</style>
