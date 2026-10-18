<!--
	One descriptor section as a form (T4): each shown field with its label,
	help and config key, what it was before this edit, and what's wrong.
-->
<script lang="ts">
	import Control from './Control.svelte';
	import SourceTable from './SourceTable.svelte';
	import ImportField from './ImportField.svelte';
	import { describe, fieldShown, linkTo, same, type Section } from '#lib/descriptor.js';
	import type { FormState } from '#lib/form.svelte.js';

	let {
		form,
		section,
		showKeys = true
	}: { form: FormState; section: Section; showKeys?: boolean } = $props();

	const fields = $derived(section.fields.filter((f) => fieldShown(f, form.get)));
	const hidden = $derived(
		section.fields.filter((f) => f.key !== undefined && !fieldShown(f, form.get)).length
	);
	const host = typeof location === 'undefined' ? '' : location.hostname;
	const idOf = (key: string) => `f-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
</script>

<div class="fields">
	{#each fields as f, i (f.key ?? `${f.kind}-${i}`)}
		{#if f.kind === 'note'}
			<p class="note">{f.text ?? f.help}</p>
		{:else if f.kind === 'link'}
			<p class="note">
				<a href={linkTo(f.href ?? '#', host, form.get)} target="_blank" rel="noreferrer"
					>{f.label ?? f.href}</a
				>
				{#if f.help}<span class="help">{f.help}</span>{/if}
			</p>
		{:else if f.kind === 'import'}
			<div class="field wide">
				<div class="about">
					<span class="label-text">{f.label ?? 'Import'}</span>
					{#if f.help}<span class="help">{f.help}</span>{/if}
				</div>
				<div class="control">
					<ImportField field={f} {form} pluginId={form.descriptor.plugin_id} />
				</div>
			</div>
		{:else if f.kind === 'table' && f.source?.kind === 'core_resource' && f.source.ref === 'devices'}
			<div class="field wide">
				<div class="about">
					<span class="label-text">{f.label ?? f.key}</span>
					{#if f.help}<span class="help">{f.help}</span>{/if}
				</div>
				<div class="control">
					<SourceTable field={f} pluginId={form.descriptor.plugin_id} />
				</div>
			</div>
		{:else if f.key !== undefined}
			{@const key = f.key}
			{@const changed = !same(form.original[key], form.draft[key])}
			{@const problem = form.errors[key]}
			<div
				class="field"
				class:wide={f.kind === 'table' || f.kind === 'list'}
				class:inline={f.kind === 'toggle'}
			>
				<div class="about">
					<label for={idOf(key)}>
						{f.label ?? key}
						{#if changed}<span class="was">was {describe(f, form.original[key])}</span>{/if}
					</label>
					{#if f.help}<span class="help">{f.help}</span>{/if}
					{#if showKeys}<code>{key}</code>{/if}
				</div>
				<div class="control">
					<Control
						field={f}
						value={form.draft[key]}
						id={idOf(key)}
						invalid={problem !== undefined}
						onchange={(v) => form.set(key, v)}
						onfail={(p) => form.fail(key, p)}
					/>
					{#if problem}<span class="problem" role="alert">{problem}</span>{/if}
				</div>
			</div>
		{/if}
	{/each}
	{#if hidden > 0}
		<p class="more">
			{hidden === 1 ? 'One more setting appears' : `${hidden} more settings appear`} when the ones above
			ask for {hidden === 1 ? 'it' : 'them'}.
		</p>
	{/if}
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
	}
	.field {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding: var(--space-3) 0;
	}
	.field + .field,
	.note + .field,
	.field + .note {
		border-top: 1px solid var(--line);
	}
	.field.inline {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
	}
	code {
		display: none;
	}
	@media (min-width: 900px) {
		code {
			display: block;
		}
		.field:not(.wide) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
			align-items: start;
			gap: var(--space-5);
		}
	}
	.about {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 15px;
	}
	.was {
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 12px;
		font-weight: 600;
	}
	.help {
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.45;
	}
	code {
		align-self: flex-start;
		font-family: var(--font-num);
		font-size: 11px;
		color: var(--ink-muted);
		opacity: 0.8;
	}
	.control {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		min-width: 0;
	}
	.problem {
		color: var(--alert);
		font-size: 13px;
		font-weight: 600;
	}
	.note {
		margin: 0;
		padding: var(--space-3) 0;
		line-height: 1.5;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.note a {
		color: var(--accent);
		font-weight: 600;
	}
	.more {
		margin: 0;
		padding-top: var(--space-2);
		color: var(--ink-muted);
		font-size: 13px;
	}
	.label-text {
		font-weight: 600;
	}
</style>
