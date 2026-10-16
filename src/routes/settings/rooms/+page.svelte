<!--
	Rooms (D10): their names as typed, the household's order on Home, their
	icons, and new rooms. Names are homeCore's — a rename keeps the room's id,
	so its devices and everything keyed by it stay (H1). Order and icons are
	the household's presentation, kept by the UI server (M1).
-->
<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { rooms } from '#lib/rooms.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { byRoom } from '#lib/summary.js';
	import { addChange, apply, nudge, ref } from '#lib/layers.js';
	import { createRoom, renameRoom } from '#lib/admin.js';
	import RoomIcon, { ROOM_ICONS, type RoomIconName } from '#lib/components/RoomIcon.svelte';

	const counts = $derived(byRoom(devices.byId, rooms.list));
	const countOf = (id: string) => counts.get(id)?.length ?? 0;
	// The order is Home's, and Home shows only rooms with something in them.
	const onHome = $derived(
		apply(
			rooms.list.filter((r) => countOf(r.id) > 0),
			(r) => ref.room(r.id),
			household.changes('home')
		)
	);
	const refs = $derived(onHome.shown.map((r) => ref.room(r.id)));
	const empty = $derived(rooms.list.filter((r) => countOf(r.id) === 0));

	function move(id: string, by: -1 | 1) {
		const change = nudge(refs, ref.room(id), by);
		if (!change) return;
		void household.change((d) => ({
			...d,
			pages: { ...d.pages, home: addChange(d.pages?.home, change) }
		}));
	}

	function setIcon(id: string, icon: RoomIconName) {
		void household.change((d) => ({ ...d, icons: { ...d.icons, [id]: icon } }));
		picking = null;
	}

	// ---- names ----
	let names = $state<Record<string, string>>({});
	let notes = $state<Record<string, string>>({});
	let picking = $state<string | null>(null);
	async function rename(id: string, current: string) {
		const next = (names[id] ?? current).trim();
		if (next === '' || next === current) {
			delete names[id];
			return;
		}
		const err = await renameRoom(id, next);
		notes = { ...notes, [id]: err ?? 'Renamed.' };
		if (err === null) delete names[id];
	}

	let newName = $state('');
	let newNote = $state<string | null>(null);
	async function add(e: SubmitEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (name === '') return;
		const err = await createRoom(name);
		newNote = err ?? `${name} is ready. Put devices in it from Devices.`;
		if (err === null) newName = '';
	}
</script>

{#snippet row(r: { id: string; name: string }, i: number | null)}
	<li>
		<div class="line">
			<button
				class="icon"
				aria-label={`Icon for ${r.name}`}
				aria-expanded={picking === r.id}
				onclick={() => (picking = picking === r.id ? null : r.id)}
				><RoomIcon name={household.iconOf(r.id)} /></button
			>
			<input
				value={names[r.id] ?? r.name}
				aria-label={`Name of ${r.name}`}
				oninput={(e) => (names[r.id] = e.currentTarget.value)}
				onblur={() => rename(r.id, r.name)}
				onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			/>
			<span class="count">{countOf(r.id)}</span>
			{#if i !== null}
				<button aria-label={`Move ${r.name} up`} disabled={i === 0} onclick={() => move(r.id, -1)}
					><ArrowUp size={16} /></button
				>
				<button
					aria-label={`Move ${r.name} down`}
					disabled={i === refs.length - 1}
					onclick={() => move(r.id, 1)}><ArrowDown size={16} /></button
				>
			{/if}
		</div>
		{#if notes[r.id]}<p class="note" role="status">{notes[r.id]}</p>{/if}
		{#if picking === r.id}
			<div class="icons" role="radiogroup" aria-label={`Icon for ${r.name}`}>
				{#each Object.entries(ROOM_ICONS) as [key, v] (key)}
					<button
						role="radio"
						aria-checked={(household.iconOf(r.id) ?? 'house') === key}
						aria-label={v.label}
						title={v.label}
						onclick={() => setIcon(r.id, key as RoomIconName)}><RoomIcon name={key} /></button
					>
				{/each}
			</div>
		{/if}
	</li>
{/snippet}

{#if !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<form class="new" onsubmit={add}>
			<input
				bind:value={newName}
				placeholder="New room, named as you'd say it"
				aria-label="New room"
			/>
			<button type="submit" disabled={newName.trim() === ''}>Add room</button>
		</form>
		{#if newNote}<p class="note" role="status">{newNote}</p>{/if}

		<section>
			<h2 class="section-label">On Home, in this order</h2>
			<ol>
				{#each onHome.shown as r, i (r.id)}{@render row(r, i)}{/each}
				{#each onHome.hidden as r (r.id)}{@render row(r, null)}{/each}
			</ol>
			{#if onHome.hidden.length > 0}
				<p class="quiet">
					The last {onHome.hidden.length === 1 ? 'one is' : `${onHome.hidden.length} are`} hidden on Home;
					show them again from Home's Edit.
				</p>
			{/if}
		</section>

		{#if empty.length > 0}
			<section>
				<h2 class="section-label">Nothing in them yet</h2>
				<ol>
					{#each empty as r (r.id)}{@render row(r, null)}{/each}
				</ol>
			</section>
		{/if}
		{#if household.trouble}<p class="trouble" role="alert">{household.trouble}</p>{/if}
	</div>
{/if}

<style>
	.stack {
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-2);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		padding: 4px 6px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.line {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.line input {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: none;
		font-weight: 600;
	}
	.line input:focus {
		border-color: var(--line);
		background: var(--sheet);
		outline: none;
	}
	.count {
		min-width: 28px;
		text-align: right;
		color: var(--ink-muted);
		font-family: var(--font-num);
		font-size: 12px;
		padding-right: 6px;
	}
	li button {
		width: 38px;
		height: 38px;
		flex: none;
		border: none;
		background: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	li button:disabled {
		opacity: 0.3;
	}
	.icon {
		color: var(--accent);
	}
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
		gap: 4px;
		padding: 6px 0 4px;
	}
	.icons button[aria-checked='true'] {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.new {
		display: flex;
		gap: var(--space-2);
	}
	.new input {
		flex: 1;
		min-width: 0;
		height: var(--target);
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.new button {
		height: var(--target);
		padding: 0 16px;
		border-radius: 22px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	.new button:disabled {
		opacity: 0.5;
	}
	.note,
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	li .note {
		padding: 0 8px 4px 48px;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
	}
</style>
