<!--
	The banner while a page is being arranged (N6): it says plainly that only
	this person sees the changes, offers Add (into their own layer, G17),
	"Reset to shared", and ends with Done.
-->
<script lang="ts">
	import { customise } from '#lib/customise.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { adding } from '#lib/adding.svelte.js';

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
	<div class="bar" role="region" aria-label="Customising">
		<div class="text">
			<strong>Customising</strong>
			<span>Only you see these changes.</span>
		</div>
		<div class="actions">
			<button class="reset" onclick={() => adding.open(page)}>Add</button>
			{#if home}<button class="reset" onclick={() => (styling = true)}>Style</button>{/if}
			{#if !own}<button
					class="reset"
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
					}}>Reset to shared</button
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
	/* On a phone the words take the first row, the buttons one of their own, Done at the end. */
	@media (max-width: 699px) {
		.actions {
			flex: 1 1 100%;
		}
		.actions button {
			padding: 0 12px;
		}
		.done {
			margin-left: auto;
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
