<!--
	Add a card to the household's page (M2 `add`), in Edit mode: anything in
	the house that isn't already generated on this page, and plugins' own cards
	(a new one each time — the same card can be added twice, set differently).
	On Home, added cards appear under Pinned; on a room's page, under "Also
	here".

	Chips along the top narrow it to a kind of thing; the list is grouped by
	room, so the scenes a hub gives every room ("Bright", "Bright", "Bright")
	are told apart by their heading. Plugins' cards come first, as their own.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import Icon from './Icon.svelte';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { added, ref } from '#lib/layers.js';
	import { editing } from '#lib/edit.svelte.js';
	import { pluginLabel } from '#lib/inventory.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { deviceOffer, finds, SHELVES, underRooms, type Offer, type Shelf } from '#lib/addCard.js';

	pluginUis.ensure();

	let { key, close }: { key: string; close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let query = $state('');
	let shelf = $state<Shelf | 'all' | 'cards'>('all');
	onMount(() => dialog?.showModal());

	const room = $derived(key.startsWith('room:') ? key.slice(5) : null);
	const already = $derived(new Set(added(editing.changes(key))));

	const offers = $derived(
		[
			...Object.values(devices.byId).map((d) =>
				deviceOffer(d, rooms.list, ref.device(d.device_id))
			),
			...(room === null
				? scenes.list.map((s): Offer => ({
						ref: ref.scene(s.id),
						name: s.name,
						shelf: 'scene',
						icon: 'scene',
						what: 'Scene · homeCore',
						room: ''
					}))
				: [])
		]
			// On a room's page its own things are already there.
			.filter((o) => (room === null || o.room !== room) && !already.has(o.ref))
	);
	const cards = $derived(
		pluginUis.cards().map((c) => ({
			pluginId: c.pluginId,
			element: c.slot.element,
			name: c.slot.label ?? c.slot.element,
			// Written to follow the card's name; here it starts its own line.
			description: (c.slot.description ?? '').replace(/^./, (ch) => ch.toUpperCase()),
			plugin: pluginLabel(c.pluginId)
		}))
	);

	const roomName = (id: string) => rooms.list.find((r) => r.id === id)?.name ?? '';
	const found = $derived(
		offers.filter((o) => finds(query, `${o.name} ${roomName(o.room)} ${o.what}`))
	);
	const foundCards = $derived(
		cards.filter((c) => finds(query, `${c.name} ${c.description} ${c.plugin} card`))
	);

	/** The chips: a kind with nothing in it (for this search) is left out. */
	const chips = $derived([
		{ id: 'all' as const, label: 'All', n: found.length + foundCards.length },
		...SHELVES.map((s) => ({ ...s, n: found.filter((o) => o.shelf === s.id).length })),
		{ id: 'cards' as const, label: 'Plugin cards', n: foundCards.length }
	]);
	const shownChips = $derived(chips.filter((c) => c.id === 'all' || c.n > 0 || c.id === shelf));

	const showCards = $derived(shelf === 'all' || shelf === 'cards' ? foundCards : []);
	const groups = $derived(
		shelf === 'cards'
			? []
			: underRooms(shelf === 'all' ? found : found.filter((o) => o.shelf === shelf), rooms.list)
	);

	function add(r: string) {
		editing.changePage(key, { op: 'add', ref: r });
		dialog?.close();
	}
	function addCard(pluginId: string, element: string) {
		add(ref.card(pluginId, element, Math.random().toString(36).slice(2, 10)));
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
			{#if query}
				<button class="clear" aria-label="Clear the search" onclick={() => (query = '')}>
					<X size={18} aria-hidden="true" />
				</button>
			{/if}
		</label>
		<div class="chips" role="group" aria-label="Show">
			{#each shownChips as c (c.id)}
				<button
					class="chip"
					aria-pressed={shelf === c.id}
					onclick={(e) => {
						shelf = c.id;
						e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
					}}
				>
					{c.label} <span class="n">{c.n}</span>
				</button>
			{/each}
		</div>
		<div class="list">
			{#if showCards.length}
				{#if shelf === 'all'}<h3>Cards from plugins</h3>{/if}
				<div class="cards">
					{#each showCards as c (`${c.pluginId}/${c.element}`)}
						<button class="pcard" onclick={() => addCard(c.pluginId, c.element)}>
							<span class="ico plug"><Puzzle size={18} aria-hidden="true" /></span>
							<span class="words">
								<b>{c.name}</b>
								{#if c.description}<small>{c.description}</small>{/if}
								<em>{c.plugin} · add as many as you like</em>
							</span>
						</button>
					{/each}
				</div>
			{/if}
			{#each groups as g (g.id)}
				<h3>{g.name}</h3>
				<ul>
					{#each g.offers as o (o.ref)}
						<li>
							<button class="row" onclick={() => add(o.ref)}>
								<span class="ico"><Icon name={o.icon} size={18} /></span>
								<span class="words">
									<span class="title">{o.name}</span>
									<span class="detail">{o.what}</span>
								</span>
								<span class="plus"><Plus size={16} aria-hidden="true" /></span>
							</button>
						</li>
					{/each}
				</ul>
			{/each}
			{#if !showCards.length && !groups.length}
				<p class="none">Nothing to add{query.trim() ? ` matching “${query.trim()}”` : ''}.</p>
			{/if}
		</div>
	</div>
</dialog>

<style>
	dialog {
		margin: 10vh auto auto;
		padding: 0;
		width: min(600px, calc(100vw - 24px));
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
		max-height: 80vh;
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
		min-width: 0;
		height: 100%;
		border: none;
		background: none;
		font-size: 17px;
		color: var(--ink);
		outline: none;
	}
	.clear {
		display: flex;
		padding: 6px;
		border: none;
		background: none;
		color: var(--ink-muted);
	}
	.chips {
		display: flex;
		gap: 6px;
		padding: 0 12px 12px;
		overflow-x: auto;
		flex: none;
		scrollbar-width: none;
	}
	.chip {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.chip .n {
		font-family: var(--font-num);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.chip[aria-pressed='true'] .n {
		color: inherit;
		opacity: 0.8;
	}
	.list {
		overflow-y: auto;
		padding: 0 6px 10px;
		border-top: 1px solid var(--line);
	}
	h3 {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: 0;
		padding: 12px 12px 4px;
		background: var(--sheet);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--target);
		padding: 6px 10px;
		border: none;
		border-radius: 10px;
		background: none;
		text-align: left;
	}
	.row:hover {
		background: var(--nav-on);
	}
	.ico {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		background: var(--nav-on);
		color: var(--ink-muted);
	}
	.ico.plug {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.row .words {
		flex: 1;
		flex-direction: row;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.title {
		min-width: 0;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.detail {
		flex: none;
		color: var(--ink-muted);
		font-size: 12.5px;
	}
	.plus {
		flex: none;
		display: flex;
		color: var(--accent);
		opacity: 0;
	}
	.row:hover .plus,
	.row:focus-visible .plus {
		opacity: 1;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 8px;
		padding: 6px;
	}
	.pcard {
		display: flex;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
		text-align: left;
	}
	.pcard:hover {
		border-color: var(--accent);
	}
	.words {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.words small {
		color: var(--ink-muted);
		font-size: 12.5px;
		line-height: 1.35;
	}
	.words em {
		align-self: flex-start;
		margin-top: 4px;
		padding: 1px 6px;
		border-radius: 6px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 11px;
		font-style: normal;
	}
	/* On a phone the name gets the width; what it is goes under it. */
	@media (max-width: 520px) {
		.row .words {
			flex-direction: column;
			gap: 0;
		}
	}
	.none {
		margin: 0;
		padding: 14px 12px;
		color: var(--ink-muted);
	}
</style>
