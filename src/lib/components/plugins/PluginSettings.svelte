<!--
	A plugin's settings (A4): its own description of them, as the A0 form —
	only what you change is written, in place, comments and all — or its
	file. homeCore reads a plugin's file when the plugin starts: saving
	offers the restart.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { FormState } from '#lib/form.svelte.js';
	import { describe, valuesOf, writes } from '#lib/descriptor.js';
	import { maskSecrets } from '#lib/config.js';
	import { descriptorFromSchema } from '#lib/configSchema.js';
	import {
		lifecycle,
		loadConfig,
		loadDescriptor,
		loadSchema,
		saveConfig,
		type PluginConfig
	} from '#lib/pluginAdmin.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import SectionForm from '#lib/components/form/SectionForm.svelte';

	// `running`: turned on — so a restart (or start) applies what was saved.
	let { pluginId, name, running }: { pluginId: string; name: string; running: boolean } = $props();

	const form = new FormState();
	let config = $state<PluginConfig | null>(null);
	let hasForm = $state(false);
	let fromSchema = $state(false);
	let trouble = $state<string | null>(null);
	let saving = $state(false);
	let saved = $state(false);

	async function load() {
		const [c, d] = await Promise.all([loadConfig(pluginId), loadDescriptor(pluginId)]);
		if (!c.ok)
			// homeCore reads an installed plugin's file itself; one that keeps its
			// settings to itself can only say them while it runs.
			return void (trouble = running
				? c.error
				: `${name} is turned off — turn it on to see its settings.`);
		config = c.data;
		// Its own descriptor; failing that, a form made from its schema.
		let described = d.ok && d.data.descriptor?.sections?.length ? d.data.descriptor : null;
		fromSchema = false;
		if (!described) {
			const s = await loadSchema(pluginId);
			described = s.ok ? descriptorFromSchema(s.data.schema, pluginId) : null;
			fromSchema = !!described;
		}
		hasForm = !!described && !!c.data.config;
		if (hasForm && described) {
			form.descriptor = described;
			form.load(valuesOf(described, c.data.config));
		}
		trouble = c.data.config_error ? `The file doesn’t read as TOML: ${c.data.config_error}` : null;
	}
	onMount(load);

	let tab = $state<'form' | 'file'>('form');
	const shownTab = $derived(hasForm ? tab : 'file');

	// ---- the form ----
	const asked = $derived(page.url.searchParams.get('s'));
	const section = $derived(
		[...form.sections, ...form.tucked].find((s) => s.id === asked) ??
			(wide.current ? form.sections[0] : undefined)
	);
	const choose = (id: string) => {
		const u = new URL(page.url.href);
		u.searchParams.set('s', id);
		void goto(`${u.pathname}${u.search}`, { replace: wide.current, reset: !wide.current });
	};
	const plan = $derived(writes(form.changes));
	const blocked = $derived(
		plan.cannot.length
			? `${plan.cannot.map((c) => c.field.label ?? c.key).join(', ')} can’t be emptied here — edit the file instead.`
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
		if (plan.patch) {
			const r = await saveConfig(pluginId, { patch: plan.patch });
			if (!r.ok) err = r.error;
		}
		for (const t of plan.tables) {
			if (err) break;
			const r = await saveConfig(pluginId, { array_of_tables: t });
			if (!r.ok) err = r.error;
		}
		saving = false;
		if (err) return void (trouble = err);
		saved = true;
		await load();
	}

	// ---- the file ----
	let editing = $state(false);
	let text = $state('');
	async function editFile() {
		const yes = await ask({
			title: `Edit ${name}’s file itself?`,
			body: 'homeCore checks nothing in it but that it’s TOML. Passwords stay hidden — leave “__redacted__” as it is to keep one.',
			go: 'Edit the file'
		});
		if (!yes || !config?.raw) return;
		text = config.raw;
		editing = true;
	}
	async function saveFile() {
		saving = true;
		const now = await loadConfig(pluginId);
		if (now.ok && config && now.data.raw !== config.raw) {
			saving = false;
			return void (trouble = 'The file changed since you opened it. Copy your edits, then reload.');
		}
		const r = await saveConfig(pluginId, { raw: text });
		saving = false;
		if (!r.ok) return void (trouble = r.error);
		editing = false;
		saved = true;
		await load();
	}

	async function restart() {
		const r = await lifecycle(pluginId, 'restart');
		if (!r.ok) trouble = r.error;
		else saved = false;
	}
</script>

