<!--
	Add a card to the household's page (M2 `add`), in Edit mode: anything in
	the house that isn't already generated on this page. On Home, added cards
	appear under Pinned; on a room's page, under "Also here".
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { added, ref } from '#lib/layers.js';
	import { editing } from '#lib/edit.svelte.js';

	let { key, close }: { key: string; close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let query = $state('');
	onMount(() => dialog?.showModal());

	const room = $derived(key.startsWith('room:') ? key.slice(5) : null);
	const already = $derived(new Set(added(editing.changes(key))));
	const items = $derived(
		[
			...Object.values(devices.byId)
				.map((d) => {
					const r = roomOf(d, rooms.list);
					return {
						ref: ref.device(d.device_id),
						name: displayName(d),
						where: r?.name ?? 'Not in a room',
						here: room !== null && (r?.id ?? 'none') === room
					};
				})
				.filter((i) => !i.here),
			...(room === null
				? scenes.list.map((s) => ({
						ref: ref.scene(s.id),
						name: s.name,
						where: 'Scene',
						here: false
					}))
				: [])
		]
			.filter((i) => !already.has(i.ref))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const hits =
			q === '' ? items : items.filter((i) => `${i.name} ${i.where}`.toLowerCase().includes(q));
		return hits.slice(0, 60);
	});

	function choose(r: string) {
		editing.changePage(key, { op: 'add', ref: r });
		dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Add a card"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<label class="field">
			<SearchIcon size={20} aria-hidden="true" />
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={query}
				placeholder="Add a card for…"
				aria-label="Find something to add"
				autocomplete="off"
				spellcheck="false"
				autofocus
			/>
		</label>
		<ul>
			{#each shown as i (i.ref)}
				<li>
					<button onclick={() => choose(i.ref)}>
						<span class="title">{i.name}</span>
						<span class="detail">{i.where}</span>
					</button>
				</li>
			{:else}
				<li class="none">Nothing to add{query.trim() ? ` matching “${query.trim()}”` : ''}.</li>
			{/each}
		</ul>
	</div>
</dialog>

<style>
	dialog {
		margin: 10vh auto auto;
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
		max-height: 75vh;
	}
	.field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		height: 56px;
		color: var(--ink-muted);
		flex: none;
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
	ul {
		list-style: none;
		margin: 0;
		padding: 6px;
		border-top: 1px solid var(--line);
		overflow-y: auto;
	}
	li button {
		width: 100%;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-height: var(--target);
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: none;
		text-align: left;
	}
	li button:hover {
		background: var(--nav-on);
	}
	.title {
		font-weight: 600;
	}
	.detail {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.none {
		padding: 12px;
		color: var(--ink-muted);
	}
</style>
