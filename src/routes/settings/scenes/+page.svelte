<!--
	Scenes (A1): every scene in the house as an admin's list, the way Devices
	lists devices (sceneList.ts). homeCore's own scenes (a set of devices and
	what to set each to) and the ones plugins bring (a Lutron button, a Hue
	room's scene), each saying who provides it and how it is now, where it can
	tell. A Hue scene in several rooms is one row that opens to each room's
	copy.

	The star puts a scene on Home's scenes row for the house (homeScenes.ts),
	for people who may change the house's content. Several at once: on Home or
	off it, or to a room (a plugin's scene; homeCore's have no room). A
	homeCore scene opens its editor, a plugin's its device page.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Star from '@lucide/svelte/icons/star';
	import X from '@lucide/svelte/icons/x';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ScenesTransfer from '#lib/components/admin/ScenesTransfer.svelte';
	import { scenes } from '#lib/scenes.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { moveDevices } from '#lib/deviceAdmin.js';
	import { withHomeScenes } from '#lib/homeScenes.js';
	import {
		lastRunText,
		providers,
		sceneCounts,
		sceneRows,
		shownScenes,
		sortScenes,
		withRefs,
		type Chip,
		type SceneRow,
		type SortKey
	} from '#lib/sceneList.js';

	// The filters and the sort live in the address, so Back returns to the same list.
	const params = $derived(page.url.searchParams);
	const chip = $derived((params.get('show') as Chip | null) ?? 'all');
	const from = $derived(params.get('from') ?? '');
	const sort = $derived((params.get('sort') as SortKey | null) ?? 'name');
	const desc = $derived(params.has('desc'));
	let query = $state(page.url.searchParams.get('q') ?? '');
	function set(changes: Record<string, string | null>) {
		const next = new URL(page.url.href);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === '') next.searchParams.delete(key);
			else next.searchParams.set(key, value);
		}
		void goto(`${next.pathname}${next.search}`, { replace: true, reset: false });
	}

	const homeRefs = $derived(household.doc.home?.scenes ?? []);
	const rows = $derived(sceneRows(devices.byId, scenes.list, rooms.list, homeRefs));
	const shape = $derived({ from, query });
	const shown = $derived(sortScenes(shownScenes(rows, { ...shape, chip }), sort, desc));
	const tally = $derived(sceneCounts(rows, shape));
	const byFrom = $derived(providers(rows));
	const roomNames = $derived([...rooms.list].sort((a, b) => a.name.localeCompare(b.name)));

	const CHIPS: { id: Chip; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'home', label: 'On Home' },
		{ id: 'active', label: 'Active' },
		{ id: 'noroom', label: 'No room' }
	];
	const COLUMNS: { id: SortKey; label: string }[] = [
		{ id: 'name', label: 'Name' },
		{ id: 'room', label: 'Room' },
		{ id: 'from', label: 'From' },
		{ id: 'now', label: 'Now' },
		{ id: 'run', label: 'Last run' },
		{ id: 'home', label: 'On Home' }
	];
	const sortBy = (k: SortKey) =>
		set({ sort: k === 'name' ? null : k, desc: k === sort && !desc ? '1' : null });

	// ---- the house's Home row: the stars ----
	const mayHouse = $derived(session.can('content:write'));
	const mayMove = $derived(session.can('devices:write'));
	const starWhy =
		'Choosing Home’s scenes for everyone needs permission to change the house’s content';
	const putOnHome = (refs: string[], on: boolean) =>
		household.change((d) => withHomeScenes(d, withRefs(d.home?.scenes ?? [], refs, on)));

	// ---- a Hue scene's rooms, opened ----
	let open = $state<Record<string, boolean>>({});
	const flip = (key: string) => (open = { ...open, [key]: !open[key] });

	// ---- several at once, by ref; a Hue scene's row picks every copy ----
	let picked = $state<Record<string, boolean>>({});
	const present = $derived(new Set(rows.flatMap((r) => r.refs)));
	const selected = $derived(Object.keys(picked).filter((r) => picked[r] && present.has(r)));
	const allPicked = (r: SceneRow) => r.refs.every((x) => picked[x]);
	const somePicked = (r: SceneRow) => r.refs.some((x) => picked[x]);
	const pick = (refs: string[], on: boolean) => {
		const next = { ...picked };
		for (const r of refs) next[r] = on;
		picked = next;
	};
	const allOn = $derived(shown.length > 0 && shown.every(allPicked));
	let busy = $state(false);
	let note = $state<string | null>(null);
	const scenesWord = (n: number) => (n === 1 ? 'One scene' : `${n} scenes`);

	async function bulkHome(on: boolean) {
		const n = selected.length;
		await putOnHome(selected, on);
		note = `${scenesWord(n)} ${on ? 'now on Home' : 'taken off Home'}.`;
		picked = {};
	}

	async function moveTo(roomId: string) {
		const room = rooms.list.find((r) => r.id === roomId) ?? null;
		const ids = selected.filter((r) => r.startsWith('device:')).map((r) => r.slice(7));
		const skipped = selected.length - ids.length;
		const skip =
			skipped > 0
				? ` ${skipped === 1 ? 'One homeCore scene was' : `${skipped} homeCore scenes were`} left as they are: homeCore’s own scenes have no room.`
				: '';
		if (ids.length === 0) return void (note = skip.trim());
		busy = true;
		const err = await moveDevices(ids, room?.name ?? null);
		busy = false;
		note = err ?? `${scenesWord(ids.length)} moved to ${room?.name ?? 'no room'}.${skip}`;
		if (!err) picked = {};
	}
