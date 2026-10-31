<!--
	A section's tools while arranging (G-a): move it up or down among the
	sections shown, hide it or show it again, and — in Edit, for the
	household — give it another heading (G10). The alerts have none: they are
	always first (G6).
-->
<script lang="ts">
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Settings from '@lucide/svelte/icons/settings-2';
	import { nudge } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';

	let {
		page,
		ref,
		title,
		shown,
		hidden = false,
		renamed = false,
		settings
	}: {
		page: string;
		ref: string;
		/** Its heading as shown. */
		title: string;
		/** The movable sections shown, in order — for up and down. */
		shown: string[];
		hidden?: boolean;
		renamed?: boolean;
		/** Settings for every card in it, where its cards' kind has them: every room's box. */
		settings?: { label: string; open: () => void };
	} = $props();

	const shared = $derived(view.mode(page) === 'edit');
	const up = $derived(nudge(shown, ref, -1));
	const down = $derived(nudge(shown, ref, 1));

	let naming = $state(false);
	let draft = $state('');
	function finishNaming(keep: boolean) {
		naming = false;
		const next = draft.trim();
		// Left empty, it takes its own heading back.
		if (keep && next !== title) view.change(page, { op: 'rename', ref, name: next });
	}
</script>

{#if naming}
	<form
		class="tools naming"
		onsubmit={(e) => {
			e.preventDefault();
			finishNaming(true);
		}}
	>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={draft}
			aria-label={`Heading for ${title}`}
			placeholder="Its own heading"
			autofocus
			onkeydown={(e) => e.key === 'Escape' && finishNaming(false)}
		/>
		<button type="submit" class="text">Save</button>
	</form>
{:else}
	<div class="tools" class:shared role="group" aria-label={`Arrange the ${title} section`}>
		<button
			aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
			onclick={() => view.change(page, { op: hidden ? 'show' : 'hide', ref })}
		>
			{#if hidden}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
		</button>
		{#if !hidden}
			{#if shared}
				<button
					aria-label={`Rename ${title}`}
					aria-pressed={renamed}
					onclick={() => {
						draft = title;
						naming = true;
					}}><Pencil size={17} /></button
				>
			{/if}
			<button
				aria-label={`Move ${title} up`}
				disabled={!up}
				onclick={() => up && view.change(page, up)}><ArrowUp size={18} /></button
			>
			<button
				aria-label={`Move ${title} down`}
				disabled={!down}
				onclick={() => down && view.change(page, down)}><ArrowDown size={18} /></button
			>
			{#if settings}
				<button class="text plain" onclick={settings.open}
					><Settings size={16} aria-hidden="true" />{settings.label}</button
				>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.tools {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--sheet);
		border: 1px solid var(--line);
	}
	.tools.shared {
		border-color: var(--accent);
	}
	button {
		min-width: 34px;
		height: 34px;
		border: none;
		border-radius: 9px;
		background: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink);
	}
	button:disabled {
		opacity: 0.3;
	}
	button[aria-pressed='true'] {
		color: var(--accent);
	}
	.naming input {
		min-width: 0;
		width: 180px;
		height: 34px;
		border: none;
		background: none;
		padding: 0 8px;
		outline: none;
	}
	.text {
		padding: 0 12px;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.text.plain {
		gap: 6px;
		background: none;
		color: var(--ink);
	}
</style>
