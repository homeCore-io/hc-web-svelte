<!--
	People & access (A5): everyone with an account — their role, their PIN,
	when they were last about — and what each role allows, read from
	homeCore's own scopes. Adding a person; API keys; displays.
-->
<script lang="ts">
	import { fullDateOf } from '#lib/when.js';
	import { onMount } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { daysAgo } from '#lib/settings.js';
	import {
		COLUMNS,
		ROLE_WORDS,
		advice,
		cellsOf,
		initialOf,
		keyGroups,
		ordered,
		roleName,
		type ApiKey,
		type Person,
		type RoleInfo
	} from '#lib/people.js';
	import { lastActive, loadKeys, loadPeople, loadRoles } from '#lib/peopleAdmin.js';

	let people = $state<Person[] | null>(null);
	let roles = $state<RoleInfo[]>([]);
	let keys = $state<ApiKey[] | null>(null);
	let displays = $state<number | null>(null);
	let seen = $state<Record<string, string>>({});
	let failed = $state<string | null>(null);

	onMount(() => {
		void load();
		return onReturn(load);
	});
	async function load() {
		const [p, r, k] = await Promise.all([loadPeople(), loadRoles(), loadKeys()]);
		if (!p.ok) return void (failed = p.error);
		people = [...p.data].sort((a, b) => a.created_at.localeCompare(b.created_at));
		if (r.ok) roles = ordered(r.data);
		if (k.ok) keys = k.data;
		void lastActive(p.data).then((s) => (seen = s));
		const d = await fetch('/api/v1/displays').catch(() => null);
		if (d?.ok)
			displays = ((await d.json()) as { revoked?: boolean }[]).filter((x) => !x.revoked).length;
	}

	const said = $derived(people ? advice(people, roles) : null);
	const liveKeys = $derived(keys ? keyGroups(keys, clock.now).live.length : null);
	const since = (iso: string) => fullDateOf(iso);
	const pin = (p: Person) => (p.has_pin === undefined ? '' : p.has_pin ? 'PIN set' : 'No PIN');
	const last = (p: Person) => (seen[p.id] ? `Last seen ${daysAgo(seen[p.id]!)}` : '');
	const href = (p: Person) => `/settings/people/${encodeURIComponent(p.id)}`;
	const me = (p: Person) => p.id === session.me?.id;
</script>

{#if !session.isAdmin}
	<p class="quiet">People and access are for the house’s admins.</p>
{:else}
	<div class="page">
		<div class="tools">
			<span class="sum">
				{people ? `${people.length} ${people.length === 1 ? 'person' : 'people'}` : ''}
			</span>
			<a class="plain" href="/settings/people/keys"
				>API keys · {liveKeys === null ? '…' : liveKeys || 'none'} in use</a
			>
			<a class="plain" href="/settings/displays"
				>Displays · {displays === null ? '…' : displays || 'none'}</a
			>
			<a class="go" href="/settings/people/add">+ Add a person</a>
		</div>

		{#if said}<p class="lit">{said}</p>{/if}

		{#if failed}
			<p class="note bad" role="alert">{failed}</p>
		{:else if people === null}
			<p class="quiet">Loading…</p>
		{:else if wide.current}
			<div class="table" role="table" aria-label="People">
				{#each people as p (p.id)}
					<a class="row" role="row" href={href(p)}>
						<span role="cell" class="face" aria-hidden="true">{initialOf(p.username)}</span>
						<span role="cell" class="who">
							<strong>{p.username}{me(p) ? ' (you)' : ''}</strong>
							<span class="sub">since {since(p.created_at)}</span>
						</span>
						<span role="cell" class="role">{roleName(p.role)}</span>
						<span role="cell" class="sub">{pin(p)}</span>
						<span role="cell" class="sub">{last(p)}</span>
					</a>
				{/each}
			</div>
		{:else}
			<ul class="list">
				{#each people as p (p.id)}
					<li>
						<a href={href(p)}>
							<span class="face" aria-hidden="true">{initialOf(p.username)}</span>
							<span class="text">
								<strong>{p.username}{me(p) ? ' (you)' : ''}</strong>
								<span class="sub">{[roleName(p.role), pin(p)].filter(Boolean).join(' · ')}</span>
							</span>
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}

		{#if roles.length}
			<section class="roles">
				<h2>What each role allows</h2>
				{#if wide.current}
					<div class="matrix" role="table" aria-label="What each role allows">
						<div class="mrow head" role="row">
							<span role="columnheader">Role</span>
							{#each COLUMNS as c (c.label)}<span role="columnheader">{c.label}</span>{/each}
						</div>
						{#each roles as r (r.role)}
							<div class="mrow" role="row" class:new={r.role === 'household_member'}>
								<span role="rowheader" class="rname">
									<strong>{roleName(r.role)}</strong>
									<span class="sub">{ROLE_WORDS[r.role]?.who ?? ''}</span>
								</span>
								{#each cellsOf(r.scopes) as v, i (i)}
									<span role="cell" class="cell {v === 'yes' ? 'yes' : v === 'no' ? 'no' : ''}"
										>{v}</span
									>
								{/each}
							</div>
						{/each}
					</div>
				{:else}
					<ul class="plainlist">
						{#each roles as r (r.role)}
							<li>
								<strong>{roleName(r.role)}</strong>
								<span class="sub">{ROLE_WORDS[r.role]?.what ?? r.scopes.join(', ')}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<p class="quiet">
					Everyone can personalise their own view. Rooms and devices can’t be limited per person yet
					— that comes later.
				</p>
			</section>
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.sum {
		flex: 1;
		color: var(--ink-muted);
	}
	.plain,
	.go {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.lit {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		line-height: 1.45;
	}
	.table,
	.list,
	.matrix,
	.plainlist {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.row {
		display: grid;
		grid-template-columns: 44px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.2fr);
		align-items: center;
		gap: var(--space-3);
		min-height: 60px;
		padding: 8px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.row + .row,
	.list li + li,
	.plainlist li + li,
	.mrow + .mrow {
		border-top: 1px solid var(--line);
	}
	a.row:hover {
		background: color-mix(in srgb, var(--surface-2) 40%, var(--surface));
	}
	.face {
		width: 36px;
		height: 36px;
		border-radius: 18px;
		flex: none;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}
	.who,
	.text,
	.rname {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.role {
		font-weight: 600;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 58px;
		padding: 6px var(--space-3) 6px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.list :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.text {
		flex: 1;
	}
	.roles {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0 4px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.mrow {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) repeat(8, minmax(0, 1fr));
		align-items: center;
		gap: var(--space-2);
		padding: 10px var(--space-4);
	}
	.mrow.new {
		background: color-mix(in srgb, var(--lit-bg) 45%, var(--surface));
	}
	.mrow.head {
		align-items: end;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.mrow.head span:not(:first-child),
	.cell {
		text-align: center;
	}
	.cell {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.cell.yes {
		color: var(--ink);
		font-weight: 700;
	}
	/* "no" (uses devices but not scenes) is a gap worth noticing, not an alarm. */
	.cell.no {
		color: var(--ink);
		font-weight: 600;
	}
	.plainlist {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.plainlist li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px var(--space-4);
	}
	.quiet {
		margin: 0 4px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		font-weight: 600;
	}
	.bad {
		color: var(--alert);
	}
</style>
