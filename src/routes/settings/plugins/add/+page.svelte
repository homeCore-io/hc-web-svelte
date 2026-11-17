<!--
	The Catalog (13 U9): a tab per kind. Plugins, grouped by their registry
	category; UI extensions are CatalogExtensions.

	Adding a plugin (A4): from homeCore's signed registry — what each is, its
	versions; installing downloads it, checks its signature and starts it.
	It does nothing until it has its settings, so its settings come next.
-->
<script lang="ts">
	import { notAdmin } from '#lib/refusals.js';
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { core } from '#lib/core.svelte.js';
	import {
		compareVersions,
		named,
		needsCore,
		sizeOf,
		versionOf,
		type PluginRecord,
		type RegistryPlugin
	} from '#lib/plugins.js';
	import {
		installLabel,
		installedText,
		isInstalledVersion,
		listed,
		setShowsInstalled,
		showsInstalled
	} from '#lib/catalog.js';
	import {
		install,
		loadRegistry,
		loadPlacements,
		loadRuntimes,
		loadStatus,
		runtimeName,
		runtimesToChoose,
		wasPlaced,
		type Placement,
		type Runtime
	} from '#lib/pluginAdmin.js';
	import { kindName, runtimeNeeds, type Needs } from '#lib/runtimes.js';

	$effect(() => heading.show('Catalog', { href: '/settings/plugins', label: 'Plugins' }));

	const KINDS = [
		['plugins', 'Plugins'],
		['extensions', 'UI extensions']
	] as const;
	const kind = $derived(
		page.url.searchParams.get('kind') === 'extensions' ? 'extensions' : 'plugins'
	);

	let registry = $state<RegistryPlugin[] | null>(null);
	let runtimes = $state<Runtime[]>([]);
	let placements = $state<Placement[]>([]);
	let have = $state<PluginRecord[]>([]);
	let failed = $state<string | null>(null);

	// Categories, from the registry; a plugin without one is Other.
	const catOf = (p: RegistryPlugin) => p.category?.trim() || 'Other';
	let cat = $state('All');
	const cats = $derived(
		registry?.some((p) => p.category?.trim())
			? ['All', ...[...new Set(registry.map(catOf))].sort((a, b) => a.localeCompare(b))]
			: []
	);
	// Installed plugins are left out unless asked for; the Plugins page keeps those.
	let showInstalled = $state(showsInstalled());
	const toggleInstalled = () => setShowsInstalled((showInstalled = !showInstalled));
	const inCat = $derived(registry?.filter((p) => cat === 'All' || catOf(p) === cat) ?? []);
	const shown = $derived(listed(inCat, have, showInstalled));
	const hidden = $derived(inCat.length - shown.length);
	onMount(async () => {
		const [r, s, rt, pl] = await Promise.all([
			loadRegistry(),
			loadStatus(),
			loadRuntimes(),
			loadPlacements()
		]);
		if (pl.ok) placements = pl.data;
		if (rt.ok) runtimes = rt.data.runtimes;
		if (!r.ok) return void (failed = r.error);
		registry = named(r.data.plugins).sort((a, b) => a.name.localeCompare(b.name));
		if (s.ok) have = s.data;
	});

	const chosenId = $derived(page.url.searchParams.get('id'));
	const chosen = $derived(
		registry?.find((p) => p.id === chosenId) ?? (wide.current ? shown[0] : undefined)
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
	// What this version needs to run: homeCore itself, or a runtime of some kind.
	const artifactsOf = (p: typeof chosen, v: string) =>
		p?.versions.find((x) => x.version === v)?.artifacts ?? [];
	const need = $derived<Needs>(
		chosen
			? runtimeNeeds(artifactsOf(chosen, version), runtimes, {
					count: (id) => placements.filter((p) => p.runtime_id === id).length,
					has: (id) => placements.some((p) => p.runtime_id === id && p.plugin_id === chosen.id)
				})
			: { state: 'here' }
	);
	const blocked = $derived(need.state !== 'here' && need.state !== 'ready');
	/** The kind of runtime a plugin needs, for its row in the list, or null. */
	const runtimeKind = (p: NonNullable<typeof chosen>) => {
		const latest = [...p.versions].sort((a, b) => compareVersions(a.version, b.version)).pop();
		const n = runtimeNeeds(latest?.artifacts ?? [], []);
		return n.state === 'here' ? null : kindName(n.kind);
	};
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
	let placed = $state<{ id: string; name: string; on: string } | null>(null);
	// A runtime installs a placed plugin the next time it checks in, about
	// every 30 seconds. Look for it until it runs, then open it the same way a
	// direct install does.
	let watching: ReturnType<typeof setInterval> | undefined;
	let looking = $state(false);
	const stopWatching = () => {
		clearInterval(watching);
		watching = undefined;
		looking = false;
	};
	onDestroy(stopWatching);
	function watchFor(id: string) {
		stopWatching();
		const until = Date.now() + 5 * 60_000;
		looking = true;
		watching = setInterval(async () => {
			if (Date.now() > until) return stopWatching();
			const [s, pl] = await Promise.all([loadStatus(), loadPlacements()]);
			if (pl.ok) placements = pl.data;
			if (!s.ok) return;
			have = s.data;
			if (s.data.some((p) => p.plugin_id === id && p.status === 'active')) {
				stopWatching();
				void goto(`/settings/plugins/${encodeURIComponent(id)}?new`);
			}
		}, 3000);
	}
	// Another plugin, or another version, is a new question.
	$effect(() => {
		void chosen;
		void version;
		if (placed && placed.id !== chosen?.id) {
			placed = null;
			stopWatching();
		}
	});
	// Placed earlier and not running yet (a reload, or back from elsewhere):
	// still on its way, so say so instead of offering it again.
	$effect(() => {
		if (!chosen || placed || looking || !registry) return;
		const on = placements.find((p) => p.plugin_id === chosen.id);
		if (!on || have.some((p) => p.plugin_id === chosen.id && p.status === 'active')) return;
		placed = {
			id: chosen.id,
			name: chosen.name,
			on: runtimeName(
				runtimes.find((x) => x.runtime_id === on.runtime_id),
				on.runtime_id
			)
		};
		watchFor(chosen.id);
	});
	const waiting = $derived(!!placed && placed.id === chosen?.id && looking);
	async function go() {
		if (!chosen) return;
		busy = true;
		placed = null;
		stopWatching();
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
				id: chosen.id,
				name: chosen.name,
				on: runtimeName(
					runtimes.find((x) => x.runtime_id === id),
					id
				)
			};
			choices = [];
			note = null;
			watchFor(chosen.id);
			return;
		}
		// Its own page, if it has one (a sign-in, say), else its settings: the page decides.
		void goto(`/settings/plugins/${encodeURIComponent(r.data.installed)}?new`);
	}
