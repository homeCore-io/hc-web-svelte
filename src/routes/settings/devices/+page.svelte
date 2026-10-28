<!--
	Devices (A1): every device the house has, as an admin's list — what's
	wrong first (no room, battery low, offline), by plugin, and several at
	once: move them to a room, or delete them. Each opens its own page.
-->
<script lang="ts">
	import { fullDateOf } from '#lib/when.js';
	import { onMount } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import { live } from '#lib/live.svelte.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { counts, pluginLabel, plugins, rowsOf, shownRows, type Filter } from '#lib/inventory.js';
	import { deleteDevices, moveDevices } from '#lib/deviceAdmin.js';

	// The filter lives in the address, so Back returns to the same list.
	const params = $derived(page.url.searchParams);
	const filter = $derived((params.get('show') as Filter | null) ?? 'all');
	const plugin = $derived(params.get('plugin') ?? '');
	const scenes = $derived(params.has('scenes'));
	let query = $state(page.url.searchParams.get('q') ?? '');
	function set(key: string, value: string | null) {
		const next = new URL(page.url.href);
		if (value === null || value === '') next.searchParams.delete(key);
		else next.searchParams.set(key, value);
		void goto(`${next.pathname}${next.search}`, { replace: true, reset: false });
	}

	const rows = $derived(rowsOf(devices.byId, rooms.list, clock.now));
	const shape = $derived({ plugin, scenes, query });
	const shown = $derived(shownRows(rows, { ...shape, filter }));
	const tally = $derived(counts(rows, shape));
	const byPlugin = $derived(plugins(rows, scenes));
	const sceneCount = $derived(rows.filter((r) => r.scene).length);
	const roomNames = $derived([...rooms.list].sort((a, b) => a.name.localeCompare(b.name)));

	const CHIPS: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'noroom', label: 'No room' },
		{ id: 'battery', label: 'Battery low' },
		{ id: 'offline', label: 'Offline' }
	];

	// ---- devices a plugin no longer reports (homeCore's count, a guess) ----
	interface Orphans {
		total_orphans: number;
		plugins: {
			plugin_id: string;
			plugin_reports: number;
			core_holds: number;
			suspects: { device_id: string; name: string; stale_secs?: number }[];
		}[];
	}
	let orphans = $state<Orphans | null>(null);
	// Plugin devices someone removed, kept out until brought back (homeCore 0.1.82).
	interface Removed {
		device_id: string;
		plugin_id: string;
		name: string;
		removed_at: string;
	}
	let removed = $state<Removed[] | null>(null);
	const loadRemoved = async () => {
		const res = await fetch('/api/v1/devices/removed').catch(() => null);
		removed = res?.ok ? ((await res.json()) as Removed[]) : null;
	};
	async function loadOrphans() {
		const res = await fetch('/api/v1/devices/orphaned').catch(() => null);
		if (res?.ok) orphans = (await res.json()) as Orphans;
	}
	onMount(() => {
		void loadRemoved();
		void loadOrphans();
		// A device removed now joins Removed; one removed elsewhere, too.
		const stop = live.listen((frame) => {
			if ((frame as { type: string }).type === 'device_removed') void loadRemoved();
		});
		const away = onReturn(() => {
			void loadRemoved();
			void loadOrphans();
		});
		return () => {
			stop();
			away();
		};
	});
	async function bringBack(r: Removed) {
		const res = await fetch(`/api/v1/devices/removed/${encodeURIComponent(r.device_id)}`, {
			method: 'DELETE'
		}).catch(() => null);
		note = res?.ok
			? `${r.name} comes back the next time ${pluginLabel(r.plugin_id)} reports it.`
			: 'homeCore didn’t bring it back.';
		await loadRemoved();
	}
	const selectOrphans = (ids: string[]) => {
		const next = { ...picked };
		for (const id of ids) next[id] = true;
		picked = next;
	};

	// ---- several at once ----
	let picked = $state<Record<string, boolean>>({});
	const selected = $derived(Object.keys(picked).filter((id) => picked[id] && devices.byId[id]));
	const allOn = $derived(shown.length > 0 && shown.every((r) => picked[r.id]));
	const toggleAll = () => {
		const next = { ...picked };
		for (const r of shown) next[r.id] = !allOn;
		picked = next;
	};
	let busy = $state(false);
	let note = $state<string | null>(null);

	async function moveTo(roomId: string) {
		const room = rooms.list.find((r) => r.id === roomId) ?? null;
		busy = true;
		const err = await moveDevices(selected, room?.name ?? null);
		busy = false;
		note =
			err ??
			`${selected.length === 1 ? 'One device' : `${selected.length} devices`} moved to ${room?.name ?? 'no room'}.`;
		if (!err) picked = {};
	}

	async function remove() {
		const names = selected.map((id) => rows.find((r) => r.id === id)?.name ?? id);
		const fromPlugins = selected.filter((id) => !devices.byId[id]?.plugin_id?.startsWith('core.'));
		const yes = await ask({
			title: `Delete ${names.length === 1 ? names[0] : `${names.length} devices`}?`,
			body:
				names.length > 1
					? names.slice(0, 8).join(', ') +
						(names.length > 8 ? `, and ${names.length - 8} more` : '')
					: undefined,
			lost: [
				'Their names and rooms in homeCore go; recorded history stays.',
				...(fromPlugins.length > 0
					? [
							removed !== null
								? 'A plugin that still reports one doesn’t bring it back: it’s listed under Deleted, to bring back.'
								: 'A plugin that still reports one brings it back as new on its next report — remove it in the plugin (or its hub) first.'
						]
					: []),
				'Rules that name them are turned off until someone changes them.'
			],
			go: 'Delete',
			danger: true,
			typed: names.length > 5 ? 'delete' : undefined
		});
		if (!yes) return;
		busy = true;
		const done = await deleteDevices(selected);
		busy = false;
		note =
			done.error ??
			`${names.length === 1 ? 'One device' : `${names.length} devices`} deleted.` +
				(done.rules.length > 0
					? ` Turned off ${done.rules.length === 1 ? 'the rule' : `${done.rules.length} rules`} that named ${names.length === 1 ? 'it' : 'them'}: ${done.rules.join(', ')}.`
					: '');
		if (!done.error) picked = {};
	}