</script>

{#snippet star(r: SceneRow)}
	<button
		type="button"
		class="star"
		class:on={r.onHome}
		aria-pressed={r.onHome}
		disabled={!mayHouse}
		title={mayHouse ? undefined : starWhy}
		aria-label={`${r.name}${r.copies || !r.room ? '' : `, ${r.room.name}`} on Home`}
		onclick={() => void putOnHome(r.refs, !r.onHome)}
		><Star size={17} fill={r.onHome ? 'currentColor' : 'none'} aria-hidden="true" /></button
	>
{/snippet}

{#snippet copyCount(r: SceneRow)}
	{@const n = r.copies?.filter((c) => c.onHome).length ?? 0}
	<span class="muted">{n > 0 ? `${n} of ${r.copies?.length}` : ''}</span>
{/snippet}

{#snippet nowCell(r: SceneRow)}
	{#if r.active}<span class="act">Active</span>{:else}<span class="muted">{r.now}</span>{/if}
{/snippet}

{#if !session.can('scenes:write')}
	<p class="quiet">Scenes are for people who may change the house.</p>
{:else}
	<div class="page">
		<div class="tools">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					onchange={() => set({ q: query.trim() })}
					placeholder="Name, room or what provides it"
					aria-label="Find a scene"
				/>
			</label>
			<div class="chips" role="group" aria-label="Show">
				{#each CHIPS as c (c.id)}
					<button
						type="button"
						aria-pressed={chip === c.id}
						onclick={() => set({ show: c.id === 'all' ? null : c.id })}
						>{c.label} <span class="n">{tally[c.id]}</span></button
					>
				{/each}
			</div>
			<label class="from"
				>From
				<select value={from} onchange={(e) => set({ from: e.currentTarget.value })}>
					<option value="">Any</option>
					{#each byFrom as p (p.id)}<option value={p.id}>{p.label} · {p.count}</option>{/each}
				</select>
			</label>
			<a class="new" href="/settings/scenes/new"><Plus size={16} aria-hidden="true" />New scene</a>
		</div>

		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if !devices.loaded}
			<p class="quiet">Loading scenes…</p>
		{:else if rows.length === 0}
			<p class="empty">
				The house has no scenes yet. A scene sets several devices at once (Movie night, Bedtime) and
				can be run from Scenes or by a rule.
			</p>
		{:else if shown.length === 0}
			<p class="quiet">
				No scene matches{query.trim() ? ` “${query.trim()}”` : ' this filter'}.
				<button
					type="button"
					class="clear"
					onclick={() => {
						query = '';
						set({ q: null, show: null, from: null });
					}}>Show them all</button
				>
			</p>
		{:else if wide.current}
			<div class="tablewrap">
				<table aria-label="Scenes">
					<thead>
						<tr>
							<th class="cb"
								><input
									type="checkbox"
									aria-label="Select all shown"
									checked={allOn}
									onchange={() =>
										pick(
											shown.flatMap((r) => r.refs),
											!allOn
										)}
								/></th
							>
							{#each COLUMNS as c (c.id)}
								<th aria-sort={sort === c.id ? (desc ? 'descending' : 'ascending') : undefined}
									><button type="button" class="sort" onclick={() => sortBy(c.id)}
										>{c.label}{#if sort === c.id}<span aria-hidden="true">{desc ? ' ▼' : ' ▲'}</span
											>{/if}</button
									></th
								>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each shown as r (r.key)}
							<tr class:on={somePicked(r)}>
								<td class="cb"
									><input
										type="checkbox"
										aria-label={`Select ${r.name}${r.copies ? `, all ${r.copies.length} rooms` : ''}`}
										checked={allPicked(r)}
										indeterminate={!allPicked(r) && somePicked(r)}
										onchange={() => pick(r.refs, !allPicked(r))}
									/></td
								>
								<td class="name">
									{#if r.copies}
										<button
											type="button"
											class="disc"
											aria-expanded={!!open[r.key]}
											onclick={() => flip(r.key)}
											>{#if open[r.key]}<ChevronDown
													size={16}
													aria-hidden="true"
												/>{:else}<ChevronRight size={16} aria-hidden="true" />{/if}{r.name}</button
										>
									{:else}
										<a href={r.href}>{r.name}</a>
									{/if}
								</td>
								<td class:none={r.noRoom && !r.copies}>{r.roomText}</td>
								<td class="fromcell"
									><b>{r.from}</b>{#if r.detail}<span>{r.detail}</span>{/if}</td
								>
								<td>{@render nowCell(r)}</td>
								<td class="muted">{lastRunText(r.lastRun, clock.now)}</td>
								<td
									>{#if r.copies}{@render copyCount(r)}{:else}{@render star(r)}{/if}</td
								>
							</tr>
							{#if r.copies && open[r.key]}
								{#each r.copies as c (c.key)}
									<tr class="copy" class:on={!!picked[c.key]}>
										<td class="cb"
											><input
												type="checkbox"
												aria-label={`Select ${c.name}, ${c.roomText}`}
												checked={!!picked[c.key]}
												onchange={() => pick([c.key], !picked[c.key])}
											/></td
										>
										<td class="name"><a href={c.href}>{c.name}</a></td>
										<td class:none={c.noRoom}>{c.roomText}</td>
										<td class="fromcell"
											><b>{c.from}</b>{#if c.detail}<span>{c.detail}</span>{/if}</td
										>
										<td>{@render nowCell(c)}</td>
										<td class="muted">{lastRunText(c.lastRun, clock.now)}</td>
										<td>{@render star(c)}</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<ul class="list">
				{#each shown as r (r.key)}
					<li>
						{#if r.copies}
							<button
								type="button"
								class="open"
								aria-expanded={!!open[r.key]}
								onclick={() => flip(r.key)}
							>
								<span class="text">
									<span class="nm">{r.name}</span>
									<span class="sub"
										>{r.roomText} · {r.from}{r.active ? ' · ' : ''}{#if r.active}<span class="act"
												>Active</span
											>{/if}</span
									>
								</span>
								{#if open[r.key]}<ChevronDown size={18} aria-hidden="true" />{:else}<ChevronRight
										size={18}
										aria-hidden="true"
									/>{/if}
							</button>
						{:else}
							<a href={r.href}>
								<span class="text">
									<span class="nm">{r.name}</span>
									<span class="sub"
										>{r.roomText} · {r.from}{r.detail ? ` · ${r.detail}` : ''}{r.active
											? ' · '
											: ''}{#if r.active}<span class="act">Active</span>{/if}</span
									>
								</span>
							</a>
							{@render star(r)}
						{/if}
					</li>
					{#if r.copies && open[r.key]}
						{#each r.copies as c (c.key)}
							<li class="copy">
								<a href={c.href}>
									<span class="text">
										<span class="nm">{c.roomText}</span>
										<span class="sub"
											>{c.detail || c.from}{c.active ? ' · ' : ''}{#if c.active}<span class="act"
													>Active</span
												>{/if}</span
										>
									</span>
								</a>
								{@render star(c)}
							</li>
						{/each}
					{/if}
				{/each}
			</ul>
		{/if}
		{#if shown.length > 0}
			<p class="quiet">
				{shown.length} of {tally.all} shown.{mayHouse
					? ''
					: ' Choosing which go on Home for everyone is for people who may change the house’s content.'}
			</p>
		{/if}

		<ScenesTransfer onadded={() => void scenes.load()} />
	</div>

	{#if selected.length > 0}
		<div class="bulk" role="region" aria-label="Selected scenes">
			<strong>{selected.length} selected</strong>
			{#if mayHouse}
				<button type="button" disabled={busy} onclick={() => bulkHome(true)}>Show on Home</button>
				<button type="button" disabled={busy} onclick={() => bulkHome(false)}>Take off Home</button>
			{/if}
			{#if mayMove}
				<label
					>Move to
					<select
						disabled={busy}
						value=""
						onchange={(e) => {
							const v = e.currentTarget.value;
							e.currentTarget.value = '';
							if (v !== '') void moveTo(v === '-' ? '' : v);
						}}
					>
						<option value="">Choose a room…</option>
						{#each roomNames as room (room.id)}<option value={room.id}>{room.name}</option>{/each}
						<option value="-">No room</option>
					</select>
				</label>
			{/if}
			<button type="button" class="clear" aria-label="Clear selection" onclick={() => (picked = {})}
				><X size={18} aria-hidden="true" /></button
			>
		</div>
	{/if}
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 260px;
		max-width: 420px;
		height: 42px;
		padding: 0 var(--space-3);
		border-radius: 21px;
		background: var(--surface);
		border: 1px solid var(--line);
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
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	@media (max-width: 599px) {
		.chips {
			flex-wrap: nowrap;
			overflow-x: auto;
			width: 100%;
			scrollbar-width: none;
		}
		.chips button {
			flex: none;
		}
	}
	.chips button {
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.chips button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.n {
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
	}
	.from {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	select {
		height: 34px;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.new {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		text-decoration: none;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.quiet,
	.muted {
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
	}
	.quiet .clear {
		margin-left: 6px;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 600;
	}
	.empty {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
		line-height: 1.5;
	}

	/* ---- the table ---- */
	.tablewrap {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		font-size: 14px;
	}
	th,
	td {
		padding: 6px var(--space-3);
		text-align: left;
		vertical-align: middle;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	tr + tr td,
	tbody tr:first-child td {
		border-top: 1px solid var(--line);
	}
	th {
		height: 40px;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	th.cb,
	td.cb {
		width: 36px;
		padding-right: 0;
	}
	th:nth-child(2) {
		width: 24%;
	}
	th:nth-child(4) {
		width: 22%;
	}
	th:nth-child(5),
	th:nth-child(7) {
		width: 92px;
	}
	.sort {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		cursor: pointer;
	}
	.sort:hover {
		color: var(--ink);
	}
	td {
		height: 44px;
	}
	tr.on td {
		background: var(--nav-on);
	}
	.name a,
	.disc {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	.name a:hover {
		text-decoration: underline;
	}
	.disc {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		margin-left: -4px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.disc :global(svg) {
		flex: none;
		color: var(--ink-muted);
	}
	tr.copy td {
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}
	tr.copy.on td {
		background: var(--nav-on);
	}
	tr.copy .name {
		padding-left: 36px;
	}
	tr.copy .name a {
		font-weight: 500;
	}
	.none {
		color: var(--ink-muted);
		font-style: italic;
	}
	.fromcell b {
		display: block;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fromcell span {
		display: block;
		font-size: 12px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--lit-ink);
		font-weight: 600;
	}
	.act::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}
	.star {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		margin-left: -8px;
		border: 0;
		border-radius: 18px;
		background: none;
		color: var(--ink-muted);
	}
	.star.on {
		color: var(--accent);
	}
	.star:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.star:disabled {
		opacity: 0.45;
	}

	/* ---- the phone's list ---- */
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li {
		display: flex;
		align-items: center;
		padding-right: var(--space-2);
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list li.copy {
		padding-left: var(--space-4);
		background: color-mix(in srgb, var(--ink) 3%, transparent);
	}
	.list a,
	.list .open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 58px;
		padding: 6px var(--space-2) 6px var(--space-4);
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
	}
	.list .open :global(svg) {
		flex: none;
		color: var(--ink-muted);
	}
	.list .star {
		margin-left: 0;
		width: 44px;
		height: 44px;
		border-radius: 22px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.nm {
		font-weight: 600;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ---- several at once ---- */
	.bulk {
		position: sticky;
		bottom: calc(72px + env(safe-area-inset-bottom));
		z-index: 3;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--bg);
		box-shadow: var(--shadow);
	}
	@media (min-width: 700px) and (orientation: landscape), (min-width: 1100px) {
		.bulk {
			bottom: var(--space-4);
		}
	}
	.bulk strong {
		flex: 1;
	}
	.bulk label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.bulk > button:not(.clear) {
		height: 38px;
		padding: 0 16px;
		border-radius: 19px;
		border: none;
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.bulk .clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 19px;
		border: 1px solid color-mix(in srgb, var(--bg) 40%, transparent);
		background: none;
		color: var(--bg);
	}
</style>
