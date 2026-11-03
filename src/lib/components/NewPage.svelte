<!--
	New page (G27–G29): a name, what it starts from — nothing, a copy of Home
	or of a room as they look now — and who sees it. The house's pages are
	only offered to people who may edit them; anyone can make their own. An
	empty page opens ready to add to.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import X from '@lucide/svelte/icons/x';
	import { newId } from '#lib/layers.js';
	import { homePage, roomPage } from '#lib/page.js';
	import { copyOf, mayMake, withPage, type Whose } from '#lib/built.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { added } from '#lib/layers.js';

	let { close }: { close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());

	const canEdit = $derived(session.can('content:write'));
	let name = $state('');
	let from = $state<'blank' | 'home' | 'room'>('blank');
	let room = $state(rooms.list[0]?.id ?? '');
	let whose = $state<Whose>('mine');

	// A copy names plugins' cards by their refs; their labels aren't needed to copy them.
	const pluginCard = () => undefined;

	/**
	 * What a copy starts with (G29): the page as its maker sees it — for the
	 * house's, the shared page (the household's changes alone); for their own,
	 * with their changes and favourites too.
	 */
	function copy(): ReturnType<typeof copyOf> {
		if (from === 'blank') return [];
		const key = from === 'home' ? 'home' : `room:${room}`;
		const house = household.changes(key);
		const mine = whose === 'house' ? [] : personal.changes(key);
		const all = [...house, ...mine];
		const page =
			from === 'home'
				? homePage({
						devices: devices.byId,
						rooms: rooms.list,
						scenes: scenes.list,
						favourites: whose === 'house' ? [] : (personal.doc.favourites ?? []),
						added: [...new Set([...added(house), ...added(mine)])],
						pluginCard,
						alerts: 0,
						chips: [],
						mode: null
					})
				: roomPage(room, {
						devices: devices.byId,
						rooms: rooms.list,
						added: [...new Set([...added(house), ...added(mine)])],
						pluginCard,
						now: clock.now
					});
		return copyOf(page, all, mine);
	}

	async function make() {
		const title = name.trim();
		if (!title || !mayMake(whose, canEdit)) return;
		const id = newId();
		const changes = copy();
		const made = { id, name: title };
		if (whose === 'house') void household.change((d) => withPage(d, made, changes));
		else void personal.change((d) => withPage(d, made, changes));
		dialog?.close();
		// An empty page opens ready to add to: Edit for the house's, Customise for one's own.
		const empty = changes.length === 0;
		await goto(`/pages/${id}${!empty ? '' : whose === 'house' ? '?edit=1' : '?customise=1'}`);
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="new-page-h"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<form
		class="box"
		onsubmit={(e) => {
			e.preventDefault();
			void make();
		}}
	>
		<header>
			<h2 id="new-page-h">New page</h2>
			<button type="button" class="x" aria-label="Close" onclick={() => dialog?.close()}
				><X size={20} /></button
			>
		</header>
		<label class="field"
			>Name
			<!-- svelte-ignore a11y_autofocus -->
			<input bind:value={name} placeholder="Garden" autofocus autocomplete="off" />
		</label>
		<fieldset>
			<legend>Start from</legend>
			<div class="choices" role="radiogroup" aria-label="Start from">
				{#each [{ id: 'blank', what: 'Empty', sub: 'Add what you like to it.' }, { id: 'home', what: 'A copy of Home', sub: 'Its sections and cards as they are now.' }, ...(rooms.list.length > 0 ? [{ id: 'room', what: 'A copy of a room', sub: 'The room’s page as it is now.' }] : [])] as o (o.id)}
					<button
						type="button"
						role="radio"
						aria-checked={from === o.id}
						onclick={() => (from = o.id as typeof from)}
					>
						<span class="dot" aria-hidden="true"></span>
						<span class="what"><b>{o.what}</b><small>{o.sub}</small></span>
					</button>
				{/each}
			</div>
			{#if from === 'room'}
				<select class="room" bind:value={room} aria-label="Which room">
					{#each rooms.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
				</select>
			{/if}
		</fieldset>
		{#if canEdit}
			<fieldset>
				<legend>Who sees it</legend>
				<div class="seg" role="radiogroup" aria-label="Who sees it">
					{#each [{ id: 'house', label: 'Everyone in the house' }, { id: 'mine', label: 'Just me' }] as o (o.id)}
						<button
							type="button"
							role="radio"
							aria-checked={whose === o.id}
							onclick={() => (whose = o.id as Whose)}>{o.label}</button
						>
					{/each}
				</div>
			</fieldset>
		{/if}
		<p class="who">
			{whose === 'house'
				? 'Changed in Edit, by people who edit the house’s pages.'
				: 'Only you see it; you change it with Edit › Just for me.'}
			{from === 'blank'
				? ''
				: 'A copy is yours to change: it doesn’t follow the original afterwards, so a new device won’t appear in it by itself.'}
		</p>
		<button type="submit" class="make" disabled={!name.trim()}>Make the page</button>
	</form>
</dialog>

<style>
	dialog {
		margin: 10vh auto auto;
		padding: 0;
		width: min(460px, calc(100vw - 24px));
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
		gap: 16px;
		padding: 16px 18px 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.x {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink-muted);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	input,
	select {
		height: 42px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 400;
	}
	.room {
		margin-top: 6px;
		width: 100%;
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.choices button {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: 12px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.choices button[aria-checked='true'] {
		border-color: var(--accent);
		background: var(--surface);
	}
	.dot {
		flex: none;
		width: 18px;
		height: 18px;
		box-sizing: border-box;
		border-radius: 50%;
		border: 2px solid var(--line);
		background: var(--surface);
	}
	.choices button[aria-checked='true'] .dot {
		border: 5px solid var(--accent);
	}
	.what {
		display: flex;
		flex-direction: column;
	}
	.what b {
		font-size: 14px;
		font-weight: 600;
	}
	small {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.seg {
		display: flex;
		padding: 3px;
		border-radius: 999px;
		background: var(--surface-2);
	}
	.seg button {
		flex: 1;
		height: 38px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.who {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.make {
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.make:disabled {
		opacity: 0.5;
	}
</style>
