<!--
	A rule's phrase (A2): devices by name in bold, anything the house doesn't
	have marked, scripts and topics as written, a person with their picture.
-->
<script lang="ts">
	import type { Phrase } from '#lib/ruleWords.js';
	import Avatar from '../Avatar.svelte';

	let { words }: { words: Phrase } = $props();
</script>

{#each words as b, i (i)}{#if b.missing}<strong
			class="missing"
			title="The house has no device by this name">{b.t}</strong
		>{:else if b.person !== undefined}<span class="who"
			><Avatar person={b.person || undefined} name={b.t} size={16} /><strong>{b.t}</strong></span
		>{:else if b.todo}<em class="todo">{b.t}</em>{:else if b.device}<strong>{b.t}</strong
		>{:else if b.code}<code>{b.t}</code>{:else}{b.t}{/if}{/each}

<style>
	strong {
		font-weight: 700;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		vertical-align: -3px;
	}
	.todo {
		color: var(--ink-muted);
		font-style: normal;
	}
	.missing {
		color: var(--alert);
		text-decoration: underline wavy var(--alert);
		text-underline-offset: 3px;
	}
	code {
		font-family: var(--font-num);
		font-size: 0.9em;
		padding: 0 4px;
		border-radius: 5px;
		background: var(--surface-2);
		overflow-wrap: anywhere;
	}
</style>
