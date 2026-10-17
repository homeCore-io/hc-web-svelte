<!--
	Steps in order (A3): a rule's Do, or the steps inside an if/otherwise or
	"at the same time". Add one by what it does.
-->
<script lang="ts">
	import StepEdit from './StepEdit.svelte';
	import { STEP_KINDS, newStep, type StepKind } from '#lib/ruleEdit.js';
	import { editor } from './context.js';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		steps,
		onchange,
		enabled,
		onenabled,
		addLabel = '+ Add a step'
	}: {
		steps: Json[];
		onchange: (steps: Json[]) => void;
		/** Top-level steps can each be turned off. */
		enabled?: boolean[];
		onenabled?: (i: number, on: boolean) => void;
		addLabel?: string;
	} = $props();

	const ctx = editor();
	let adding = $state(false);
	let opened = $state<number | null>(null);

	const move = (i: number, by: number) => {
		const next = [...steps];
		const [x] = next.splice(i, 1);
		next.splice(i + by, 0, x);
		onchange(next);
		opened = null;
	};
	function add(kind: StepKind) {
		onchange([...steps, newStep(kind, ctx.scenes[0]?.id ?? '')]);
		opened = steps.length;
		adding = false;
	}
</script>

<div class="list">
	{#each steps as s, i (i)}
		<StepEdit
			value={s}
			number={i + 1}
			open={opened === i}
			off={enabled ? enabled[i] === false : false}
			ontoggle={onenabled ? (on) => onenabled(i, on) : undefined}
			onchange={(v) => onchange(steps.map((x, j) => (j === i ? v : x)))}
			onremove={() => onchange(steps.filter((_, j) => j !== i))}
			onup={i > 0 ? () => move(i, -1) : undefined}
			ondown={i < steps.length - 1 ? () => move(i, 1) : undefined}
		/>
	{/each}
	{#if adding}
		<div class="menu" role="group" aria-label="What the step does">
			{#each STEP_KINDS as k (k.kind)}
				<button type="button" onclick={() => add(k.kind)}
					><strong>{k.label}</strong>{#if k.sub}<span>{k.sub}</span>{/if}</button
				>
			{/each}
			<button type="button" class="cancel" onclick={() => (adding = false)}>Cancel</button>
		</div>
	{:else}
		<button type="button" class="add" onclick={() => (adding = true)}>{addLabel}</button>
	{/if}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-basis: 100%;
		min-width: 0;
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
	.menu {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 6px;
		padding: var(--space-2);
		border-radius: 12px;
		border: 1px dashed var(--line);
	}
	.menu button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.menu span {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.menu .cancel {
		justify-content: center;
		color: var(--ink-muted);
	}
</style>
