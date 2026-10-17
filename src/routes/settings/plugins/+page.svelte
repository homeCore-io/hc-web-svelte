<!--
	Plugins (A4): what connects homeCore to devices — each running or not,
	its devices, its version and any newer one in the registry; what's wrong
	first. Adding one, and the plugin runtimes.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { notInstalled, rowsOf, type PluginRecord, type RegistryPlugin } from '#lib/plugins.js';
	import { loadRegistry, loadRuntimes, loadStatus } from '#lib/pluginAdmin.js';

	let list = $state<PluginRecord[] | null>(null);
	let failed = $state<string | null>(null);
	let registry = $state<RegistryPlugin[]>([]);
	let noRegistry = $state<string | null>(null);
	let runtimes = $state<{ pending: number; all: number } | null>(null);

	async function load() {
		const res = await loadStatus();
		if (!res.ok) return void (failed = res.error);
		failed = null;
		list = res.data;
	}
	onMount(() => {
		void load();
		void loadRegistry().then((r) => (r.ok ? (registry = r.data.plugins) : (noRegistry = r.error)));
		void loadRuntimes().then((r) => {
			if (r.ok)
				runtimes = {
					pending: r.data.runtimes.filter((x) => x.status === 'pending').length,
					all: r.data.runtimes.length
				};
		});
		// Status changes are announced; heartbeats aren't, so read again now and then.
		const stop = live.listen((f) => {
			if ((f as { type: string }).type === 'plugin_status_changed') void load();
		});
		const every = setInterval(load, 30_000);
		return () => {
			stop();
			clearInterval(every);
		};
	});

	const rows = $derived(list ? rowsOf(list, registry, clock.now) : []);
	const running = $derived(rows.filter((r) => r.state.word === 'Running').length);
	const updates = $derived(rows.filter((r) => r.update).length);
	const more = $derived(list ? notInstalled(registry, list) : []);
	const href = (id: string) => `/settings/plugins/${encodeURIComponent(id)}`;
</script>

{#if !session.isAdmin}
	<p class="quiet">Plugins are for the house’s admins.</p>
{:else}
	<div class="page">
		<div class="tools">
			<span class="sum">
				{running} running{updates ? ` · ${updates} ${updates === 1 ? 'update' : 'updates'}` : ''}
			</span>
			<a class="plain" href="/settings/plugins/runtimes"
				>Plugin runtimes · {runtimes
					? runtimes.pending
						? `${runtimes.pending} waiting`
						: runtimes.all || 'none'
					: '…'}</a
			>
			<a class="go" href="/settings/plugins/add">+ Add a plugin</a>
		</div>

		{#if failed}
			<p class="note bad" role="alert">{failed}</p>
		{:else if list === null}
			<p class="quiet">Loading…</p>
		{:else if rows.length === 0}
			<p class="quiet">No plugins yet — add one to connect homeCore to your devices.</p>
		{:else if wide.current}
			<div class="table" role="table" aria-label="Plugins">
				<div class="row head" role="row">
					<span role="columnheader">Plugin</span>
					<span role="columnheader">Version</span>
					<span role="columnheader">Devices</span>
					<span role="columnheader">Running</span>
				</div>
				{#each rows as r (r.id)}
					<a class="row" role="row" href={href(r.id)}>
						<span role="cell" class="who">
							<strong>{r.name}</strong>
							<span class="what">{r.notice ? r.notice.message : r.what || r.id}</span>
						</span>
						<span role="cell" class="ver">
							{r.version ?? '—'}
							{#if r.update}<span class="upd">Update to {r.update}</span>{/if}
						</span>
						<span role="cell" class="num">{r.devices}</span>
						<span role="cell" class="state {r.state.tone}"
							><b>{r.state.word}</b> {r.state.detail}</span
						>
					</a>
				{/each}
			</div>
		{:else}
			<ul class="list">
				{#each rows as r (r.id)}
					<li>
						<a href={href(r.id)}>
							<span class="text">
								<strong>{r.name}</strong>
								<span class="sub {r.state.tone}"
									>{r.state.word} · {r.devices} devices · {r.version ?? '—'}</span
								>
								{#if r.notice}<span class="sub bad">{r.notice.message}</span>{/if}
							</span>
							{#if r.update}<span class="upd">Update</span>{/if}
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		{#if more.length}
			<section class="more">
				<h2>Also in the registry</h2>
				<ul>
					{#each more as m (m.id)}
						<li>
							<span><strong>{m.name}</strong> {m.description}</span>
							<a class="plain" href={`/settings/plugins/add?id=${encodeURIComponent(m.id)}`}>Add</a>
						</li>
					{/each}
				</ul>
			</section>
		{:else if noRegistry}
			<p class="quiet">The registry: {noRegistry}</p>
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.sum {
		flex: 1;
		color: var(--ink-muted);
	}
	.plain,
	.go {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.table {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 1.1fr) 80px minmax(0, 1.3fr);
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.row + .row {
		border-top: 1px solid var(--line);
	}
	a.row:hover {
		background: color-mix(in srgb, var(--surface-2) 40%, var(--surface));
	}
	.head {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.what {
		color: var(--ink-muted);
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ver {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-num);
		font-size: 13px;
	}
	.upd {
		align-self: flex-start;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-family: var(--font);
		font-size: 12px;
		font-weight: 700;
	}
	.num {
		font-family: var(--font-num);
	}
	.state {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.state b {
		color: var(--ink);
	}
	.state.bad b,
	.sub.bad,
	.bad {
		color: var(--alert);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 58px;
		padding: 8px var(--space-3) 8px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.list :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.more {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0 4px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.more ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.more li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
	}
	.more li + li {
		border-top: 1px solid var(--line);
	}
	.more li > span {
		flex: 1;
		color: var(--ink-muted);
		font-size: 13.5px;
	}
	.more strong {
		color: var(--ink);
		margin-right: 6px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		font-weight: 600;
	}
</style>
