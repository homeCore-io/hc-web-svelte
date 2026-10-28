<!--
	The one way to change a page (Home or a room): "Edit", then just for me
	(Customise — star, hide, order, size) or for everyone (the shared page —
	add, change, remove cards). Someone who may only change their own view goes
	straight to Customise. Hidden while either is on.
-->
<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { customise } from '#lib/customise.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { withEdit } from '#lib/nav.js';

	let { pageKey }: { pageKey: string } = $props();

	const shared = $derived(session.can('content:write'));
	const shown = $derived(!session.isDisplay && !customise.on(pageKey) && !editing.on(pageKey));
	let open = $state(false);

	function mine() {
		open = false;
		customise.page = pageKey;
	}
	function everyone() {
		open = false;
		void goto(withEdit(page.url, true));
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && !(e.target as Element).closest?.('.edit-menu')) open = false;
	}}
	onkeydown={(e) => e.key === 'Escape' && (open = false)}
/>

{#if shown}
	<span class="edit-menu">
		<button
			class="icon"
			aria-label="Edit this page"
			title="Edit this page"
			aria-haspopup={shared ? 'menu' : undefined}
			aria-expanded={shared ? open : undefined}
			onclick={() => (shared ? (open = !open) : mine())}
		>
			<Pencil size={20} strokeWidth={1.8} aria-hidden="true" />
		</button>
		{#if open}
			<div class="menu" role="menu">
				<button type="button" role="menuitem" onclick={mine}>
					<strong>Just for me</strong>
					<span>Star, hide, order and size cards — only you see it</span>
				</button>
				<button type="button" role="menuitem" onclick={everyone}>
					<strong>For everyone</strong>
					<span>Add, change and remove cards on the shared page</span>
				</button>
			</div>
		{/if}
	</span>
{/if}

<style>
	.edit-menu {
		position: relative;
	}
	.icon {
		width: var(--target);
		height: var(--target);
		border: none;
		background: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink);
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: 30;
		display: flex;
		flex-direction: column;
		width: 280px;
		padding: 4px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
	}
	.menu button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: 10px 12px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.menu button:hover {
		background: var(--surface-2);
	}
	.menu span {
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
