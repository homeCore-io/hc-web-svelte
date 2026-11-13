<!--
	A page's own sheet (G27–G31): who sees it; "In my phone bar", with the bar
	as it would be; the displays showing it, for an admin, and a display put
	on or taken off — first, where it rests; and, for whoever may change the
	page, its name, its symbol and removing it, with a question first.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import X from '@lucide/svelte/icons/x';
	import { BAR_SIZE, barOf } from '#lib/layers.js';
	import {
		displayPages,
		mayChange,
		pageKeyOf,
		withoutPage,
		withPageInBar,
		withPageNamed,
		withPageOnDisplay,
		type Listed
	} from '#lib/built.js';
	import { tabsFor, type DisplayDoc } from '#lib/display.js';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import RoomIcon, { ROOM_ICONS } from './RoomIcon.svelte';

	let { p, close }: { p: Listed; close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());

	const key = $derived(pageKeyOf(p.id));
	const house = $derived(p.whose === 'house');
	const canChange = $derived(mayChange(p, session.can('content:write')));
	/** Its name or symbol, in whichever document holds it. */
	const named = (set: { name?: string; icon?: string }) =>
		house
			? household.change((d) => withPageNamed(d, p.id, set))
			: personal.change((d) => withPageNamed(d, p.id, set));

	// ---- its name and symbol ----
	let name = $state(untrack(() => p.name));
	function rename() {
		const next = name.trim();
		if (next && next !== p.name) void named({ name: next });
	}

	// ---- the phone bar (G30): the person's own ----
	const ids = $derived(rooms.list.map((r) => r.id));
	const bar = $derived(barOf(personal.doc, ids, household.doc));
	const inBar = $derived(bar.includes(key));
	function toggleBar() {
		// Decided now: the change is made again when it's saved, after this screen shows it.
		const on = !inBar;
		void personal.change((d) => ({
			...d,
			bar: withPageInBar(barOf(d, ids, household.doc), p.id, on, BAR_SIZE)
		}));
	}
	const NAMES: Record<string, string> = {
		home: 'Home',
		pages: 'Pages',
		scenes: 'Scenes',
		alerts: 'Alerts',
		search: 'Search'
	};
	const labelOf = (d: string) =>
		d === key
			? p.name
			: d.startsWith('room:')
				? (rooms.list.find((r) => `room:${r.id}` === d)?.name ?? 'Room')
				: d.startsWith('page:')
					? ([...(household.doc.built ?? []), ...(personal.doc.built ?? [])].find(
							(x) => pageKeyOf(x.id) === d
						)?.name ?? 'Page')
					: (NAMES[d] ?? d);

	// ---- displays (G31): the house's pages, for an admin ----
	interface Display {
		id: string;
		name: string;
		revoked: boolean;
		doc: DisplayDoc;
	}
	let displays = $state<Display[] | null>(null);
	let trouble = $state<string | null>(null);
	onMount(() => {
		if (house && session.isAdmin) void loadDisplays();
	});
	async function loadDisplays() {
		const res = await fetch('/api/v1/displays').catch(() => null);
		if (!res?.ok) {
			// Said under the list, in place of looking for them.
			trouble = 'homeCore didn’t list its displays.';
			return;
		}
		const list = ((await res.json()) as Omit<Display, 'doc'>[]).filter((d) => !d.revoked);
		displays = await Promise.all(
			list.map(async (d) => {
				const got = await fetch(`/ui/displays/${d.id}`).catch(() => null);
				return { ...d, doc: got?.ok ? ((await got.json()) as DisplayDoc) : { version: 0 } };
			})
		);
	}
	const pagesOf = (d: Display) =>
		tabsFor(d.doc, rooms.list, displayPages(household.doc)).map((t) => t.key);
	async function toggleDisplay(d: Display, tries = 0): Promise<void> {
		const on = !pagesOf(d).includes(key);
		const next = { ...d.doc, pages: withPageOnDisplay(pagesOf(d), p.id, on) };
		const res = await fetch(`/ui/displays/${d.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(next)
		}).catch(() => null);
		if (res?.status === 409 && tries < 2) {
			const { current } = (await res.json()) as { current: DisplayDoc };
			d.doc = current;
			return toggleDisplay(d, tries + 1);
		}
		if (res?.ok) d.doc = (await res.json()) as DisplayDoc;
		else trouble = 'Couldn’t save that.';
	}

	// ---- removing it ----
	async function remove() {
		const yes = await ask({
			title: `Remove ${p.name}?`,
			body: house
				? 'It’s gone for everyone, with what’s on it. Displays showing it skip it.'
				: 'It’s gone, with what’s on it.',
			go: 'Remove',
			danger: true
		});
		if (!yes) return;
		dialog?.close();
		await goto('/pages');
		if (house) void household.change((d) => withoutPage(d, p.id));
		else void personal.change((d) => withoutPage(d, p.id));
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="page-about-h"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<h2 id="page-about-h">{p.name}</h2>
			<button type="button" class="x" aria-label="Close" onclick={() => dialog?.close()}
				><X size={20} /></button
			>
		</header>

		<section>
			<h3>Who sees it</h3>
			<p>
				{house
					? 'Everyone in the house. Each person can still hide or move things on it for themselves, as on Home.'
					: 'Just you. Nobody else sees it, or knows it’s there.'}
			</p>
		</section>

		{#if canChange}
			<section>
				<label class="field"
					>Name
					<input bind:value={name} onchange={rename} autocomplete="off" />
				</label>
				<div class="icons" role="radiogroup" aria-label="Symbol">
					{#each Object.entries(ROOM_ICONS) as [k, v] (k)}
						<button
							type="button"
							role="radio"
							aria-checked={(p.icon ?? '') === k}
							aria-label={v.label}
							title={v.label}
							onclick={() => named({ icon: k })}><RoomIcon name={k} size={18} /></button
						>
					{/each}
				</div>
			</section>
		{/if}

		{#if !session.isDisplay}
			<section>
				<div class="row">
					<span class="text"
						><b>In my phone bar</b><small>One tap from anywhere, instead of through Pages.</small
						></span
					>
					<button
						type="button"
						class="switch"
						role="switch"
						aria-checked={inBar}
						aria-label="In my phone bar"
						onclick={toggleBar}><span></span></button
					>
				</div>
				<ol class="bar" aria-label="Your phone bar">
					{#each [...bar, 'more'] as d (d)}
						<li class:here={d === key}>
							{#if d === key && p.icon}<RoomIcon name={p.icon} size={16} />{/if}{d === 'more'
								? 'More'
								: labelOf(d)}
						</li>
					{/each}
				</ol>
				<small
					>{inBar
						? 'Your bar only — set on Me. Pages is still in More.'
						: 'Your bar only — set on Me. The house’s default bar is in Settings.'}</small
				>
			</section>
		{/if}

		<section>
			<h3>On displays</h3>
			{#if !house}
				<p>
					Only the house’s pages go on displays — a display isn’t a person, so it can’t show a page
					that’s just yours.
				</p>
			{:else if !session.isAdmin}
				<p>An admin puts the house’s pages on displays, in Settings → Displays.</p>
			{:else if displays === null}
				{#if !trouble}<p>Looking for displays…</p>{/if}
			{:else if displays.length === 0}
				<p>No displays yet. A kitchen panel or hall tablet is set up in Settings → Displays.</p>
			{:else}
				<p>Put on a display, it’s where the display rests; its other pages are tabs.</p>
				{#each displays as d (d.id)}
					{@const on = pagesOf(d).includes(key)}
					<div class="row">
						<span class="text"
							><b>{d.name}</b><small
								>{tabsFor(d.doc, rooms.list, displayPages(household.doc))
									.map((t) => t.label)
									.join(' · ')}</small
							></span
						>
						<button
							type="button"
							class="switch"
							role="switch"
							aria-checked={on}
							aria-label={`On ${d.name}`}
							onclick={() => toggleDisplay(d)}><span></span></button
						>
					</div>
				{/each}
			{/if}
			{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
		</section>

		{#if canChange}
			<button type="button" class="remove" onclick={remove}>Remove this page</button>
		{/if}
	</div>
</dialog>

<style>
	dialog {
		margin: 8vh auto auto;
		padding: 0;
		width: min(470px, calc(100vw - 24px));
		max-height: 84vh;
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
		gap: 20px;
		padding: 16px 18px 22px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
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
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	h3 {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	p {
		margin: 0;
		font-size: 14px;
	}
	small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	input {
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
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
		gap: 6px;
	}
	.icons button {
		height: 44px;
		border: 1px solid var(--card-line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink-muted);
		display: grid;
		place-items: center;
	}
	.icons button[aria-checked='true'] {
		border: 2px solid var(--accent);
		color: var(--ink);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.text b {
		font-size: 14px;
		font-weight: 600;
	}
	.switch {
		flex: none;
		position: relative;
		width: 48px;
		height: 28px;
		border: none;
		border-radius: 999px;
		background: var(--track-off, var(--line));
	}
	.switch span {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 20px;
		height: 20px;
		border-radius: 999px;
		background: #fff;
		transition: left 0.15s;
	}
	.switch[aria-checked='true'] {
		background: var(--accent);
	}
	.switch[aria-checked='true'] span {
		left: 24px;
	}
	.bar {
		display: flex;
		justify-content: space-around;
		gap: 4px;
		margin: 0;
		padding: 10px 6px;
		list-style: none;
		border-radius: 16px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.bar li {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar li.here {
		color: var(--accent);
	}
	.trouble {
		color: var(--alert);
		font-size: 13px;
	}
	.remove {
		align-self: flex-start;
		height: 44px;
		padding: 0 16px;
		border: 1px solid var(--alert);
		border-radius: 999px;
		background: none;
		color: var(--alert);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
	}
</style>
