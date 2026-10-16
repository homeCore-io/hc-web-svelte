<!--
	One search for everything (N8), from the header or ⌘K / Ctrl-K. A device
	opens its details over the current page (N5); a room, scene list or page
	goes there.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { search, type Hit } from '#lib/search.js';
	import { SIDEBAR } from '#lib/nav.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { finder } from '#lib/finder.svelte.js';
	import { openDevice } from '#lib/popup.js';

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	let query = $state('');
	let at = $state(0);

	const pages = $derived([
		...SIDEBAR.map((d) => ({ href: d.href, title: d.label })),
		{ href: '/me', title: 'Me' },
		...(session.isAdmin ? [{ href: '/settings', title: 'Settings' }] : [])
	]);
	const hits = $derived(
		search(query, {
			devices: Object.values(devices.byId),
			rooms: rooms.list,
			scenes: scenes.list,
			pages
		})
	);
	$effect(() => {
		void hits;
		at = 0;
	});

	$effect(() => {
		if (!dialog) return;
		if (finder.open && !dialog.open) {
			query = '';
			dialog.showModal();
			input?.focus();
		} else if (!finder.open && dialog.open) dialog.close();
	});

	function keys(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			finder.open = !finder.open;
		}
	}

	function choose(h: Hit | undefined) {
		if (!h) return;
		finder.open = false;
		if (h.type === 'device' || (h.type === 'scene' && h.id in devices.byId))
			openDevice(h.id, page.url);
		else if (h.type === 'room') void goto(`/rooms/${h.id}`);
		else if (h.type === 'scene') void goto('/scenes');
		else void goto(h.href);
	}

	function move(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			at = Math.min(at + 1, hits.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			at = Math.max(at - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(hits[at]);
		}
	}
</script>

<svelte:window onkeydown={keys} />

<dialog
	bind:this={dialog}
	aria-label="Search"
	onclose={() => (finder.open = false)}
	onclick={(e) => {
		if (e.target === dialog) finder.open = false;
	}}
>
	<div class="box">
		<label class="field">
			<SearchIcon size={20} aria-hidden="true" />
			<input
				bind:this={input}
				bind:value={query}
				onkeydown={move}
				placeholder="Search devices, rooms, scenes"
				aria-label="Search"
				aria-controls="search-results"
				aria-activedescendant={hits[at] ? `hit-${at}` : undefined}
				autocomplete="off"
				spellcheck="false"
			/>
			<kbd>esc</kbd>
		</label>
		{#if query.trim() !== ''}
			<ul id="search-results" role="listbox">
				{#each hits as h, i (h.type + ('id' in h ? h.id : h.href))}
					<li
						id={`hit-${i}`}
						role="option"
						aria-selected={i === at}
						onpointermove={() => (at = i)}
						onclick={() => choose(h)}
						onkeydown={() => {}}
					>
						<span class="title">{h.title}</span>
						<span class="detail">{h.detail}</span>
					</li>
				{:else}
					<li class="none">Nothing matches “{query.trim()}”.</li>
				{/each}
			</ul>
		{/if}
	</div>
</dialog>

<style>
	dialog {
		margin: 12vh auto auto;
		padding: 0;
		width: min(560px, calc(100vw - 24px));
		border: none;
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.box {
		display: flex;
		flex-direction: column;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		height: 56px;
		color: var(--ink-muted);
	}
	input {
		flex: 1;
		height: 100%;
		border: none;
		background: none;
		font-size: 17px;
		color: var(--ink);
		outline: none;
	}
	kbd {
		font-family: var(--font-num);
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 6px;
		border: 1px solid var(--line);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 6px;
		border-top: 1px solid var(--line);
		max-height: 60dvh;
		overflow-y: auto;
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 10px;
		cursor: pointer;
	}
	li[aria-selected='true'] {
		background: var(--nav-on);
	}
	.title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.detail {
		font-size: 13px;
		color: var(--ink-muted);
		flex: none;
	}
	.none {
		color: var(--ink-muted);
		cursor: default;
	}
</style>
