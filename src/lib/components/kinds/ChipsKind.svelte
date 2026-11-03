<!-- What's going on in the house (D1): lights on, doors open, playing, leaks. -->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import Icon from '../Icon.svelte';

	let { card }: KindProps<'chips'> = $props();
</script>

<nav class="chips" aria-label="What's going on">
	{#each card.chips as c (c.key)}
		<a class="chip" class:alert={c.alert} href={`/on/${c.key}`}>
			<Icon name={c.icon} size={16} />
			{c.text}
		</a>
	{/each}
</nav>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px 0 10px;
		border-radius: 18px;
		border: 1px solid var(--lit-card-line);
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.chip.alert {
		border-color: var(--alert-line);
		background: var(--alert-bg);
		color: var(--alert);
	}
</style>
