<!--
	Configuration (A0): homecore.toml, as the form homeCore describes
	(`/system/config/descriptor`) and as the file itself. The form writes only
	what changed, through homeCore's patch, so comments and everything the form
	doesn't know about stay exactly as written.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { FormState } from '#lib/form.svelte.js';
	import { describe, valuesOf, writes, type Descriptor } from '#lib/descriptor.js';
	import { loadConfig, putConfig, restart, maskSecrets, type Config } from '#lib/config.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import SectionForm from '#lib/components/form/SectionForm.svelte';

	const form = new FormState();
	let config = $state<Config | null>(null);
	let trouble = $state<string | null>(null);
	let saving = $state(false);
	let saved = $state(false);

	async function load() {
		const got = await loadConfig();
		if (typeof got === 'string') return void (trouble = got);
		form.descriptor = got.descriptor;
		form.load(valuesOf(got.descriptor, got.config.parsed));
		config = got.config;
		trouble = null;
	}
	onMount(load);

	// ---- which section ----
	const asked = $derived(page.url.searchParams.get('s'));
	const section = $derived(
		form.sections.find((s) => s.id === asked) ?? (wide.current ? form.sections[0] : undefined)
	);
	const choose = (id: string) =>
		goto(`?s=${encodeURIComponent(id)}`, {
			replace: wide.current,
			reset: !wide.current
		});
	// ---- form or file ----
	let tab = $state<'form' | 'file'>('form');

	// On a phone a chosen section is its own page, titled by it.
	const sectionPage = $derived(!wide.current && asked !== null && tab === 'form');
	$effect(() =>
		sectionPage && section
			? heading.show(section.title, { href: '/settings/configuration', label: 'Configuration' })
			: undefined
	);
	let editingFile = $state(false);
	let fileText = $state('');

	// ---- saving ----
	const plan = $derived(writes(form.changes));
	const blocked = $derived(
		plan.cannot.length > 0
			? `${plan.cannot.map((c) => c.field.label ?? c.key).join(', ')} can’t be emptied here — remove ${plan.cannot.length === 1 ? 'it' : 'them'} in homecore.toml.`
			: form.blocked
				? 'Fix the settings marked in red first.'
				: null
	);
	const summary = $derived(
		form.changes.map((c) => `${c.field.label ?? c.key}: ${describe(c.field, c.now)}`).join(' · ')
	);

	async function save() {
		saving = true;
		let err: string | null = null;
		if (plan.patch) err = await putConfig({ patch: plan.patch });
		for (const t of plan.tables) err ??= await putConfig({ array_of_tables: t });
		saving = false;
		if (err) return void (trouble = err);
		saved = true;
		await load();
	}

	async function editFile() {
		const yes = await ask({
			title: 'Edit homecore.toml itself?',
			body: 'You’ll see the whole file, passwords and tokens included. homeCore checks it is valid TOML before saving, but not that every setting makes sense.',
			go: 'Edit the file'
		});
		if (!yes || !config) return;
		fileText = config.raw;
		editingFile = true;
	}
	async function saveFile() {
		saving = true;
		// The file may have changed since it was opened — by the form in
		// another window, or by hand. Saving the whole file would undo that.
		const now = await loadConfig();
		if (typeof now !== 'string' && config && now.config.raw !== config.raw) {
			saving = false;
			trouble = 'homecore.toml changed since you opened it. Copy your edits, then reload the page.';
			return;
		}
		const err = await putConfig({ raw: fileText });
		saving = false;
		if (err) return void (trouble = err);
		editingFile = false;
		saved = true;
		await load();
	}

	async function restartNow() {
		const yes = await ask({
			title: 'Restart homeCore?',
			lost: [
				'Every screen in the house disconnects until it is back — usually under a minute.',
				'Plugins restart and reconnect to their devices.',
				'Automations don’t run while it is down.'
			],
			go: 'Restart',
			danger: true
		});
		if (!yes) return;
		const err = await restart();
		trouble = err;
		if (!err) saved = false;
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Configuration is for admins.</p>
{:else}
	{#if !sectionPage}
		<div class="top">
			<div class="tabs" role="tablist" aria-label="Edit as">
				<button role="tab" aria-selected={tab === 'form'} onclick={() => (tab = 'form')}
					>Form</button
				>
				<button role="tab" aria-selected={tab === 'file'} onclick={() => (tab = 'file')}
					>homecore.toml</button
				>
			</div>
			{#if config}<code class="path">{config.path}</code>{/if}
		</div>
	{/if}

	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	{#if saved}
		<div class="saved" role="status">
			<span
				><strong>Saved.</strong> homeCore reads these when it starts: restart it for them to take effect.</span
			>
			<button type="button" onclick={restartNow}>Restart homeCore…</button>
		</div>
	{/if}

	{#if config === null && trouble === null}
		<p class="quiet">Loading homecore.toml…</p>
	{:else if config && tab === 'file'}
		<section class="file">
			{#if editingFile}
				<textarea bind:value={fileText} spellcheck="false" aria-label="homecore.toml"></textarea>
				<div class="file-buttons">
					<button type="button" class="ghost" onclick={() => (editingFile = false)}>Cancel</button>
					<button
						type="button"
						class="go"
						disabled={saving || fileText === config.raw}
						onclick={saveFile}>{saving ? 'Saving…' : 'Save homecore.toml'}</button
					>
				</div>
			{:else}
				<p class="quiet">
					The file itself. Anything the form doesn’t know about is kept exactly as written, comments
					included. Secrets are hidden here.
				</p>
				<pre>{maskSecrets(config.raw, form.descriptor)}</pre>
				{#if form.dirty}
					<p class="quiet">Save or discard the form’s changes before editing the file.</p>
				{:else}
					<button type="button" class="ghost" onclick={editFile}>Edit the file…</button>
				{/if}
			{/if}
		</section>
	{:else if config}
		<ListDetail chosen={section !== undefined && asked !== null} label="Sections">
			{#snippet list()}
				<ul class="sections">
					{#each form.sections as s (s.id)}
						<li>
							<a
								href={`?s=${encodeURIComponent(s.id)}`}
								aria-current={section?.id === s.id ? 'page' : undefined}
								onclick={(e) => {
									e.preventDefault();
									void choose(s.id);
								}}
							>
								<span class="title">{s.title}</span>
								{#if form.wrongIn(s)}<span class="dot bad" aria-label="has a problem"></span>
								{:else if form.changedIn(s)}<span class="dot" aria-label="changed"></span>{/if}
								<ChevronRight size={16} aria-hidden="true" />
							</a>
						</li>
					{/each}
				</ul>
			{/snippet}
			{#snippet detail()}
				{#if section}
					<section class="card">
						{#if wide.current}<h2>{section.title}</h2>{/if}
						{#if section.help}<p class="quiet">{section.help}</p>{/if}
						<SectionForm {form} {section} />
					</section>
				{/if}
			{/snippet}
		</ListDetail>
		{#if form.dirty}
			<SaveBar
				count={form.changes.length}
				{summary}
				{saving}
				{blocked}
				{save}
				discard={() => form.discard()}
				saveLabel="Save to homecore.toml"
			/>
		{/if}
	{/if}
{/if}

<style>
	.top {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.tabs {
		display: inline-flex;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.tabs button {
		height: 36px;
		padding: 0 16px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
	}
	.tabs button[aria-selected='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.path {
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
	.sections {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.sections li + li {
		border-top: 1px solid var(--line);
	}
	.sections a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 48px;
		padding: 0 var(--space-3) 0 var(--space-4);
		color: var(--ink);
		text-decoration: none;
		font-weight: 600;
	}
	.sections a[aria-current='page'] {
		background: var(--nav-on);
	}
	.sections a :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: var(--accent);
		flex: none;
	}
	.dot.bad {
		background: var(--alert);
	}
	.card,
	.file {
		padding: var(--space-2) var(--space-5) var(--space-3);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.file {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
	}
	h2 {
		margin: var(--space-3) 0 4px;
		font-size: 20px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	pre,
	textarea {
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-3);
		border-radius: 10px;
		background: var(--bg);
		border: 1px solid var(--line);
		font-family: var(--font-num);
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--ink);
		overflow: auto;
		max-height: 70dvh;
	}
	textarea {
		min-height: 60dvh;
		resize: vertical;
	}
	.file-buttons {
		display: flex;
		gap: var(--space-2);
		align-self: flex-end;
	}
	.ghost,
	.go,
	.saved button {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		font: inherit;
		font-weight: 700;
	}
	.ghost,
	.saved button {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
	.trouble {
		margin: 0 0 var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--alert);
		font-weight: 600;
	}
	.saved {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		border: 1px solid var(--lit-card-line);
	}
	.saved span {
		flex: 1 1 260px;
	}
</style>
