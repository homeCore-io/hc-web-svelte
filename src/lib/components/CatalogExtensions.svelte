<!--
	The Catalog's UI extensions tab (13 U7 to U9): what the registry's signed
	index offers, by category, each with its versions; installing one checks
	its signature and checksum (the app's server does that). An admin can also
	add one from a file: it's read first, so the page can say what it holds and
	that nothing vouches for it, and only installed once they say so.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { compareVersions } from '#lib/plugins.js';
	import { extensions, type Extension } from '#lib/extensions.svelte.js';

	interface Release {
		version: string;
		values: number;
		size?: number;
	}
	interface CatalogExtension {
		id: string;
		name: string;
		description: string;
		category: string;
		versions: Release[];
	}

	const may = $derived(session.isAdmin || session.can('plugins:write'));
	let list = $state<CatalogExtension[] | null>(null);
	let failed = $state<string | null>(null);
	onMount(async () => {
		void extensions.load();
		const r = await fetch('/ui/extensions/catalog').catch(() => null);
		const body = (await r?.json().catch(() => null)) as {
			extensions?: CatalogExtension[];
			error?: string;
		} | null;
		if (!r?.ok || !body?.extensions) failed = body?.error ?? 'The catalog couldn’t be reached.';
		else list = body.extensions.sort((a, b) => a.name.localeCompare(b.name));
	});

	const catOf = (x: CatalogExtension) => x.category?.trim() || 'Other';
	let cat = $state('All');
	const cats = $derived(
		list?.length ? ['All', ...[...new Set(list.map(catOf))].sort((a, b) => a.localeCompare(b))] : []
	);
	const shown = $derived(list?.filter((x) => cat === 'All' || catOf(x) === cat) ?? []);
	let chosenId = $state<string | null>(null);
	const chosen = $derived(
		list?.find((x) => x.id === chosenId) ?? (wide.current ? shown[0] : undefined)
	);
	const versions = $derived(
		chosen
			? chosen.versions
					.map((v) => v.version)
					.sort(compareVersions)
					.reverse()
			: []
	);
	let version = $state('');
	$effect(() => {
		version = versions[0] ?? '';
	});
	const have = (id: string) => extensions.list.find((x) => x.id === id);
	const size = (n?: number) =>
		n
			? n < 1024 * 1024
				? `${Math.round(n / 1024)} KB`
				: `${(n / 1024 / 1024).toFixed(1)} MB`
			: '—';

	let busy = $state(false);
	let note = $state<string | null>(null);
	async function send(url: string, init: RequestInit) {
		busy = true;
		note = null;
		const r = await fetch(url, init).catch(() => null);
		busy = false;
		const body = (await r?.json().catch(() => null)) as {
			extension?: Extension;
			error?: string;
		} | null;
		if (!r?.ok || !body?.extension) {
			note = body?.error ?? 'It couldn’t be installed.';
			return undefined;
		}
		return body.extension;
	}
	async function install() {
		if (!chosen) return;
		note = `Downloading ${chosen.name} and checking its signature…`;
		const x = await send('/ui/extensions/catalog', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: chosen.id, version })
		});
		if (!x) return;
		await extensions.load();
		note = `${x.name} ${x.version} is installed. Choose it in a look’s Drawings.`;
	}

	// ---- from a file ----
	let file = $state<File | null>(null);
	let held = $state<Extension | null>(null);
	let picker = $state<HTMLInputElement>();
	async function read(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		held = null;
		if (!f) return;
		file = f;
		held = (await send('/ui/extensions/upload?check', { method: 'POST', body: f })) ?? null;
	}
	async function installFile() {
		if (!file) return;
		const x = await send('/ui/extensions/upload', { method: 'POST', body: file });
		if (!x) return;
		await extensions.load();
		file = null;
		held = null;
		if (picker) picker.value = '';
		note = `${x.name} ${x.version} is installed from a file. Choose it in a look’s Drawings.`;
	}
	const FAMILY: Record<string, string> = {
		lights: 'Lights',
		switches: 'Switches',
		scenes: 'Scenes',
		doors: 'Doors and locks',
		readings: 'Readings',
		watching: 'Watching',
		media: 'Players',
		climate: 'Thermostats'
	};
	const hasCode = $derived(!!held?.elements.some((e) => e.kind === 'code'));
</script>

