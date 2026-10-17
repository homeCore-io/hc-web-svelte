<!--
	Audit (A6): who changed what, and when, as sentences. A person's repeated
	sign-ins on a day are one row; changes stand alone. A row opens to say
	exactly what homeCore recorded.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import {
		auditMatches,
		auditRows,
		auditWords,
		whoOf,
		type AuditEntry,
		type AuditFilter
	} from '#lib/system.js';
	import { loadAudit } from '#lib/systemAdmin.js';

	$effect(() => heading.show('Audit', { href: '/settings/system', label: 'System' }));

	const PAGE = 500;
	let entries = $state<AuditEntry[]>([]);
	let failed = $state<string | null>(null);
	let more = $state(true);
	let busy = $state(false);
	let who = $state('');
	let what = $state<AuditFilter>('all');
	let query = $state('');
	let open = $state<string | null>(null);

	async function load(older = false) {
		busy = true;
		const before = older ? entries[entries.length - 1]?.ts : undefined;
		const r = await loadAudit({ limit: PAGE, before });
		busy = false;
		if (!r.ok) return void (failed = r.error);
		const seen = new Set(entries.map((e) => e.id));
		const fresh = r.data.filter((e) => !seen.has(e.id));
		entries = older ? [...entries, ...fresh] : r.data;
		more = r.data.length === PAGE;
	}
	onMount(() => void load());

	const people = $derived([...new Set(entries.map(whoOf))].sort());
	const said = (e: AuditEntry) =>
		`${auditWords(e)
			.map((w) => w.t)
			.join('')} ${e.event_type} ${e.target_id ?? ''} ${e.ip ?? ''}`.toLowerCase();
	const rows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return auditRows(
			entries.filter(
				(e) => (!who || whoOf(e) === who) && auditMatches(e, what) && (!q || said(e).includes(q))
			)
		);
	});
	const changesRecorded = $derived(
		entries.some((e) => /^(automation|device|area|scene|helper|mode|plugin)\./.test(e.event_type))
	);
	function when(r: { first: AuditEntry; all: AuditEntry[] }): string {
		const fmt = (ts: string) => {
			const d = new Date(ts);
			const today = d.toDateString() === new Date(clock.now).toDateString();
			const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
			return today
				? `Today, ${time}`
				: `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
		};
		if (r.all.length === 1) return fmt(r.first.ts);
		const first = new Date(r.all[r.all.length - 1]!.ts);
		const last = new Date(r.first.ts);
		const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		return `${fmt(r.first.ts).split(',')[0]}, ${t(first)}–${t(last)}`;
	}
	function detailOf(a: AuditEntry): string[] {
		const out = [`${a.event_type} · ${a.result}`];
		if (a.target_kind) out.push(`${a.target_kind}: ${a.target_id ?? ''}`);
		const d = Object.entries(a.detail ?? {}).map(
			([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`
		);
		if (d.length) out.push(d.join(' · '));
		if (a.ip) out.push(`from ${a.ip}${a.user_agent ? ` · ${a.user_agent.slice(0, 80)}` : ''}`);
		return out;
	}
</script>

{#if !session.can('audit:read')}
	<p class="quiet">The audit is for the house’s admins.</p>
{:else}
	<div class="page">
		<div class="tools">
			<label
				>Who
				<select bind:value={who}>
					<option value="">anyone</option>
					{#each people as p (p)}<option value={p}>{p}</option>{/each}
				</select>
			</label>
			<label
				>What
				<select bind:value={what}>
					<option value="all">everything</option>
					<option value="changes">changes only</option>
					<option value="signins">sign-ins</option>
					<option value="refused">refused</option>
				</select>
			</label>
			<input
				type="search"
				placeholder="Search — a name, a room, an address"
				aria-label="Search the audit"
				bind:value={query}
			/>
		</div>
		{#if entries.length && !changesRecorded}
			<p class="lit">
				This homeCore records sign-ins, accounts and keys, but not changes to rules, devices, rooms
				and scenes — a newer one does.
			</p>
		{/if}
		{#if failed}<p class="note bad" role="alert">{failed}</p>{/if}
		{#if rows.length === 0}
			<p class="empty">
				{entries.length ? 'Nothing matches.' : busy ? 'Loading…' : 'Nothing recorded yet.'}
			</p>
		{:else}
			<ol class="list">
				{#each rows as r (r.first.id)}
					{@const key = String(r.first.id)}
					<li class:refused={r.first.result !== 'success'}>
						<button aria-expanded={open === key} onclick={() => (open = open === key ? null : key)}>
							<span class="when">{when(r)}</span>
							<span class="words"
								>{#each auditWords(r.first) as w, j (j)}{#if w.strong}<strong>{w.t}</strong
										>{:else}{w.t}{/if}{/each}</span
							>
							{#if r.all.length > 1}<span class="count">{r.all.length} times</span>{/if}
						</button>
						{#if open === key}
							<div class="detail">
								{#each detailOf(r.first) as line, j (j)}<span>{line}</span>{/each}
								{#if r.all.length > 1}<span
										>Each one is a row in homeCore’s audit; this page groups a person’s repeats in a
										day.</span
									>{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ol>
			{#if more}
				<button class="plain" onclick={() => load(true)} disabled={busy}
					>{busy ? 'Loading…' : 'Older'}</button
				>
			{/if}
		{/if}
	</div>
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
		gap: var(--space-2) var(--space-4);
	}
	label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	input[type='search'] {
		flex: 1 1 220px;
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	select {
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 8px;
	}
	.lit {
		margin: 0;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		line-height: 1.5;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list button {
		width: 100%;
		display: grid;
		grid-template-columns: minmax(110px, 160px) minmax(0, 1fr) auto;
		gap: 14px;
		align-items: center;
		min-height: 50px;
		padding: 8px 16px;
		border: none;
		background: none;
		text-align: left;
	}
	.refused .words {
		color: var(--alert);
	}
	.when {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.words {
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.count {
		height: 24px;
		padding: 0 10px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
		background: var(--surface-2);
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.detail {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 16px 12px;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}
	.plain {
		align-self: flex-start;
		height: 36px;
		padding: 0 16px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 700;
	}
	.empty {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
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
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	@media (max-width: 640px) {
		.list button {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.when {
			grid-column: 1 / -1;
		}
	}
</style>
