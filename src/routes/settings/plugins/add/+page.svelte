<!--
	Adding a plugin (A4): from homeCore's signed registry — what each is, its
	versions; installing downloads it, checks its signature and starts it.
	It does nothing until it has its settings, so its settings come next.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { core } from '#lib/core.svelte.js';
	import {
		compareVersions,
		needsCore,
		sizeOf,
		versionOf,
		type PluginRecord,
		type RegistryPlugin
	} from '#lib/plugins.js';
	import {
		install,
		loadRegistry,
		loadRuntimes,
		loadStatus,
		runtimeName,
		runtimesToChoose,
		wasPlaced,
		type Runtime
	} from '#lib/pluginAdmin.js';

	$effect(() => heading.show('Add a plugin', { href: '/settings/plugins', label: 'Plugins' }));

	let registry = $state<RegistryPlugin[] | null>(null);
	let runtimes = $state<Runtime[]>([]);
	let have = $state<PluginRecord[]>([]);
	let failed = $state<string | null>(null);
	onMount(async () => {
		const [r, s, rt] = await Promise.all([loadRegistry(), loadStatus(), loadRuntimes()]);
		if (rt.ok) runtimes = rt.data.runtimes;
		if (!r.ok) return void (failed = r.error);
		registry = [...r.data.plugins].sort((a, b) => a.name.localeCompare(b.name));
		if (s.ok) have = s.data;
	});

	const chosenId = $derived(page.url.searchParams.get('id'));
	const chosen = $derived(
		registry?.find((p) => p.id === chosenId) ?? (wide.current ? registry?.[0] : undefined)
	);
	const versions = $derived(
		chosen
			? chosen.versions
					.map((v) => v.version)
					.sort(compareVersions)
					.reverse()
			: []
	);
	/** What a version needs that this homeCore isn't, or undefined. */
	const needs = (v: string) =>
		needsCore(
			chosen?.versions.find((x) => x.version === v),
			core.version
		);
	let version = $state('');
	// The newest this homeCore runs; the newest of all when none do.
	$effect(() => {
		void chosen;
		version = versions.find((v) => needs(v) === undefined) ?? versions[0] ?? '';
	});
	const tooNew = $derived(version ? needs(version) : undefined);
	const installed = $derived(chosen ? have.find((p) => p.plugin_id === chosen.id) : undefined);
	const pick = (id: string) =>
		void goto(`?id=${encodeURIComponent(id)}`, { replace: wide.current });

	let busy = $state(false);
	let note = $state<string | null>(null);
	// More than one runtime could run it: homeCore asks which, and so do we.
	let choices = $state<string[]>([]);
	let runOn = $state('');
	$effect(() => {
		void chosen;
		void version;
		choices = [];
		runOn = '';
	});
	let placed = $state<{ name: string; on: string } | null>(null);
	async function go() {
		if (!chosen) return;
		busy = true;
		placed = null;
		note = `Downloading ${chosen.name} and checking its signature…`;
		const r = await install(chosen.id, version, runOn || undefined);
		busy = false;
		if (!r.ok) {
			const ids = runtimesToChoose(r);
			if (!ids.length) return void (note = r.error);
			choices = ids;
			runOn = ids[0] ?? '';
			note = null;
			return;
		}
		if (wasPlaced(r.data)) {
			const id = r.data.placed_on;
			placed = {
				name: chosen.name,
				on: runtimeName(
					runtimes.find((x) => x.runtime_id === id),
					id
				)
			};
			choices = [];
			note = null;
			return;
		}
		void goto(`/settings/plugins/${encodeURIComponent(r.data.installed)}?tab=settings`);
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Plugins are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">The registry: {failed}</p>
{:else if registry === null}
	<p class="quiet">Reading the registry…</p>
{:else}
	<p class="quiet top">From the homeCore registry · signed releases</p>
	<div class="split" class:one={!wide.current}>
		{#if wide.current || !chosen}
			<ul class="list">
				{#each registry as p (p.id)}
					{@const mine = have.find((h) => h.plugin_id === p.id)}
					<li>
						<button
							type="button"
							aria-current={chosen?.id === p.id ? 'true' : undefined}
							onclick={() => pick(p.id)}
						>
							<strong>{p.name}</strong>
							<span>{p.description || 'No description in the registry.'}</span>
							{#if mine}<em>Installed · {versionOf(mine)}</em>{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if chosen}
			<section class="card">
				<h2>{chosen.name}</h2>
				<p>{chosen.description || 'No description in the registry.'}</p>
				<dl>
					<dt>Id</dt>
					<dd class="mono">{chosen.id}</dd>
					{#if chosen.category}<dt>Kind</dt>
						<dd>{chosen.category}</dd>{/if}
					<dt>Size</dt>
					<dd>{sizeOf(chosen, version) ?? '—'}</dd>
				</dl>
				<label>
					Version
					<select bind:value={version}
						>{#each versions as v, i (v)}<option value={v}
								>{v}{i === 0 ? ' — the latest' : ''}{needs(v)
									? ` — needs homeCore ${needs(v)}`
									: ''}</option
							>{/each}</select
					>
				</label>
				<p class="quiet">
					Downloads it from the homeCore-io releases, checks its signature and checksum, and starts
					it. It does nothing until you give it its settings.
				</p>
				{#if installed}
					<p class="quiet">
						<strong>Installed: {versionOf(installed)}.</strong> Installing {version} replaces it and keeps
						its settings.
					</p>
				{/if}
				{#if choices.length}
					<fieldset class="choose">
						<legend>More than one runtime can run it. Which one?</legend>
						{#each choices as c (c)}
							{@const rt = runtimes.find((x) => x.runtime_id === c)}
							<label class="radio"
								><input type="radio" name="runtime" value={c} bind:group={runOn} />
								<span
									><strong>{runtimeName(rt, c)}</strong>{#if rt?.capabilities?.kind}<em
											>{[rt.capabilities.kind, rt.capabilities.arch]
												.filter(Boolean)
												.join(' · ')}</em
										>{/if}</span
								></label
							>
						{/each}
					</fieldset>
				{/if}
				{#if tooNew}
					<p class="quiet">
						<strong>{version} needs homeCore {tooNew} or later; this is {core.version}.</strong> Choose
						an earlier version, or update homeCore first.
					</p>
				{/if}
				<button type="button" class="go" disabled={busy || !version || !!tooNew} onclick={go}>
					{busy
						? 'Installing…'
						: choices.length
							? `Run it on ${runtimeName(
									runtimes.find((x) => x.runtime_id === runOn),
									runOn
								)}`
							: installed
								? `Install ${version}`
								: `Install ${chosen.name}`}
				</button>
				{#if placed}
					<p class="note" role="status">
						{placed.name} is going to <strong>{placed.on}</strong>, which installs and starts it the
						next time it checks in. It shows in <a href="/settings/plugins">Plugins</a> once it’s
						running; <a href="/settings/plugins/runtimes">Plugin runtimes</a> shows what each one runs.
					</p>
				{/if}
				{#if note}<p class="note" role="status">{note}</p>{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	.top {
		margin-bottom: var(--space-3);
	}
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
		gap: var(--space-4);
		align-items: start;
	}
	.split.one {
		grid-template-columns: minmax(0, 1fr);
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
	.list button {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px var(--space-4);
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.list button[aria-current='true'] {
		background: var(--nav-on);
	}
	.list span {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.list em {
		font-style: normal;
		font-size: 12px;
		font-weight: 700;
		color: var(--lit-ink);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.card > p {
		margin: 0;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px var(--space-4);
		margin: 0;
	}
	dt {
		color: var(--ink-muted);
	}
	dd {
		margin: 0;
	}
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
	}
	label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-muted);
	}
	select {
		height: 36px;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.go {
		height: 40px;
		padding: 0 18px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.choose {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
	}
	.choose legend {
		padding: 0 4px;
		font-weight: 600;
	}
	.radio {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.radio span {
		display: flex;
		flex-direction: column;
	}
	.radio em {
		font-style: normal;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.go:disabled {
		opacity: 0.5;
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