{#if !may}
	<p class="quiet">Extensions are installed by those who may install plugins.</p>
{:else}
	<p class="quiet top">
		Drawings and cards the looks can choose. They never command anything. The app installs them;
		homeCore never sees them. <a href="/settings/extensions">Installed extensions</a>
	</p>

	{#if note}<p class="note" role="status">{note}</p>{/if}

	{#if failed}
		<p class="quiet">The catalog: {failed}</p>
	{:else if list === null}
		<p class="quiet">Reading the catalog…</p>
	{:else if list.length === 0}
		<p class="quiet">The catalog has no extensions yet.</p>
	{:else}
		{#if cats.length > 2}
			<div class="cats">
				{#each cats as c (c)}
					<button type="button" aria-pressed={cat === c} onclick={() => (cat = c)}>{c}</button>
				{/each}
			</div>
		{/if}
		<div class="split" class:one={!wide.current}>
			{#if wide.current || !chosen}
				<ul class="list">
					{#each shown as x (x.id)}
						{@const mine = have(x.id)}
						<li>
							<button
								type="button"
								aria-current={chosen?.id === x.id ? 'true' : undefined}
								onclick={() => (chosenId = x.id)}
							>
								<strong>{x.name}</strong>
								<span>{x.description || catOf(x)}</span>
								{#if mine}<em>Installed · {mine.version}</em>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if chosen}
				{@const mine = have(chosen.id)}
				{@const rel = chosen.versions.find((v) => v.version === version)}
				<section class="card">
					<h2>{chosen.name}</h2>
					{#if chosen.description}<p>{chosen.description}</p>{/if}
					<dl>
						<dt>Id</dt>
						<dd class="mono">{chosen.id}</dd>
						<dt>Category</dt>
						<dd>{catOf(chosen)}</dd>
						<dt>Size</dt>
						<dd>{size(rel?.size)}</dd>
					</dl>
					{#if versions.length}
						<label>
							Version
							<select bind:value={version}
								>{#each versions as v, i (v)}<option value={v}
										>{v}{i === 0 ? ' (the latest)' : ''}</option
									>{/each}</select
							>
						</label>
					{:else}
						<p class="quiet">It needs a newer app than this one.</p>
					{/if}
					<p class="quiet">
						Downloads it from the hc-extensions releases, checks its signature and checksum, and
						adds its drawings to every look’s choices.
					</p>
					{#if mine && mine.version !== version}<p class="quiet">
							<strong>Installed: {mine.version}.</strong> Installing {version} replaces it.
						</p>{/if}
					<button
						type="button"
						class="go"
						disabled={busy || !version || mine?.version === version}
						onclick={install}
						>{busy
							? 'Installing…'
							: mine?.version === version
								? 'Installed'
								: mine
									? `Install ${version}`
									: `Install ${chosen.name}`}</button
					>
					{#if !wide.current}<button type="button" class="plain" onclick={() => (chosenId = null)}
							>All extensions</button
						>{/if}
				</section>
			{/if}
		</div>
	{/if}

	<section class="card file" aria-label="Add from a file">
		<h2>Add from a file</h2>
		<p class="quiet">
			For one you made yourself, or one not in the catalog: a <code>.tar.zst</code>,
			<code>.tar.gz</code> or <code>.zip</code> with its <code>extension.json</code>.
		</p>
		<input
			type="file"
			id="extension-file"
			bind:this={picker}
			accept=".zst,.gz,.zip,application/zip"
			aria-label="An extension’s file"
			onchange={read}
		/>
		{#if held}
			<p><strong>{held.name}</strong> · version {held.version}</p>
			<ul class="holds">
				{#each held.elements as e (e.id)}
					<li>
						{e.label}, a drawing for {FAMILY[e.draws] ?? e.draws} ({e.kind === 'code'
							? 'code'
							: 'Rive'})
					</li>
				{/each}
			</ul>
			<p class="warn">
				It isn’t from the homeCore catalog, so nothing vouches for it. Its drawings are shown to
				everyone who sees a look that uses them.{#if hasCode}
					Some of them are code: it runs in the browser of everyone who sees a look that uses it,
					with the same reach as the app itself.{/if}
			</p>
			<button type="button" class="go" disabled={busy} onclick={installFile}
				>{have(held.id) ? `Replace ${held.name}` : 'Install anyway'}</button
			>
		{/if}
	</section>
{/if}

<style>
	.top {
		margin-bottom: var(--space-3);
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
	.cats button[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 18%, var(--surface));
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
		gap: 2px;
		padding: 10px var(--space-4);
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.list button[aria-current='true'] {
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
	}
	.list span {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.list em {
		font-style: normal;
		font-size: 12px;
		color: var(--lit-ink);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.file {
		margin-top: var(--space-4);
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.card > p {
		margin: 0;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px var(--space-3);
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
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
	}
	select {
		height: 38px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
		font: inherit;
		padding: 0 10px;
	}
	.go,
	.plain {
		align-self: flex-start;
		height: 40px;
		padding: 0 18px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.holds {
		margin: 0;
		padding-left: 18px;
	}
	.warn {
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--ink);
	}
	.note {
		margin: 0 0 var(--space-3);
	}
	.quiet {
		color: var(--ink-muted);
		margin: 0;
	}
</style>