</script>

<div class="kinds" role="tablist" aria-label="Kinds">
	{#each KINDS as [id, name] (id)}
		<a
			role="tab"
			aria-selected={kind === id}
			href={id === 'plugins' ? '?' : '?kind=extensions'}
			data-sveltekit-replacestate>{name}</a
		>
	{/each}
</div>

{#if kind === 'extensions'}
	{#await import('#lib/components/CatalogExtensions.svelte') then { default: CatalogExtensions }}
		<CatalogExtensions />
	{/await}
{:else if !session.can('plugins:write')}
	<p class="quiet">
		{notAdmin('Plugins are for the house’s admins.', 'add plugins from the Catalog')}
	</p>
{:else if failed}
	<p class="quiet">The registry: {failed}</p>
{:else if registry === null}
	<p class="quiet">Reading the registry…</p>
{:else}
	<p class="quiet top">From the homeCore registry · signed releases</p>
	<div class="cats">
		{#each cats as c (c)}
			<button type="button" aria-pressed={cat === c} onclick={() => (cat = c)}>{c}</button>
		{/each}
		{#if have.length}
			<button type="button" class="installed" aria-pressed={showInstalled} onclick={toggleInstalled}
				>{showInstalled
					? 'Hide installed'
					: `Show installed${hidden ? ` · ${hidden}` : ''}`}</button
			>
		{/if}
	</div>
	<div class="split" class:one={!wide.current}>
		{#if wide.current || !chosen}
			<ul class="list">
				{#each shown as p (p.id)}
					{@const mine = have.find((h) => h.plugin_id === p.id)}
					<li>
						<button
							type="button"
							aria-current={chosen?.id === p.id ? 'true' : undefined}
							onclick={() => pick(p.id)}
						>
							<strong>{p.name}</strong>
							<span>{p.description || 'No description in the registry.'}</span>
							{#if mine}<em>{installedText(mine)}</em>{:else if runtimeKind(p)}<em
									>Runs in a {runtimeKind(p)} runtime</em
								>{/if}
						</button>
					</li>
				{:else}
					<li class="none">{hidden ? 'Everything here is installed.' : 'Nothing here yet.'}</li>
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
								>{v}{i === 0 ? ' · the latest' : ''}{needs(v)
									? ` · needs homeCore ${needs(v)}`
									: ''}</option
							>{/each}</select
					>
				</label>
				{#if need.state === 'here'}
					<p class="quiet">
						Downloads it from the homeCore-io releases, checks its signature and checksum, and
						starts it. It does nothing until you give it its settings.
					</p>
				{:else}
					<section class="needs {need.state}" aria-label="What it needs">
						<strong>Needs a {kindName(need.kind)} runtime</strong>
						{#if need.state === 'none'}
							<span
								>It runs in a container you set up yourself, and you don't have one yet. <a
									href="/settings/plugins/runtimes">Add a runtime</a
								>, start its container and paste its key, then install this.</span
							>
						{:else if need.state === 'waiting'}
							<span
								>{need.added.map((r) => r.name).join(', ')}
								{need.added.length === 1 ? "hasn't" : "haven't"} connected yet. Paste its key into the
								runtime's page, then install this.
								<a href="/settings/plugins/runtimes">Plugin runtimes</a></span
							>
						{:else if need.state === 'full'}
							<span
								>{need.full.map((r) => `${r.name} holds ${r.max_plugins}`).join(', ')}, as many
								plugins as you set it to. Raise the limit in
								<a href="/settings/plugins/runtimes">Plugin runtimes</a>, or add another runtime.</span
							>
						{:else if need.state === 'mismatch'}
							<span
								>This version is built for {need.want}, and your {kindName(need.kind)} runtimes run on
								{need.have}.</span
							>
						{:else}
							<span
								>{need.on.length === 1
									? `It goes to ${need.on[0]?.name}, which installs it offline and starts it.`
									: `${need.on.length} runtimes can run it; you choose which.`} homeCore checks its signature
								first. It does nothing until you give it its settings.</span
							>
							{#each need.on.filter((r) => r.outdated) as old (old.runtime_id)}
								<span class="old"
									>{old.name} is version {old.host_version}, and homeCore expects {old.min_host_version}
									or later. Update it first: pull the newer image and restart its container.</span
								>
							{/each}
						{/if}
					</section>
				{/if}
				{#if installed}
					<p class="quiet">
						<strong
							>{versionOf(installed)
								? `Installed: ${versionOf(installed)}.`
								: 'Installed, but its version isn’t known.'}</strong
						>
						{#if !isInstalledVersion(version, installed)}Installing {version} replaces it and keeps its
							settings.{/if}
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
									><strong>{runtimeName(rt, c)}</strong>{#if rt?.kind}<em
											>{[rt.kind, rt.arch].filter(Boolean).join(' · ')}</em
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
				<button
					type="button"
					class="go"
					class:again={isInstalledVersion(version, installed) && !choices.length}
					disabled={busy || waiting || !version || !!tooNew || blocked}
					onclick={go}
				>
					{busy
						? 'Installing…'
						: waiting
							? `Waiting for ${placed?.on}…`
							: choices.length
								? `Run it on ${runtimeName(
										runtimes.find((x) => x.runtime_id === runOn),
										runOn
									)}`
								: installLabel(chosen.name, version, installed)}
				</button>
				{#if placed}
					<p class="note" role="status">
						{placed.name} is going to <strong>{placed.on}</strong>, which installs and starts it the
						next time it checks in, usually within a minute. This page opens it once it’s running;
						<a href="/settings/plugins/runtimes">Plugin runtimes</a> shows what each one runs.
					</p>
				{/if}
				{#if note}<p class="note" role="status">{note}</p>{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	.needs {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 14px;
	}
	.needs.ready {
		background: var(--surface-2);
		color: var(--ink);
	}
	.needs .old {
		color: var(--alert);
		font-weight: 600;
	}
	.needs a {
		color: inherit;
		font-weight: 700;
	}
	.kinds {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
		border-bottom: 1px solid var(--line);
	}
	.kinds a {
		padding: 10px 14px;
		border-bottom: 2px solid transparent;
		color: var(--ink-muted);
		font-weight: 600;
		text-decoration: none;
	}
	.kinds a[aria-selected='true'] {
		border-bottom-color: var(--accent);
		color: var(--ink);
	}
	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: var(--space-3);
	}
	.cats button {
		height: 30px;
		padding: 0 12px;
		border-radius: 15px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.cats .installed {
		margin-left: auto;
	}
	.cats button[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--surface));
	}
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
	.list .none {
		padding: var(--space-3) var(--space-4);
		color: var(--ink-muted);
		font-size: 13.5px;
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
	/* The version already installed: installing it again is the quiet choice. */
	.go.again {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
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
