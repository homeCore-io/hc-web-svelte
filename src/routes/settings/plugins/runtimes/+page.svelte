<!--
	Plugin runtimes (A4): containers that run plugins written in other
	languages. A runtime asks to join; an admin lets it in, or not, matching
	the code it shows. A token lets one join without asking.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ago } from '#lib/card.js';
	import { pluginLabel } from '#lib/inventory.js';
	import {
		approveRuntime,
		denyRuntime,
		loadPlacements,
		loadRuntimes,
		runtimeToken,
		type Placement,
		type Runtime
	} from '#lib/pluginAdmin.js';

	$effect(() => heading.show('Plugin runtimes', { href: '/settings/plugins', label: 'Plugins' }));

	let runtimes = $state<Runtime[] | null>(null);
	let note = $state<string | null>(null);
	let token = $state<{ token: string; expires_at: string } | null>(null);
	let placements = $state<Placement[]>([]);
	async function load() {
		const [r, p] = await Promise.all([loadRuntimes(), loadPlacements()]);
		if (!r.ok) return void (note = r.error);
		runtimes = r.data.runtimes;
		if (p.ok) placements = p.data;
	}
	const hosted = (id: string) => placements.filter((p) => p.runtime_id === id);
	onMount(() => {
		void load();
		const t = setInterval(load, 10_000);
		return () => clearInterval(t);
	});

	async function decide(r: Runtime, yes: boolean) {
		const res = yes ? await approveRuntime(r.runtime_id) : await denyRuntime(r.runtime_id);
		note = res.ok
			? `${r.hostname ?? r.runtime_id} ${yes ? 'may join' : 'was turned away'}.`
			: res.error;
		await load();
	}
	async function makeToken() {
		const r = await runtimeToken();
		if (!r.ok) return void (note = r.error);
		token = r.data;
	}
	const when = (iso?: string) => (iso ? `${ago(clock.now - Date.parse(iso))} ago` : '—');
</script>

{#if !session.isAdmin}
	<p class="quiet">Plugins are for the house’s admins.</p>
{:else}
	<div class="page">
		<p class="lead">
			A runtime is a container you run that hosts plugins written in other languages. It asks to
			join; you let it in by matching the code it shows.
		</p>
		{#if note}<p class="note" role="status">{note}</p>{/if}
		{#if runtimes === null}
			<p class="quiet">Loading…</p>
		{:else if runtimes.length === 0}
			<p class="quiet">No runtime has asked to join.</p>
		{:else}
			<ul class="list">
				{#each runtimes as r (r.runtime_id)}
					<li>
						<span class="who">
							<strong>{r.hostname ?? r.runtime_id}</strong>
							<span
								>{r.capabilities?.kind ?? ''}
								{r.capabilities?.arch ?? ''} · {r.source_ip ?? ''} · last seen {when(
									r.last_seen_at
								)}{r.plugin_id ? ` · joins as ${r.plugin_id}` : ''}</span
							>
							{#if r.status === 'approved'}
								{@const mine = hosted(r.runtime_id)}
								<span class="runs">
									{#if mine.length}Runs
										{#each mine as p, i (p.plugin_id)}{i > 0 ? ', ' : ''}<a
												href={`/settings/plugins/${encodeURIComponent(p.plugin_id)}`}
												>{pluginLabel(p.plugin_id)}</a
											>
											{p.version}{/each}{:else}Runs nothing yet — add a plugin written for it from
										<a href="/settings/plugins/add">the registry</a>.{/if}
								</span>
							{/if}
						</span>
						{#if r.status === 'pending'}
							<span class="code">Code <b>{r.code}</b></span>
							<button type="button" class="go" onclick={() => decide(r, true)}>Let it in</button>
							<button type="button" class="plain" onclick={() => decide(r, false)}>Turn away</button
							>
						{:else}
							<span class="st {r.status}">{r.status === 'approved' ? 'Joined' : 'Turned away'}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		<section class="card">
			<strong>Let one join without asking</strong>
			<span class="quiet"
				>A token, good for a day, for a runtime you set up yourself. It’s shown once.</span
			>
			{#if token}
				<code>{token.token}</code>
				<span class="quiet">Good until {new Date(token.expires_at).toLocaleString()}.</span>
			{:else}
				<button type="button" class="plain" onclick={makeToken}>Make a token</button>
			{/if}
		</section>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 900px;
	}
	.lead {
		margin: 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: 10px var(--space-4);
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.who {
		flex: 1 1 260px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.who .runs {
		color: var(--ink);
		font-size: 13px;
	}
	.who span {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.code b {
		font-family: var(--font-num);
		font-size: 16px;
	}
	.st.denied {
		color: var(--alert);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	code {
		font-family: var(--font-num);
		padding: 6px 10px;
		border-radius: 8px;
		background: var(--surface-2);
		overflow-wrap: anywhere;
	}
	.go,
	.plain {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