</script>

{#if !session.can('devices:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="page">
		<div class="tools">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					onchange={() => set('q', query.trim())}
					placeholder="Name, room, kind or id"
					aria-label="Find a device"
				/>
			</label>
			<div class="chips" role="group" aria-label="Show">
				{#each CHIPS as c (c.id)}
					<button
						type="button"
						aria-pressed={filter === c.id}
						onclick={() => set('show', c.id === 'all' ? null : c.id)}
						>{c.label} <span class="n">{tally[c.id]}</span></button
					>
				{/each}
			</div>
			{#if wide.current}
				<label class="plugin"
					>Plugin
					<select value={plugin} onchange={(e) => set('plugin', e.currentTarget.value)}>
						<option value="">Any</option>
						{#each byPlugin as p (p.id)}<option value={p.id}>{p.label} · {p.count}</option>{/each}
					</select>
				</label>
				{#if sceneCount > 0}
					<label class="check"
						><input
							type="checkbox"
							checked={scenes}
							onchange={(e) => set('scenes', e.currentTarget.checked ? '1' : null)}
						/>
						Include {sceneCount} plugin scenes</label
					>
				{/if}
			{/if}
		</div>

		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if orphans && orphans.total_orphans > 0}
			<section class="orphans" aria-label="Devices plugins no longer report">
				{#each orphans.plugins as p (p.plugin_id)}
					<div>
						<strong
							>{pluginLabel(p.plugin_id)} reports {p.plugin_reports} devices; homeCore holds {p.core_holds}.</strong
						>
						<span>
							The {p.core_holds - p.plugin_reports === 1 ? 'one' : p.core_holds - p.plugin_reports} heard
							from longest ago {p.suspects.length === 1 ? 'is' : 'are'} probably gone:
							{p.suspects.map((x) => x.name).join(', ')}. Check before deleting — it’s a count, not
							a certainty.
						</span>
						<button type="button" onclick={() => selectOrphans(p.suspects.map((x) => x.device_id))}
							>Select {p.suspects.length === 1 ? 'it' : 'them'}</button
						>
					</div>
				{/each}
			</section>
		{/if}

		{#if !devices.loaded}
			<p class="quiet">Loading devices…</p>
		{:else if shown.length === 0}
			<p class="quiet">No device matches.</p>
		{:else if wide.current}
			<div class="table" role="table" aria-label="Devices">
				<div class="row head" role="row">
					<span role="columnheader"
						><input
							type="checkbox"
							aria-label="Select all shown"
							checked={allOn}
							onchange={toggleAll}
						/></span
					>
					<span role="columnheader">Name</span>
					<span role="columnheader">Kind</span>
					<span role="columnheader">Room</span>
					<span role="columnheader">Plugin</span>
					<span role="columnheader">Now</span>
					<span role="columnheader">Last heard</span>
				</div>
				{#each shown as r (r.id)}
					<div class="row" role="row" class:on={picked[r.id]}>
						<span role="cell"
							><input
								type="checkbox"
								aria-label={`Select ${r.name}`}
								checked={!!picked[r.id]}
								onchange={() => (picked = { ...picked, [r.id]: !picked[r.id] })}
							/></span
						>
						<a role="cell" class="name" href={`/settings/devices/${encodeURIComponent(r.id)}`}
							>{r.name}</a
						>
						<span role="cell" class="muted">{r.kindLabel}</span>
						<span role="cell" class:none={!r.room}>{r.room?.name ?? 'No room'}</span>
						<span role="cell" class="muted">{r.pluginLabel}</span>
						<span role="cell" class="now" class:warn={r.warn}>{r.now || '—'}</span>
						<span role="cell" class="muted">{r.seen}</span>
					</div>
				{/each}
			</div>
		{:else}
			<ul class="list">
				{#each shown as r (r.id)}
					<li>
						<a href={`/settings/devices/${encodeURIComponent(r.id)}`}>
							<span class="text">
								<span class="name">{r.name}</span>
								<span class="sub" class:warn={r.warn}
									>{r.room?.name ?? 'No room'} · {r.pluginLabel}{r.now ? ` · ${r.now}` : ''}</span
								>
							</span>
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="quiet">
			{shown.length} of {tally.all} shown{scenes || sceneCount === 0
				? ''
				: `, not counting ${sceneCount} plugin scenes`}.
		</p>

		{#if removed?.length}
			<section class="removed" aria-label="Deleted devices">
				<h2>Deleted</h2>
				<p class="quiet">
					Their plugins still report them, but they’re kept out. Bring one back and it returns the
					next time its plugin reports it, with its history.
				</p>
				<ul>
					{#each removed as r (r.device_id)}
						<li>
							<span class="text">
								<span class="name">{r.name}</span>
								<span class="sub"
									>{pluginLabel(r.plugin_id)} · removed {fullDateOf(r.removed_at)}</span
								>
							</span>
							<button type="button" class="back" onclick={() => bringBack(r)}>Bring back</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	{#if selected.length > 0}
		<div class="bulk" role="region" aria-label="Selected devices">
			<strong>{selected.length} selected</strong>
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
			<button type="button" class="danger" disabled={busy} onclick={remove}>Delete…</button>
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
		font-family: var(--font-num);
	}
	.plugin,
	.check {
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
	.orphans {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.orphans div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		border: 1px solid var(--lit-card-line);
	}
	.orphans span {
		flex: 1 1 320px;
		color: var(--ink);
		font-size: 13px;
		line-height: 1.45;
	}
	.orphans strong {
		flex-basis: 100%;
	}
	.orphans button {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.table {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns:
			36px minmax(0, 2.2fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr)
			minmax(0, 1.6fr) minmax(0, 0.8fr);
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: 4px var(--space-3);
		font-size: 14px;
	}
	.row + .row {
		border-top: 1px solid var(--line);
	}
	.row.on {
		background: var(--nav-on);
	}
	.head {
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.row > * {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		color: var(--ink);
		font-weight: 600;
		text-decoration: none;
	}
	a.name:hover {
		text-decoration: underline;
	}
	.muted,
	.quiet {
		color: var(--ink-muted);
	}
	.none {
		color: var(--ink-muted);
		font-style: italic;
	}
	.warn {
		color: var(--alert);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 58px;
		padding: 6px var(--space-3) 6px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.list a :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
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
	.bulk .danger {
		height: 38px;
		padding: 0 16px;
		border-radius: 19px;
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
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
	.removed {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}
	.removed h2 {
		margin: 0;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.removed ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.removed li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.removed .text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.removed .back {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
</style>
