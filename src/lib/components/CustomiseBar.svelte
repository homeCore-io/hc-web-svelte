<!--
	The banner while a page is being arranged (N6): it says plainly that only
	this person sees the changes, offers "Reset to shared", and ends with Done.
-->
<script lang="ts">
	import { customise } from '#lib/customise.svelte.js';
	import { personal } from '#lib/personal.svelte.js';

	let { page, home = false }: { page: string; home?: boolean } = $props();
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
		<button
			class="reset"
			disabled={!changed}
			onclick={() => {
				if (!confirm('Put this page back to how everyone else sees it?')) return;
				void personal.resetPage(page);
				if (home) void personal.change((d) => ({ ...d, favourites: [] }));
			}}>Reset to shared</button
		>
		<button class="done" onclick={() => (customise.page = null)}>Done</button>
	</div>
	{#if personal.trouble}<p class="trouble" role="alert">{personal.trouble}</p>{/if}
{/if}

<style>
	.bar {
		position: sticky;
		top: 64px;
		z-index: 4;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 10px 10px 14px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		border: 1px solid var(--lit-card-line);
		color: var(--lit-ink);
	}
	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		font-size: 13px;
		min-width: 0;
	}
	strong {
		font-size: 15px;
	}
	button {
		height: 40px;
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
