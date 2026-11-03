<!--
	How a part of a rule is added — a trigger, a check or a step — all the
	same way (#47): its kinds as tiles, each saying what it is, and Cancel.
-->
<script lang="ts" generics="K extends string">
	let {
		kinds,
		label,
		onpick,
		oncancel
	}: {
		kinds: { kind: K; label: string; sub?: string }[];
		label: string;
		onpick: (kind: K) => void;
		oncancel: () => void;
	} = $props();
</script>

<div class="picker" role="group" aria-label={label}>
	<div class="menu">
		{#each kinds as k (k.kind)}
			<button type="button" onclick={() => onpick(k.kind)}
				><strong>{k.label}</strong>{#if k.sub}<span>{k.sub}</span>{/if}</button
			>
		{/each}
	</div>
	<button type="button" class="cancel" onclick={oncancel}>Cancel</button>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-2);
		border-radius: 12px;
		border: 1px dashed var(--line);
	}
	.menu {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 6px;
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
	.cancel {
		align-self: flex-start;
		min-height: 0;
		padding: 2px 4px;
		border: none;
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
</style>
