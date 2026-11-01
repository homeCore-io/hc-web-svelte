<!--
	Add (M2 `add`, G-c): into the section chosen, in the layer being changed —
	the household's in Edit, this person's own in Customise.

	Two tabs. Things in the house: anything not already on this page, with
	chips that narrow it to a kind of thing and a heading per room, so the
	scenes a hub gives every room ("Bright", "Bright") are told apart.
	Cards: the app's own (a heading, a note, worth knowing, playing, the
	weather, a chart) and plugins' cards — a new one each time, so the same
	card can be added twice, set differently.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import Icon from './Icon.svelte';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { newId, ref } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import { kinds } from '#lib/kinds.js';
	import { APP_KINDS, type AppKind } from '#lib/page.js';
	import { pluginLabel } from '#lib/inventory.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { deviceOffer, finds, SHELVES, underRooms, type Offer, type Shelf } from '#lib/addCard.js';

	pluginUis.ensure();

	let {
		key,
		sections,
		home,
		close
	}: {
		key: string;
		/** The sections it can add into, as headed on the page. */
		sections: { id: string; title: string }[];
		/** Where added things go when no section is said: Pinned, or "Also here". */
		home: string;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let query = $state('');
	let shelf = $state<Shelf | 'all'>('all');
	let tab = $state<'things' | 'cards'>('things');
	let into = $state(untrack(() => adding.into ?? home));
	onMount(() => dialog?.showModal());

	const room = $derived(key.startsWith('room:') ? key.slice(5) : null);
	// A page someone made can hold rooms' boxes too (G27).
	const built = $derived(key.startsWith('page:'));
	const already = $derived(new Set(view.added(key)));
	const intoTitle = $derived(sections.find((s) => s.id === into)?.title ?? '');

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
				: []),
			...(built
				? rooms.list.map((r): Offer => ({
						ref: ref.room(r.id),
						name: r.name,
						shelf: 'room',
						icon: 'door',
						what: 'Room',
						room: r.id
					}))
				: [])
		]
			// On a room's page its own things are already there.
			.filter((o) => (room === null || o.room !== room) && !already.has(o.ref))
	);
	const pluginCards = $derived(
		pluginUis.cards().map((c) => ({
			pluginId: c.pluginId,
			element: c.slot.element,
			name: c.slot.label ?? c.slot.element,
			// Written to follow the card's name; here it starts its own line.
			description: (c.slot.description ?? '').replace(/^./, (ch) => ch.toUpperCase()),
			plugin: pluginLabel(c.pluginId)
		}))
	);
	const appCards = $derived(
		APP_KINDS.flatMap((k) => {
			const kind = kinds[k];
			const ok = kind.addable && kind.addable.pages.includes(room === null ? 'home' : 'room');
			return ok && kind.offer ? [{ kind: k, ...kind.offer }] : [];
		})
	);

	const roomName = (id: string) => rooms.list.find((r) => r.id === id)?.name ?? '';
	const found = $derived(
		offers.filter((o) => finds(query, `${o.name} ${roomName(o.room)} ${o.what}`))
	);
	const foundPlugins = $derived(
		pluginCards.filter((c) => finds(query, `${c.name} ${c.description} ${c.plugin} card`))
	);
	const foundApp = $derived(appCards.filter((c) => finds(query, `${c.name} ${c.sub} card`)));

	/** The chips: a kind with nothing in it (for this search) is left out. */
	const chips = $derived([
		{ id: 'all' as const, label: 'All', n: found.length },
		...SHELVES.map((s) => ({ ...s, n: found.filter((o) => o.shelf === s.id).length }))
	]);
	const shownChips = $derived(chips.filter((c) => c.id === 'all' || c.n > 0 || c.id === shelf));
	const groups = $derived(
		underRooms(shelf === 'all' ? found : found.filter((o) => o.shelf === shelf), rooms.list)
	);

	function add(r: string) {
		const to = into === home ? {} : { into };
		view.change(key, { op: 'add', ref: r, ...to });
		dialog?.close();
	}
	function addCard(pluginId: string, element: string) {
		add(ref.card(pluginId, element, newId()));
	}
	function addApp(k: AppKind) {
		const r = ref.kind(k, newId());
		// A note, a heading, a chart show nothing until set: their settings open as they appear.
		if (kinds[k].setFirst) adding.settle = r;
		add(r);
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={`Add to ${intoTitle}`}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<div class="top">
			<label class="into"
				><span>Add to</span>
				<select bind:value={into}>
					{#each sections as s (s.id)}
						<option value={s.id}>{s.title}</option>
					{/each}
				</select>
			</label>
			<button class="x" aria-label="Close" onclick={() => dialog?.close()}><X size={20} /></button>
		</div>
		<div class="tabs" role="tablist" aria-label="What to add">
			<button role="tab" aria-selected={tab === 'things'} onclick={() => (tab = 'things')}
				>Things in the house</button
			>
			<button role="tab" aria-selected={tab === 'cards'} onclick={() => (tab = 'cards')}
				>Cards</button
			>
		</div>
		<label class="field">
			<SearchIcon size={20} aria-hidden="true" />
			<!-- svelte-ignore a11y_autofocus -->
			<input
				bind:value={query}
				placeholder={tab === 'things' ? 'A light, a scene, a sensor…' : 'A note, a chart…'}
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
		{#if tab === 'things'}
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
		{/if}
		<div class="list" role="tabpanel">
			{#if tab === 'cards'}
				{#if foundApp.length}
					<h3>Cards</h3>
					<div class="cards">
						{#each foundApp as c (c.kind)}
							<button class="pcard" onclick={() => addApp(c.kind)}>
								<span class="ico"><Plus size={18} aria-hidden="true" /></span>
								<span class="words">
									<b>{c.name}</b>
									<small>{c.sub}</small>
								</span>
							</button>
						{/each}
					</div>
				{/if}
				{#if foundPlugins.length}
					<h3>Cards from plugins</h3>
					<div class="cards">
						{#each foundPlugins as c (`${c.pluginId}/${c.element}`)}
							<button class="pcard" onclick={() => addCard(c.pluginId, c.element)}>
								<span class="ico plug"><Puzzle size={18} aria-hidden="true" /></span>
								<span class="words">
									<b>{c.name}</b>
									{#if c.description}<small>{c.description}</small>{/if}
									<em>{c.plugin}</em>
								</span>
							</button>
						{/each}
					</div>
				{/if}
				{#if !foundApp.length && !foundPlugins.length}
					<p class="none">No card{query.trim() ? ` matching “${query.trim()}”` : ''}.</p>
				{/if}
			{:else}
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
				{#if !groups.length}
					<p class="none">Nothing to add{query.trim() ? ` matching “${query.trim()}”` : ''}.</p>
				{/if}
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
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 12px 4px 16px;
	}
	.into {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		min-width: 0;
	}
	.into select {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
	}
	.x {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink-muted);
	}
	.tabs {
		display: flex;
		gap: 2px;
		margin: 8px 12px 0;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.tabs button {
		flex: 1;
		height: 36px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 600;
	}
	.tabs button[aria-selected='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
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
		/* Fade at the edge, so chips past it read as more to scroll to (#116). */
		mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent);
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
