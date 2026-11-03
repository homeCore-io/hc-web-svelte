<!--
	Rooms (D10, A1): the house's rooms, one at a time — its name as typed, its
	icon and place on Home, the devices in it, and merging or deleting it.
	Names, merges and deletes are homeCore's (H1); order and icons are the
	household's presentation, kept by the UI server (M1).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Plus from '@lucide/svelte/icons/plus';
	import { rooms } from '#lib/rooms.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { byRoom } from '#lib/summary.js';
	import { kindLabel } from '#lib/inventory.js';
	import { kindOf } from '#lib/card.js';
	import { addChange, homeRoomOrder, nudge, ref } from '#lib/layers.js';
	import { createRoom, deleteRoom, mergeRoom, renameRoom } from '#lib/admin.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import RoomIcon, { ROOM_ICONS, type RoomIconName } from '#lib/components/RoomIcon.svelte';

	const members = $derived(byRoom(devices.byId, rooms.list));
	const countOf = (id: string) => members.get(id)?.length ?? 0;
	const sorted = $derived([...rooms.list].sort((a, b) => a.name.localeCompare(b.name)));

	// ---- which room ----
	const asked = $derived(page.url.searchParams.get('r'));
	const room = $derived(
		rooms.list.find((r) => r.id === asked) ?? (wide.current ? sorted[0] : undefined)
	);
	const open = (id: string | null) =>
		goto(id ? `?r=${encodeURIComponent(id)}` : '/settings/rooms', {
			replace: wide.current,
			reset: !wide.current
		});
	$effect(() =>
		!wide.current && asked !== null && room
			? heading.show(room.name, { href: '/settings/rooms', label: 'Rooms' })
			: undefined
	);
	$effect(() => {
		// Fresh state for each room.
		void room?.id;
		merging = false;
		draft = null;
		note = null;
		picking = false;
	});

	// ---- Home's order (only rooms with something in them are on Home) ----
	const onHome = $derived(
		homeRoomOrder(
			rooms.list.filter((r) => countOf(r.id) > 0),
			(r) => ref.room(r.id),
			household.changes('home')
		)
	);
	const refs = $derived(onHome.shown.map((r) => ref.room(r.id)));
	const place = $derived(room ? refs.indexOf(ref.room(room.id)) : -1);
	function move(by: -1 | 1) {
		if (!room) return;
		const change = nudge(refs, ref.room(room.id), by);
		if (!change) return;
		void household.change((d) => ({
			...d,
			pages: { ...d.pages, home: addChange(d.pages?.home, change) }
		}));
	}

	// ---- name and icon ----
	let draft = $state<string | null>(null);
	let note = $state<string | null>(null);
	let picking = $state(false);
	async function rename() {
		if (!room || draft === null) return;
		const next = draft.trim();
		if (next === '' || next === room.name) return void (draft = null);
		const err = await renameRoom(room.id, next);
		note = err ?? 'Renamed.';
		if (!err) draft = null;
	}
	function setIcon(icon: RoomIconName) {
		if (!room) return;
		const id = room.id;
		void household.change((d) => ({ ...d, icons: { ...d.icons, [id]: icon } }));
		picking = false;
	}

	// ---- new room ----
	let newName = $state('');
	let newNote = $state<string | null>(null);
	async function add(e: SubmitEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (name === '') return;
		const err = await createRoom(name);
		newNote = err ?? `${name} is ready. Put devices in it from Devices.`;
		if (err === null) {
			newName = '';
			const made = rooms.list.find((r) => r.name === name);
			if (made) void open(made.id);
		}
	}

	// ---- merge ----
	let merging = $state(false);
	let into = $state('');
	const target = $derived(rooms.list.find((r) => r.id === into));
	async function merge() {
		if (!room || !target) return;
		const from = room;
		const err = await mergeRoom(from.id, target.id);
		note = err;
		if (!err || err.startsWith('Merged')) void open(target.id);
	}

	// ---- delete ----
	async function remove() {
		if (!room) return;
		const n = countOf(room.id);
		const yes = await ask({
			title: `Delete ${room.name}?`,
			lost: [
				n === 0
					? 'It has no devices.'
					: `Its ${n === 1 ? 'device ends' : `${n} devices end`} up in no room.`,
				...(room.namedBy === 'bridge'
					? [
							'A plugin named this room, and will make it again on its next report. Merging it into another room stops that.'
						]
					: [])
			],
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const err = await deleteRoom(room.id);
		if (err) return void (note = err);
		void open(null);
	}
</script>

{#if !session.can('areas:write') && !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<ListDetail chosen={asked !== null && room !== undefined} label="Rooms">
		{#snippet list()}
			<form class="new" onsubmit={add}>
				<input
					bind:value={newName}
					placeholder="New room, named as you'd say it"
					aria-label="New room"
				/>
				<button type="submit" disabled={newName.trim() === ''} aria-label="Add room"
					><Plus size={18} aria-hidden="true" /></button
				>
			</form>
			{#if newNote}<p class="note" role="status">{newNote}</p>{/if}
			<ul class="rooms">
				{#each sorted as r (r.id)}
					<li>
						<a
							href={`?r=${encodeURIComponent(r.id)}`}
							aria-current={room?.id === r.id ? 'page' : undefined}
							onclick={(e) => {
								e.preventDefault();
								void open(r.id);
							}}
						>
							<RoomIcon name={household.iconOf(r.id)} size={18} />
							<span class="name">{r.name}</span>
							<span class="count">{countOf(r.id)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/snippet}
		{#snippet detail()}
			{#if room}
				<section class="card">
					<div class="head">
						<button
							type="button"
							class="icon"
							aria-label={`Icon for ${room.name}`}
							aria-expanded={picking}
							onclick={() => (picking = !picking)}
							><RoomIcon name={household.iconOf(room.id)} size={22} /></button
						>
						<input
							class="title"
							value={draft ?? room.name}
							aria-label="Room name"
							oninput={(e) => (draft = e.currentTarget.value)}
							onblur={rename}
							onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
						/>
						<button type="button" class="ghost" onclick={() => ((merging = true), (into = ''))}
							>Merge into another room…</button
						>
						<button type="button" class="danger" onclick={remove}>Delete…</button>
					</div>
					{#if note}<p class="note" role="status">{note}</p>{/if}
					{#if picking}
						<div class="icons" role="radiogroup" aria-label={`Icon for ${room.name}`}>
							{#each Object.entries(ROOM_ICONS) as [key, v] (key)}
								<button
									type="button"
									role="radio"
									aria-checked={(household.iconOf(room.id) ?? 'house') === key}
									aria-label={v.label}
									title={v.label}
									onclick={() => setIcon(key as RoomIconName)}><RoomIcon name={key} /></button
								>
							{/each}
						</div>
					{/if}

					{#if merging}
						<div class="merge" role="group" aria-label="Merge">
							<label>
								<strong>Merge {room.name} into</strong>
								<select bind:value={into}>
									<option value="" disabled>Choose a room…</option>
									{#each sorted.filter((r) => r.id !== room.id) as r (r.id)}
										<option value={r.id}>{r.name}</option>
									{/each}
								</select>
							</label>
							{#if target}
								<ul>
									<li>
										Its {countOf(room.id) === 1
											? 'device moves'
											: `${countOf(room.id)} devices move`} to
										{target.name}, which then has {countOf(room.id) + countOf(target.id)}.
									</li>
									<li>
										A plugin that still says “{room.slug}” puts its devices in {target.name} from now
										on, instead of making {room.name} again.
									</li>
									<li>
										Anything that pointed at {room.name} — its place on Home, a display’s page, someone’s
										phone bar — points at {target.name} instead.
									</li>
								</ul>
							{/if}
							<div class="buttons">
								<button type="button" class="ghost" onclick={() => (merging = false)}>Cancel</button
								>
								<button type="button" class="go" disabled={!target} onclick={merge}
									>{target ? `Merge into ${target.name}` : 'Merge'}</button
								>
							</div>
						</div>
					{/if}

					<p class="facts">
						<span>Short name <code>{room.slug}</code></span>
						<span
							>Also known as: {room.aliases.length ? room.aliases.join(', ') : 'nothing else'}</span
						>
						<span
							>{room.namedBy === 'bridge'
								? 'Named by a plugin'
								: room.namedBy === 'guessed'
									? 'Named by homeCore from a plugin’s short name'
									: 'Named by a person'}</span
						>
					</p>

					{#if place >= 0}
						<div class="order">
							<span>On Home, {place + 1} of {refs.length}</span>
							<button
								type="button"
								aria-label="Earlier on Home"
								disabled={place === 0}
								onclick={() => move(-1)}><ArrowUp size={16} /></button
							>
							<button
								type="button"
								aria-label="Later on Home"
								disabled={place === refs.length - 1}
								onclick={() => move(1)}><ArrowDown size={16} /></button
							>
						</div>
					{:else if countOf(room.id) === 0}
						<p class="quiet">Not on Home: nothing is in it yet.</p>
					{:else}
						<p class="quiet">Hidden on Home. Show it again from Home’s Edit.</p>
					{/if}

					<h3>{countOf(room.id) === 1 ? 'One device' : `${countOf(room.id)} devices`}</h3>
					<ul class="devices">
						{#each (members.get(room.id) ?? []).toSorted( (a, b) => displayName(a).localeCompare(displayName(b)) ) as d (d.device_id)}
							<li>
								<a
									href={`/settings/devices/${encodeURIComponent(d.device_id)}?from=${encodeURIComponent(`room:${room.id}`)}`}
									>{displayName(d)}</a
								>
								<span class="muted">{kindLabel(kindOf(d))}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/snippet}
	</ListDetail>
{/if}

<style>
	.new {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.new input,
	select {
		flex: 1;
		min-width: 0;
		height: 40px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.new button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.new button:disabled {
		opacity: 0.5;
	}
	.rooms {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.rooms li + li {
		border-top: 1px solid var(--line);
	}
	.rooms a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 46px;
		padding: 0 var(--space-3);
		color: var(--ink);
		text-decoration: none;
	}
	.rooms a[aria-current='page'] {
		background: var(--nav-on);
		font-weight: 700;
	}
	.name {
		flex: 1;
	}
	.count {
		color: var(--ink-muted);
		font-family: var(--font-num);
		font-size: 13px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
	}
	.title {
		flex: 1 1 200px;
		min-width: 0;
		height: 44px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid transparent;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 22px;
		font-weight: 700;
	}
	.title:hover,
	.title:focus {
		border-color: var(--line);
		background: var(--bg);
	}
	.ghost,
	.danger,
	.go {
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.danger {
		border-color: var(--alert-line);
		background: none;
		color: var(--alert);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
	.icons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.icons button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.icons button[aria-checked='true'] {
		border-color: var(--accent);
		background: var(--nav-on);
	}
	.merge {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: 12px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		border: 1px solid var(--lit-card-line);
	}
	.merge label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.merge ul {
		margin: 0;
		padding-left: 1.2em;
		color: var(--ink);
		line-height: 1.55;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px var(--space-4);
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	code {
		font-family: var(--font-num);
	}
	.order {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 14px;
	}
	.order span {
		flex: 1;
	}
	.order button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.order button:disabled {
		opacity: 0.4;
	}
	h3 {
		margin: var(--space-2) 0 0;
		font-size: 15px;
	}
	.devices {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.devices li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 8px 0;
		border-top: 1px solid var(--line);
	}
	.devices a {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	.muted,
	.quiet {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.quiet {
		margin: 0;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
</style>