{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
{#if saved}
	<div class="saved" role="status">
		<span
			><strong>Saved.</strong>
			{name} reads its settings when it starts{running
				? ': restart it for them to take effect'
				: ''}.</span
		>
		{#if running}<button type="button" onclick={restart}>Restart {name}</button>{/if}
	</div>
{/if}

{#if config === null && !trouble}
	<p class="quiet">Loading…</p>
{:else if config}
	{#if hasForm}
		<div class="tabs" role="tablist">
			<button role="tab" aria-selected={shownTab === 'form'} onclick={() => (tab = 'form')}
				>Form</button
			>
			<button
				role="tab"
				class="mono"
				aria-selected={shownTab === 'file'}
				onclick={() => (tab = 'file')}>{pluginId}.toml</button
			>
		</div>
	{/if}
	{#if shownTab === 'file'}
		<section class="file">
			{#if config.format === 'remote'}
				<p class="quiet">{name} runs elsewhere and keeps its own settings; it has no file here.</p>
			{:else if editing}
				<textarea bind:value={text} spellcheck="false" aria-label={`${pluginId}.toml`}></textarea>
				<div class="buttons">
					<button type="button" class="ghost" onclick={() => (editing = false)}>Cancel</button>
					<button
						type="button"
						class="go"
						disabled={saving || text === config.raw}
						onclick={saveFile}>{saving ? 'Saving…' : 'Save the file'}</button
					>
				</div>
			{:else}
				<p class="quiet">The file itself, comments included. Passwords are hidden.</p>
				<pre>{form.descriptor ? maskSecrets(config.raw ?? '', form.descriptor) : config.raw}</pre>
				{#if form.dirty}<p class="quiet">
						Save or discard the form’s changes before editing the file.
					</p>
				{:else}<button type="button" class="ghost" onclick={editFile}>Edit the file…</button>{/if}
			{/if}
		</section>
	{:else}
		<ListDetail chosen={section !== undefined && asked !== null} label="Sections">
			{#snippet list()}
				{#if fromSchema}<p class="quiet basic">
						{name} describes its settings only roughly, so this form is a plain one made from that. Anything
						it can’t show is in the file.
					</p>{/if}
				<ul class="sections">
					{#each form.sections as s (s.id)}
						<li>
							<a
								href={`?tab=settings&s=${encodeURIComponent(s.id)}`}
								aria-current={section?.id === s.id ? 'page' : undefined}
								onclick={(e) => {
									e.preventDefault();
									choose(s.id);
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
				{#if form.tucked.length}
					<p class="also">Also</p>
					<ul class="sections tucked">
						{#each form.tucked as s (s.id)}
							<li>
								<a
									href={`?tab=settings&s=${encodeURIComponent(s.id)}`}
									aria-current={section?.id === s.id ? 'page' : undefined}
									onclick={(e) => {
										e.preventDefault();
										choose(s.id);
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
				{/if}
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
				saveLabel="Save"
			/>
		{/if}
	{/if}
{/if}

<style>
	.basic {
		margin: 0 0 var(--space-2);
		font-size: 13px;
	}
	.tabs {
		display: inline-flex;
		padding: 3px;
		margin-bottom: var(--space-3);
		border-radius: 12px;
		background: var(--surface-2);
	}
	.tabs button {
		height: 34px;
		padding: 0 14px;
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
	}
	.mono {
		font-family: var(--font-num) !important;
		font-size: 12.5px !important;
	}
	.sections {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.sections a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: 0 var(--space-3);
		border-radius: 10px;
		color: var(--ink);
		text-decoration: none;
	}
	.sections a[aria-current='page'] {
		background: var(--nav-on);
		font-weight: 700;
	}
	.title {
		flex: 1;
	}
	.sections :global(svg) {
		color: var(--ink-muted);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: var(--accent);
	}
	.dot.bad {
		background: var(--alert);
	}
	.card {
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	h2 {
		margin: 0 0 var(--space-3);
		font-size: 18px;
	}
	.file {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: flex-start;
	}
	pre,
	textarea {
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: var(--space-3);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		font-family: var(--font-num);
		font-size: 12.5px;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: var(--ink);
	}
	textarea {
		min-height: 420px;
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
	}
	.go,
	.ghost,
	.saved button {
		height: 38px;
		padding: 0 16px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.go,
	.saved button {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.saved {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.saved span {
		flex: 1;
	}
	.trouble {
		margin: 0 0 var(--space-3);
		color: var(--alert);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.also {
		margin: var(--space-4) 0 var(--space-1);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
</style>
