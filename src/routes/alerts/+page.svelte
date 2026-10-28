<!--
	Alerts (N7): everything the house's state says needs attention, as
	homeCore raised it (H4). Each clears itself when the state does.
-->
<script lang="ts">
	import { alerts } from '#lib/alerts.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import AlertList from '#lib/components/AlertList.svelte';
	import { acknowledgeAlert } from '#lib/admin.js';
	import { core } from '#lib/core.svelte.js';

	const unseen = $derived(alerts.list.filter((a) => !a.acknowledged));
	const canSee = $derived(core.since('0.1.81') && session.can('devices:command'));
	let busy = $state(false);
	let note = $state<string | null>(null);
	async function seeAll() {
		busy = true;
		const fails = (await Promise.all(unseen.map((a) => acknowledgeAlert(a.id)))).filter(Boolean);
		busy = false;
		note = fails[0] ?? null;
	}
</script>

<div class="stack">
	{#if !alerts.known}
		<p class="quiet">This homeCore doesn't report alerts yet — it needs v0.1.76 or later.</p>
	{:else if alerts.list.length === 0}
		<p class="calm">Nothing needs attention.</p>
	{:else}
		<div class="head">
			<span class="count"
				>{alerts.list.length}
				{alerts.list.length === 1 ? 'alert' : 'alerts'}{unseen.length < alerts.list.length
					? ` · ${unseen.length} not seen`
					: ''}</span
			>
			{#if canSee && unseen.length > 0}
				<button type="button" class="all" disabled={busy} onclick={seeAll}>Mark all seen</button>
			{/if}
		</div>
		{#if note}<p class="note" role="alert">{note}</p>{/if}
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
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: calc(-1 * var(--space-2));
	}
	.count {
		flex: 1;
		color: var(--ink-muted);
	}
	.all {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
	}
	.note {
		margin: 0;
		color: var(--alert);
		font-weight: 600;
	}
	.link {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
</style>
