<!--
	Edit mode's bar (N6): it says plainly that everyone sees these changes, and
	holds Undo, Add a card, Cancel and Done. Changes that name something the
	page no longer has do nothing; Done tidies them away without asking (#4).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Plus from '@lucide/svelte/icons/plus';
	import { editing, LEAVE } from '#lib/edit.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { gone } from '#lib/layers.js';
	import { withEdit } from '#lib/nav.js';
	import AddCard from './AddCard.svelte';
	import StylePicker from './StylePicker.svelte';

	let { key }: { key: string } = $props();

	let adding = $state(false);
	let styling = $state(false);
	const stale = $derived(gone(editing.changes(key), editing.present));
	const changed = $derived(editing.changes(key).length > 0);

	const leave = () => goto(withEdit(page.url, false), { replace: true });
	async function done() {
		// Only once the page knows what it has — never because a plugin hasn't reported yet.
		if (stale.length > 0 && editing.present.size > 0) editing.forget(key, stale);
		const saving = editing.done();
		await leave();
		await saving;
	}
	async function cancel() {
		if (editing.count > 0 && !(await ask(LEAVE))) return;
		editing.cancel();
		void leave();
	}
</script>

<div class="bar" role="region" aria-label="Editing the shared page">
	<div class="text">
		<strong>Editing the shared page</strong>
		<span>Everyone sees this.</span>
	</div>
	<div class="actions">
		<button class="plain" disabled={editing.count === 0} onclick={() => editing.undo()}>
			<Undo size={16} aria-hidden="true" /> Undo
		</button>
		<button class="plain" onclick={() => (adding = true)}>
			<Plus size={16} aria-hidden="true" /> Add a card
		</button>
		{#if key === 'home'}<button class="plain" onclick={() => (styling = true)}>Style</button>{/if}
		<button class="plain" onclick={cancel}>Cancel</button>
		<button class="done" onclick={done}>Done</button>
	</div>
</div>
{#if changed}
	<p class="note">
		<button
			class="link"
			onclick={async () => {
				const yes = await ask({
					title: 'Put this page back to how it is generated?',
					body: 'Everyone’s shared page loses its arrangement. People’s own changes stay.',
					go: 'Put it back',
					danger: true
				});
				if (yes) editing.reset(key);
			}}>Back to the generated page</button
		>
	</p>
{/if}
{#if household.trouble}<p class="trouble" role="alert">{household.trouble}</p>{/if}
{#if styling}<StylePicker page={key} close={() => (styling = false)} />{/if}
{#if adding}<AddCard {key} close={() => (adding = false)} />{/if}

<style>
	.bar {
		position: sticky;
		top: var(--header-h, 64px);
		z-index: 4;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 14px;
		border-radius: var(--radius);
		background: var(--accent);
		color: var(--accent-ink);
	}
	.text {
		flex: 1 1 180px;
		display: flex;
		flex-direction: column;
		font-size: 13px;
		min-width: 0;
	}
	strong {
		font-size: 15px;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	/* On a phone the buttons take a row of their own, Done at the end. */
	@media (max-width: 699px) {
		.actions {
			flex: 1 1 100%;
		}
		.actions button {
			padding: 0 11px;
		}
		.done {
			margin-left: auto;
		}
	}
	button {
		height: 40px;
		padding: 0 14px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.plain {
		border: 1px solid color-mix(in srgb, var(--accent-ink) 40%, transparent);
		background: none;
		color: var(--accent-ink);
	}
	.plain:disabled {
		opacity: 0.45;
	}
	.done {
		border: none;
		background: var(--accent-ink);
		color: var(--accent);
	}
	.note,
	.trouble {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.trouble {
		color: var(--alert);
	}
	.link {
		display: inline;
		height: auto;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font-size: 13px;
	}
</style>
