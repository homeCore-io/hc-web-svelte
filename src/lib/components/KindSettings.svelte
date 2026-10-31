<!--
	A card's settings, or every card's of a kind (G2): the form engine reading
	the kind's descriptor — never a sheet written for one kind. Each field
	starts at what applies without this layer, and Done keeps only what was
	changed from it (G13). A preview shows the result as it's set.
-->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import type { Descriptor } from '#lib/descriptor.js';
	import { FormState } from '#lib/form.svelte.js';
	import { resolve, withDefaults, type Options } from '#lib/options.js';
	import SectionForm from './form/SectionForm.svelte';

	let {
		title,
		who,
		descriptor,
		mine,
		without,
		save,
		close,
		preview,
		children
	}: {
		title: string;
		/** Whose this is: "Only you see this" or "Everyone sees this". */
		who: string;
		descriptor: Descriptor;
		/** What this layer set. */
		mine: Options;
		/** What applies without it. */
		without: Options;
		save: (next: Options) => void;
		close: () => void;
		/** The result, drawn from the settings as they are now. */
		preview?: Snippet<[Options]>;
		/** Anything the sheet adds below its settings. */
		children?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());
	// Read once, when the sheet opens.
	const form = new FormState(
		(() => withDefaults(descriptor, without))(),
		(() => $state.snapshot(mine))()
	);
	const now = $derived(resolve([form.draft], without));
	const changed = $derived(Object.values(form.draft).some((v) => v !== undefined));
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<div>
				<h2>{title}</h2>
				<p class="who">{who}</p>
			</div>
			<button class="x" aria-label="Close without keeping" onclick={() => dialog?.close()}
				><X size={20} /></button
			>
		</header>
		{#if preview}
			<div class="preview" aria-live="polite">
				<p class="over">Preview</p>
				{@render preview(now)}
			</div>
		{/if}
		{#each form.sections as section (section.id)}
			<section>
				{#if section.fields.length > 1}<h3>{section.title}</h3>{/if}
				<SectionForm {form} {section} showKeys={false} />
			</section>
		{/each}
		{@render children?.()}
		<div class="actions">
			<button class="plain" disabled={!changed} onclick={() => (form.draft = {})}
				>Back to default</button
			>
			<button
				class="done"
				disabled={form.blocked}
				onclick={() => {
					save($state.snapshot(form.draft));
					dialog?.close();
				}}>Done</button
			>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: min(480px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		padding: 0;
		border: none;
		border-radius: var(--radius);
		background: var(--sheet);
		color: var(--ink);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.35);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h2 {
		margin: 0;
		font-size: 19px;
	}
	.who {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.x {
		border: none;
		background: none;
		color: var(--ink-muted);
		padding: 4px;
	}
	.over {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	.actions {
		position: sticky;
		z-index: 3;
		bottom: -16px;
		display: flex;
		gap: 8px;
		padding: 12px 0 0;
		background: var(--sheet);
	}
	.actions button {
		height: 42px;
		padding: 0 16px;
		border-radius: 21px;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.plain:disabled {
		opacity: 0.5;
	}
	.done {
		flex: 1;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
