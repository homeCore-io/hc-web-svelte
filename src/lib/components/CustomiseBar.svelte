<!--
	The banner while a page is being arranged (N6): it says plainly that only
	this person sees the changes, offers Add (into their own layer, G17),
	"Reset to shared", and ends with Done. On a phone it is one row, the buttons
	as symbols, and only its words while Add's sheet is open under the page.
-->
<script lang="ts">
	import { customise } from '#lib/customise.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Palette from '@lucide/svelte/icons/palette';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

	let {
		page,
		home = false,
		own = false
	}: {
		page: string;
		home?: boolean;
		/** A page of this person's own (G28): there is no shared page to go back to. */
		own?: boolean;
	} = $props();
	let styling = $state(false);
	const changed = $derived(
		personal.changes(page).length > 0 || (home && (personal.doc.favourites?.length ?? 0) > 0)
	);
</script>

{#if customise.on(page)}
	<div class="bar" class:sheet={adding.page === page} role="region" aria-label="Customizing">
		<div class="text">
			<strong>Customizing</strong>
			<span>Only you see these changes.</span>
		</div>
		<div class="actions">
			<button class="reset" aria-label="Add" onclick={() => adding.open(page)}
				><Plus size={16} aria-hidden="true" class="symbol" /><span class="word">Add</span></button
			>
			{#if home}<button class="reset" aria-label="Style" onclick={() => (styling = true)}
					><Palette size={16} aria-hidden="true" class="symbol" /><span class="word">Style</span
					></button
				>{/if}
			{#if !own}<button
					class="reset"
					aria-label="Reset to shared"
					disabled={!changed}
					onclick={async () => {
						const yes = await ask({
							title: 'Put this page back to how everyone else sees it?',
							body: 'Your own changes to it are dropped.',
							go: 'Reset to shared'
						});
						if (!yes) return;
						void personal.resetPage(page);
						if (home) void personal.change((d) => ({ ...d, favourites: [] }));
					}}
					><RotateCcw size={16} aria-hidden="true" class="symbol" /><span class="word"
						>Reset to shared</span
					></button
				>{/if}
			<button class="done" onclick={() => (customise.page = null)}>Done</button>
		</div>
	</div>
	{#if styling}{#await import('./StylePicker.svelte') then { default: StylePicker }}<StylePicker
				{page}
				close={() => (styling = false)}
			/>{/await}{/if}
	{#if personal.trouble}<p class="trouble" role="alert">{personal.trouble}</p>{/if}
{/if}

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
		background: var(--lit-bg);
		border: 1px solid var(--lit-card-line);
		color: var(--lit-ink);
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
	.actions :global(.symbol) {
		display: none;
	}
	/* On a phone, one row: the buttons as symbols, Done in words. While Add's
	   sheet is open under the page, only the words: the sheet has its own
	   Done, and the page needs the room. */
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
		.word {
			display: none;
		}
		.actions {
			flex-wrap: nowrap;
			gap: 4px;
		}
		.actions :global(.symbol) {
			display: block;
		}
		.reset {
			display: grid;
			place-items: center;
			width: 40px;
			height: 40px;
			padding: 0;
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
		border-radius: 20px;
		font-size: 14px;
		font-weight: 600;
		flex: none;
	}
	.reset {
		border: 1px solid var(--lit-card-line);
		background: var(--surface);
		color: var(--ink);
	}
	.reset:disabled {
		opacity: 0.5;
	}
	.done {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.trouble {
		margin: 0;
		color: var(--alert);
		font-size: 13px;
	}
</style>
