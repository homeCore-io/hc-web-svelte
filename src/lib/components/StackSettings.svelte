<!--
	A stack's settings (13 §13.2): its name, how it draws its things, its
	width (the card's size), its height and order, and the things in it. A
	sheet beside the page, as Add is, so the stack changes on the page as it's
	set; each change is kept as it's made, in the layer being arranged.

	Things of any kind can go in: this room's first, the whole house by search
	or kind. A thing ticked here leaves its own card, or another stack, so it's
	on the page once.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { deviceOffer, finds, SHELVES, underRooms, type Offer, type Shelf } from '#lib/addCard.js';
	import { devices } from '#lib/devices.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ref as refs, type Form } from '#lib/layers.js';
	import type { Card } from '#lib/page.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { readStack, STACK_BUILT_IN } from '#lib/stack.js';
	import { view } from '#lib/view.svelte.js';

	let {
		page,
		card,
		form,
		others,
		onPage,
		close
	}: {
		page: string;
		card: Card;
		form?: Form;
		/** The page's other stacks: a thing ticked here leaves them. */
		others: { ref: string; name: string }[];
		/** What this page draws as its own card, to say a thing leaves it. */
		onPage: Set<string>;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.show());

	const sheet = $derived(kindOptions.card(page, 'stack', card.ref, STACK_BUILT_IN));
	const now = $derived(readStack({ ...sheet.without, ...sheet.mine } as Record<string, unknown>));
	const who = $derived(
		view.mode(page) === 'edit' ? 'For everyone.' : 'Only you see this, on top of the house’s.'
	);
	function set(next: Record<string, unknown>) {
		sheet.save({ ...sheet.mine, ...next });
	}
	// Read once, when the sheet opens; it changes the size from here.
	let wide = $state(untrack(() => form === 'large'));
	function setWide(w: boolean) {
		wide = w;
		view.change(page, { op: 'form', ref: card.ref, form: w ? 'large' : 'standard' });
	}

	const STYLES = [
		['list', 'List'],
		['pills', 'Pills'],
		['rockers', 'Rockers'],
		['keypad', 'Keypad'],
		['folded', 'Busy first, rest folded']
	] as const;
	const HEIGHTS = [
		['fit', 'Fits its things'],
		['2', 'Two cards'],
		['3', 'Three cards']
	] as const;

	// Everything that can go in: devices but hubs, and homeCore's scenes.
	const room = $derived(page.startsWith('room:') ? page.slice(5) : null);
	const offers = $derived([
		...Object.values(devices.byId)
			.map((d) => deviceOffer(d, rooms.list, refs.device(d.device_id)))
			.filter((o) => o.shelf !== 'hub'),
		...scenes.list.map((s): Offer => ({
			ref: refs.scene(s.id),
			name: s.name,
			shelf: 'scene',
			icon: 'scene',
			what: 'Scene · homeCore',
			room: ''
		}))
	]);
	const byRef = $derived(new Map(offers.map((o) => [o.ref, o])));
	let query = $state('');
	let shelf = $state<Shelf | 'all'>('all');
	const roomName = (id: string) => rooms.list.find((r) => r.id === id)?.name ?? '';
	const found = $derived(
		offers.filter(
			(o) =>
				(shelf === 'all' || o.shelf === shelf) &&
				finds(query, `${o.name} ${roomName(o.room)} ${o.what}`)
		)
	);
	const chips = $derived([
		{ id: 'all' as const, label: 'Everything' },
		...SHELVES.filter(
			(s) => s.id !== 'room' && s.id !== 'hub' && offers.some((o) => o.shelf === s.id)
		)
	]);
	// This room's things first, then each room's, then none.
	const groups = $derived.by(() => {
		const g = underRooms(found, rooms.list);
		const here = g.filter((x) => x.id === room);
		return [...here, ...g.filter((x) => x.id !== room)];
	});

	const otherStacks = $derived(
		others.map((o) => ({
			...o,
			things: readStack(kindOptions.of(page, 'stack', o.ref, STACK_BUILT_IN)).things
		}))
	);
	const where = (r: string): string => {
		if (now.things.includes(r)) return 'In this stack';
		const other = otherStacks.find((o) => o.things.includes(r));
		if (other) return `In ${other.name}: ticking moves it here`;
		return onPage.has(r) ? 'Its own card here: ticking moves it in' : '';
	};

	function tick(r: string) {
		if (now.things.includes(r)) return set({ things: now.things.filter((x) => x !== r) });
		// On the page once: out of any other stack first.
		for (const o of otherStacks)
			if (o.things.includes(r)) {
				const theirs = kindOptions.card(page, 'stack', o.ref, STACK_BUILT_IN);
				theirs.save({ ...theirs.mine, things: o.things.filter((x) => x !== r) });
			}
		set({ things: [...now.things, r] });
	}
	function nudge(i: number, by: -1 | 1) {
		const j = i + by;
		if (j < 0 || j >= now.things.length) return;
		const next = [...now.things];
		[next[i], next[j]] = [next[j]!, next[i]!];
		set({ things: next });
	}
	const nameOf = (r: string) => byRef.get(r)?.name ?? 'Something no longer here';
	const whatOf = (r: string) => {
		const o = byRef.get(r);
		if (!o) return '';
		return o.room && o.room !== room ? `${o.what} · ${roomName(o.room)}` : o.what;
	};
	let draftName = $state('');
	$effect(() => {
		draftName = now.name;
	});
</script>

<dialog
	bind:this={dialog}
	aria-label="Stack settings"
	onclose={close}
	onkeydown={(e) => {
		if (e.key === 'Escape') dialog?.close();
	}}
>
	<div class="box">
		<header>
			<div>
				<h2>{now.name || 'Stack'}</h2>
				<p class="who">{who} Kept as you go.</p>
			</div>
			<button class="done" onclick={() => dialog?.close()}>Done</button>
		</header>

		<div class="scroll">
			<label class="text"
				>Name
				<input
					value={draftName}
					placeholder="Stack"
					oninput={(e) => (draftName = e.currentTarget.value)}
					onchange={(e) => set({ name: e.currentTarget.value.trim() })}
				/>
			</label>

			<fieldset>
				<legend>Style</legend>
				<div class="pills">
					{#each STYLES as [id, name] (id)}
						<button aria-pressed={now.style === id} onclick={() => set({ style: id })}
							>{name}</button
						>
					{/each}
				</div>
			</fieldset>
			<fieldset>
				<legend>Width</legend>
				<div class="pills">
					<button aria-pressed={!wide} onclick={() => setWide(false)}>One card</button>
					<button aria-pressed={wide} onclick={() => setWide(true)}>Two cards</button>
				</div>
			</fieldset>
			<fieldset>
				<legend>Height</legend>
				<div class="pills">
					{#each HEIGHTS as [id, name] (id)}
						<button aria-pressed={now.height === id} onclick={() => set({ height: id })}
							>{name}</button
						>
					{/each}
				</div>
			</fieldset>
			<fieldset>
				<legend>Order</legend>
				<div class="pills">
					<button aria-pressed={!now.busyFirst} onclick={() => set({ order: 'arranged' })}
						>As I put them</button
					>
					<button aria-pressed={now.busyFirst} onclick={() => set({ order: 'busy' })}
						>On or open first</button
					>
				</div>
			</fieldset>

			<section>
				<h3>In this stack · {now.things.length}</h3>
				{#if now.things.length === 0}
					<p class="quiet">Nothing yet. Tick things below.</p>
				{:else}
					<ol class="chosen">
						{#each now.things as r, i (r)}
							<li>
								<span class="names"
									><span class="n">{nameOf(r)}</span><span class="w">{whatOf(r)}</span></span
								>
								<button
									aria-label={`Move ${nameOf(r)} up`}
									disabled={i === 0}
									onclick={() => nudge(i, -1)}><ArrowUp size={16} /></button
								>
								<button
									aria-label={`Move ${nameOf(r)} down`}
									disabled={i === now.things.length - 1}
									onclick={() => nudge(i, 1)}><ArrowDown size={16} /></button
								>
								<button class="out" aria-label={`Take ${nameOf(r)} out`} onclick={() => tick(r)}
									><X size={16} /></button
								>
							</li>
						{/each}
					</ol>
				{/if}
			</section>

			<section>
				<h3>Choose things</h3>
				<input
					class="search"
					type="search"
					bind:value={query}
					placeholder="Search the house"
					aria-label="Search the house"
					autocomplete="off"
					spellcheck="false"
				/>
				<div class="pills" role="group" aria-label="Show">
					{#each chips as c (c.id)}
						<button aria-pressed={shelf === c.id} onclick={() => (shelf = c.id)}>{c.label}</button>
					{/each}
				</div>
				{#each groups as g (g.id)}
					<h4>{g.id === room ? 'This room' : g.name}</h4>
					<ul class="choices">
						{#each g.offers as o (o.ref)}
							{@const on = now.things.includes(o.ref)}
							<li>
								<button class="choice" aria-pressed={on} onclick={() => tick(o.ref)}>
									<span class="tick" aria-hidden="true">{on ? '✓' : ''}</span>
									<span class="names"
										><span class="n">{o.name}</span>{#if where(o.ref)}<span
												class="w"
												class:moves={!on}>{where(o.ref)}</span
											>{/if}</span
									>
									<span class="what">{o.what}</span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="quiet">Nothing matches.</p>
				{/each}
			</section>
		</div>
	</div>
</dialog>

<style>
	dialog {
		position: fixed;
		inset: auto 0 0 0;
		z-index: 40;
		margin: 0;
		padding: 0;
		width: 100%;
		max-width: none;
		height: 60dvh;
		border: none;
		border-top: 1px solid var(--line);
		border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.25);
	}
	@media (min-width: 900px) {
		dialog {
			inset: 0 0 0 auto;
			width: 420px;
			height: 100dvh;
			max-height: none;
			border-top: none;
			border-left: 1px solid var(--line);
			border-radius: 0;
			box-shadow: -12px 0 40px rgba(0, 0, 0, 0.2);
		}
	}
	.box {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding: 14px 14px 8px 18px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.who {
		margin: 2px 0 0;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.done {
		height: 36px;
		padding: 0 16px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 6px 18px 24px;
	}
	.text,
	legend,
	h3 {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	input {
		height: 40px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		letter-spacing: normal;
		text-transform: none;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	legend {
		padding: 0 0 6px;
	}
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pills button {
		min-height: 34px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.pills button[aria-pressed='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, var(--surface));
		color: var(--accent);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	h3,
	h4 {
		margin: 0;
	}
	h4 {
		margin-top: 6px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	ol,
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.chosen {
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
	}
	.chosen li {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 6px 4px 12px;
		border-bottom: 1px solid var(--line);
	}
	.chosen li:last-child {
		border-bottom: none;
	}
	.chosen button {
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--ink);
	}
	.chosen button:disabled {
		opacity: 0.35;
	}
	.chosen .out {
		color: var(--alert);
	}
	.names {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.n {
		font-size: 13.5px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.w {
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.w.moves {
		color: var(--accent);
	}
	.choice {
		width: 100%;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 8px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.choice[aria-pressed='true'] {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.tick {
		width: 20px;
		height: 20px;
		flex: none;
		display: grid;
		place-items: center;
		border: 1.5px solid var(--line);
		border-radius: 5px;
		font-size: 13px;
		font-weight: 800;
		color: var(--accent-ink);
	}
	.choice[aria-pressed='true'] .tick {
		border-color: var(--accent);
		background: var(--accent);
	}
	.what {
		flex: none;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
</style>
