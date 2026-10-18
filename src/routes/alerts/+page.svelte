<!--
	Alerts (N7): everything the house's state says needs attention, as
	homeCore raised it (H4). Each clears itself when the state does.
-->
<script lang="ts">
	import { alerts } from '#lib/alerts.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import AlertList from '#lib/components/AlertList.svelte';
</script>

<div class="stack">
	{#if !alerts.known}
		<p class="quiet">This homeCore doesn't report alerts yet — it needs v0.1.76 or later.</p>
	{:else if alerts.list.length === 0}
		<p class="calm">Nothing needs attention.</p>
	{:else}
		<AlertList list={alerts.list} act />
	{/if}
	{#if session.can('automations:write')}
		<a class="link" href="/settings/alerts">Alert rules, and what’s ignored</a>
	{/if}
</div>

<style>
	.stack {
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}
	.quiet,
	.calm {
		margin: 0;
		color: var(--ink-muted);
	}
	.calm {
		font-size: 16px;
	}
	.link {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
</style>
