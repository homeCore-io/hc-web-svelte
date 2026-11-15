<!--
	The editor for Home's scenes row (homeScenes.ts), opened by its Edit. Whose
	row changes: "Everyone" (the household's, for people who may change the
	house's content; the same list as the stars in Settings › Scenes) or "Just
	me" (the person's own, which wins for them on every screen). With no row
	of their own a person sees the house's, and changing it makes it theirs;
	"Use the house's" lets theirs go.

	Scenes reorder by dragging the grip, by the up and down buttons, or by the
	arrow keys on the grip; ✕ takes one off; Add finds any scene in the house,
	each Hue room's copy on its own. A modal dialog: the keyboard stays inside
	it, Escape or Done closes it. Loaded only when it opens.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { withHomeScenes } from '#lib/homeScenes.js';
	import { findPicks, pickable } from '#lib/sceneList.js';
	import { nudgeFavourite } from '#lib/layers.js';
	import { moved, reorder } from '#lib/reorder.js';

	let { onclose }: { onclose: () => void } = $props();

	const mayAll = $derived(session.can('content:write'));
	const houseList = $derived(household.doc.home?.scenes ?? []);
	const mine = $derived(personal.doc.home?.scenes ?? []);
	// A person with a row of their own starts there; one who may, at the house's.
	let layer = $state<'all' | 'me'>(
		(personal.doc.home?.scenes?.length ?? 0) === 0 && session.can('content:write') ? 'all' : 'me'
	);
	const forAll = $derived(layer === 'all' && mayAll);
	// Just me with none of their own: the house's, until it's changed.
	const borrowed = $derived(!forAll && mine.length === 0);
	const saved = $derived(forAll ? houseList : borrowed ? houseList : mine);
	let dragging = $state<string[] | null>(null);
	const list = $derived(dragging ?? saved);

	function save(next: string[]) {
		if (forAll) void household.change((d) => withHomeScenes(d, next));
		else void personal.change((d) => withHomeScenes(d, next));
	}

	const picks = $derived(pickable(devices.byId, scenes.list, rooms.list));
	const byRef = $derived(new Map(picks.map((p) => [p.ref, p])));

	// ---- reordering: by dragging, by its buttons, by the arrow keys on its grip ----
	let listEl = $state<HTMLElement>();
	async function nudge(r: string, by: -1 | 1) {
		save(nudgeFavourite(list, r, by));
		await tick();
		listEl?.querySelector<HTMLElement>(`[data-ref="${CSS.escape(r)}"] [data-grip]`)?.focus();
	}
	function key(e: KeyboardEvent, r: string) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			void nudge(r, e.key === 'ArrowUp' ? -1 : 1);
		}
	}

	// ---- adding ----
	let adding = $state(false);
	let query = $state('');
	let searchEl = $state<HTMLInputElement>();
	const offered = $derived(findPicks(picks, query).filter((p) => !list.includes(p.ref)));
	async function openAdd() {
		adding = true;
		await tick();
		searchEl?.focus();
	}

	let dialog = $state<HTMLDialogElement>();
	onMount(() => {
		const from = document.activeElement;
		dialog?.showModal();
		return () => {
			if (dialog?.open) dialog.close();
			if (from instanceof HTMLElement && from.isConnected) from.focus();
		};
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="hse-title"
	oncancel={(e) => {
		e.preventDefault();
		onclose();
	}}
>
	<div class="box">
		<header>
			<h2 id="hse-title">Scenes on Home</h2>
			{#if mayAll}
				<div class="seg" role="radiogroup" aria-label="Whose row">
					{#each [{ id: 'all', name: 'Everyone' }, { id: 'me', name: 'Just me' }] as o (o.id)}
						<button
							type="button"
							role="radio"
							aria-checked={layer === o.id}
							onclick={() => {
								layer = o.id as 'all' | 'me';
								adding = false;
							}}>{o.name}</button
						>
					{/each}
				</div>
			{/if}
		</header>
		<p class="note">
			{#if forAll}
				Everyone sees this row on Home, unless they keep their own.
			{:else if borrowed}
				You see the house’s row. Change it here to keep your own.
			{:else}
				Only you see this row, on every screen you sign in to.
			{/if}
		</p>

		{#if list.length === 0}
			<p class="empty">No scenes yet. Home shows no row until one is added.</p>
		{:else}
			<ol
				class="items"
				bind:this={listEl}
				use:reorder={{
					move: (from, to) => (dragging = moved(list, from, to)),
					drop: () => {
						if (dragging) save(dragging);
						dragging = null;
					}
				}}
			>
				{#each list as r, i (r)}
					{@const p = byRef.get(r)}
					<li data-item data-ref={r}>
						<button
							type="button"
							class="grip"
							data-grip
							aria-label={`Move ${p?.name ?? 'this scene'}: arrow keys`}
							onkeydown={(e) => key(e, r)}><GripVertical size={16} aria-hidden="true" /></button
						>
						<span class="text">
							<b>{p?.name ?? 'A scene that’s gone'}</b>
							<small>{p?.label ?? 'It no longer shows on Home'}</small>
						</span>
						<button
							type="button"
							class="ib"
							aria-label={`Move ${p?.name ?? 'it'} up`}
							disabled={i === 0}
							onclick={() => nudge(r, -1)}><ChevronUp size={16} aria-hidden="true" /></button
						>
						<button
							type="button"
							class="ib"
							aria-label={`Move ${p?.name ?? 'it'} down`}
							disabled={i === list.length - 1}
							onclick={() => nudge(r, 1)}><ChevronDown size={16} aria-hidden="true" /></button
						>
						<button
							type="button"
							class="ib"
							aria-label={`Take ${p?.name ?? 'it'} off`}
							onclick={() => save(list.filter((x) => x !== r))}
							><X size={16} aria-hidden="true" /></button
						>
					</li>
				{/each}
			</ol>
		{/if}

		{#if adding}
			<div class="picker">
				<label class="search">
					<Search size={16} aria-hidden="true" />
					<input
						bind:this={searchEl}
						type="search"
						bind:value={query}
						placeholder="Find a scene"
						aria-label="Find a scene"
					/>
				</label>
				<ul class="picks" aria-label="Scenes to add">
					{#each offered as p (p.ref)}
						<li>
							<button type="button" onclick={() => save([...list, p.ref])}>
								<b>{p.name}</b><small>{p.label}</small>
							</button>
						</li>
					{:else}
						<li class="none">
							{query.trim() ? 'No scene matches.' : 'Every scene is on the row.'}
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<button type="button" class="add" onclick={openAdd}
				><Plus size={16} aria-hidden="true" />Add a scene</button
			>
		{/if}

		<footer>
			{#if !forAll && mine.length > 0}
				<button
					type="button"
					class="ghost"
					onclick={() => void personal.change((d) => withHomeScenes(d, undefined))}
					>Use the house’s</button
				>
			{/if}
			<span class="gap"></span>
			<button type="button" class="done" onclick={onclose}>Done</button>
		</footer>
	</div>
</dialog>

<style>
	dialog {
		width: min(520px, calc(100vw - 24px));
		max-height: calc(100dvh - 48px);
		margin: auto;
		padding: 0;
		border: 1px solid var(--card-line);
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 20px;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	h2 {
		margin: 0;
		font-size: 19px;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--line);
		border-radius: 999px;
		overflow: hidden;
	}
	.seg button {
		height: 34px;
		padding: 0 14px;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.seg button[aria-checked='true'] {
		background: var(--ink);
		color: var(--bg);
	}
	.note,
	.empty {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
		line-height: 1.45;
	}
	.empty {
		padding: 14px;
		border: 1px dashed var(--line);
		border-radius: 12px;
	}
	.items,
	.picks {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.items {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.items li {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 52px;
		padding: 4px 6px 4px 2px;
		border-radius: 12px;
		border: 1px dashed var(--line);
		background: var(--surface);
	}
	.items li:global(.lifted) {
		border-style: solid;
		border-color: var(--accent);
		box-shadow: var(--shadow);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 0 6px;
	}
	.text b,
	.text small,
	.picks b,
	.picks small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.text b {
		font-size: 14px;
	}
	.text small,
	.picks small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.grip,
	.ib {
		flex: none;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 10px;
		background: none;
		color: var(--ink-muted);
	}
	.grip {
		cursor: grab;
		touch-action: none;
	}
	.ib:hover:not(:disabled),
	.grip:hover {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
	}
	.ib:disabled {
		opacity: 0.3;
	}
	.add {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 42px;
		padding: 0 16px;
		border-radius: 14px;
		border: 1.5px dashed var(--line);
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
	}
	.picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--surface);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 12px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink-muted);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		color: var(--ink);
		font: inherit;
	}
	.picks {
		max-height: 260px;
		overflow-y: auto;
	}
	.picks li + li {
		border-top: 1px solid var(--line);
	}
	.picks button {
		width: 100%;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		padding: 6px 6px;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		text-align: left;
	}
	.picks button:hover {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.picks b {
		font-weight: 600;
		min-width: 0;
	}
	.picks small {
		flex: none;
		max-width: 55%;
	}
	.none {
		padding: 10px 6px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	footer {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}
	.gap {
		flex: 1;
	}
	.ghost,
	.done {
		height: var(--target);
		padding: 0 18px;
		border-radius: 22px;
		font: inherit;
		font-weight: 700;
	}
	.ghost {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.done {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
