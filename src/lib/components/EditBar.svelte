<!--
	Edit mode's bar (N6): it says plainly that everyone sees these changes, and
	holds Undo, Add, Cancel and Done. On a phone it is one row, the buttons as
	symbols, and only its words while Add's sheet is open under the page. Changes that name something the
	page no longer has do nothing; Done tidies them away without asking (#4).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Plus from '@lucide/svelte/icons/plus';
	import Palette from '@lucide/svelte/icons/palette';
	import X from '@lucide/svelte/icons/x';
	import { editing, LEAVE } from '#lib/edit.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { gone } from '#lib/layers.js';
	import { withEdit } from '#lib/nav.js';
	import { adding } from '#lib/adding.svelte.js';

	let { key }: { key: string } = $props();

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

<div
	class="bar"
	class:sheet={adding.page === key}
	role="region"
	aria-label="Editing the shared page"
>
	<div class="text">
		<strong
			><span class="long">Editing the shared page</span><span class="short">Editing</span></strong
		>
		<span>Everyone sees this.</span>
	</div>
	<div class="actions">
		<button
			class="plain"
			aria-label="Undo"
			disabled={editing.count === 0}
			onclick={() => editing.undo()}
		>
			<Undo size={16} aria-hidden="true" /><span class="word">Undo</span>
		</button>
		<button class="plain" aria-label="Add" onclick={() => adding.open(key)}>
			<Plus size={16} aria-hidden="true" /><span class="word">Add</span>
		</button>
		{#if key === 'home'}<button class="plain" aria-label="Style" onclick={() => (styling = true)}
				><Palette size={16} aria-hidden="true" class="symbol" /><span class="word">Style</span
				></button
			>{/if}
		<button class="plain" aria-label="Cancel" onclick={cancel}>
			<X size={16} aria-hidden="true" class="symbol" /><span class="word">Cancel</span>
		</button>
		<button class="done" onclick={done}>Done</button>
	</div>
</div>
<!-- A page someone made has no generated page to go back to (G27). -->
{#if changed && !key.startsWith('page:')}
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
{#if styling}{#await import('./StylePicker.svelte') then { default: StylePicker }}<StylePicker
			page={key}
			close={() => (styling = false)}
		/>{/await}{/if}

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
		flex-wrap: wrap;
		gap: 6px;
	}
	.short {
		display: none;
	}
	/* Style and Cancel are words on a wide screen, symbols on a phone. */
	.actions :global(.symbol) {
		display: none;
	}
	/* On a phone, one row: short words, the buttons as symbols, Done in words.
	   While Add's sheet is open under the page, only the words: the sheet has
	   its own Done, and the page needs the room. */
	@media (max-width: 699px) {
		/* Out of the way while a card is held (13 §9.2). */
		:global(html[data-dragging]) .bar {
			opacity: 0;
			pointer-events: none;
		}
		.bar {
			flex-wrap: nowrap;
			gap: 8px;
			padding: 6px 6px 6px 12px;
		}
		.text {
			flex: 1 1 auto;
		}
		.text > span,
		strong {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.long,
		.word {
			display: none;
		}
		.short {
			display: inline;
		}
		.actions {
			flex-wrap: nowrap;
			gap: 4px;
		}
		.actions :global(.symbol) {
			display: block;
		}
		.plain {
			width: 40px;
			height: 40px;
			padding: 0;
			justify-content: center;
		}
		.done {
			height: 40px;
		}
		.sheet {
			padding: 8px 12px;
		}
		.sheet .text {
			flex-direction: row;
			gap: 6px;
			align-items: baseline;
		}
		.sheet .actions {
			display: none;
		}
	}
	button {
		height: 44px;
		padding: 0 14px;
		border-radius: 22px;
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
