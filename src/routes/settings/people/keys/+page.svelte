<!--
	API keys (A5): for scripts and other programs — what each is for, what
	it may do, when it was last used. A new key is shown once. Keys can be
	renamed, narrowed, given a new secret or revoked. Wall tablets have their
	own keys, under Displays.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { daysAgo } from '#lib/settings.js';
	import {
		EXPIRY,
		LEVEL_WORDS,
		keyGroups,
		keyState,
		keyWords,
		levelOf,
		scopeChoices,
		scopesFor,
		type ApiKey,
		type KeyLevel,
		type Person,
		type RoleInfo
	} from '#lib/people.js';
	import {
		editKey,
		loadKeys,
		loadPeople,
		loadRoles,
		makeKey,
		revokeKey,
		rotateKey
	} from '#lib/peopleAdmin.js';

	$effect(() => heading.show('API keys', { href: '/settings/people', label: 'People & access' }));

	let keys = $state<ApiKey[] | null>(null);
	let people = $state<Person[]>([]);
	let roles = $state<RoleInfo[]>([]);
	let failed = $state<string | null>(null);
	async function load() {
		const [k, p, r] = await Promise.all([loadKeys(), loadPeople(), loadRoles()]);
		if (!k.ok) return void (failed = k.error);
		keys = k.data;
		if (p.ok) people = p.data;
		if (r.ok) roles = r.data;
	}
	onMount(load);

	const groups = $derived(keys ? keyGroups(keys, clock.now) : { live: [], stopped: [] });
	const mine = $derived(session.me?.scopes ?? []);
	const nameOf = (uid: string) =>
		uid === session.me?.id ? 'you' : (people.find((p) => p.id === uid)?.username ?? 'someone gone');
	/** What a key's owner holds — the most it can be given. */
	const ownerScopes = (k: ApiKey) => {
		if (k.owner_uid === session.me?.id) return mine;
		const role = people.find((p) => p.id === k.owner_uid)?.role;
		return roles.find((r) => r.role === role)?.scopes ?? k.scopes;
	};
	const when = (iso: string | null) => (iso ? daysAgo(iso, clock.now) : 'never');

	// ---- a new key, or editing one ----
	let editing = $state<ApiKey | null>(null);
	let label = $state('');
	let level = $state<KeyLevel>('read');
	let custom = $state<string[]>([]);
	let expiry = $state<number | null>(90);
	let made = $state<{ label: string; token: string } | null>(null);
	let note = $state<string | null>(null);
	let busy = $state(false);

	const holds = $derived(editing ? ownerScopes(editing) : mine);
	const scopes = $derived(level === 'custom' ? custom : scopesFor(level, holds));

	function fresh() {
		editing = null;
		label = '';
		level = 'read';
		custom = [];
		expiry = 90;
		note = null;
	}
	function edit(k: ApiKey) {
		made = null;
		editing = k;
		label = k.label;
		level = levelOf(k.scopes, ownerScopes(k));
		custom = [...k.scopes];
		note = null;
	}
	function pickLevel(l: KeyLevel) {
		if (l === 'custom' && level !== 'custom') custom = [...scopes];
		level = l;
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		note = null;
		if (!label.trim()) return void (note = 'Say what it’s for.');
		if (!scopes.length) return void (note = 'Give it something it may do.');
		busy = true;
		if (editing) {
			const r = await editKey(editing.id, { label: label.trim(), scopes });
			busy = false;
			if (!r.ok) return void (note = r.error);
			fresh();
		} else {
			const r = await makeKey({
				label: label.trim(),
				scopes,
				...(expiry === null ? {} : { expires_in_days: expiry })
			});
			busy = false;
			if (!r.ok) return void (note = r.error);
			made = { label: r.data.label, token: r.data.token };
			fresh();
		}
		await load();
	}

	let copied = $state(false);
	async function copy() {
		if (!made) return;
		await navigator.clipboard?.writeText(made.token).catch(() => {});
		copied = true;
	}

	async function rotate(k: ApiKey) {
		const ok = await ask({
			title: `A new secret for “${k.label}”?`,
			body: 'The old one stops working now. Put the new one where the program reads it.',
			go: 'New secret',
			danger: true
		});
		if (!ok) return;
		const r = await rotateKey(k.id);
		if (!r.ok) return void (note = r.error);
		fresh();
		made = { label: k.label, token: r.data.token };
		await load();
	}

	async function revoke(k: ApiKey) {
		const ok = await ask({
			title: `Revoke “${k.label}”?`,
			body: 'It stops working at once, and can’t be turned back on.',
			go: 'Revoke',
			danger: true
		});
		if (!ok) return;
		const r = await revokeKey(k.id);
		if (!r.ok) return void (note = r.error);
		if (editing?.id === k.id) fresh();
		await load();
	}
</script>

{#if !session.can('devices:read')}
	<p class="quiet">Keys are for people who can see the house.</p>
{:else}
	<p class="quiet top">
		For scripts and other programs. Wall tablets have their own: <a href="/settings/displays"
			>Displays</a
		>.
	</p>
	<div class="split">
		<section class="col">
			<h2>In use</h2>
			{#if failed}
				<p class="note bad" role="alert">{failed}</p>
			{:else if keys === null}
				<p class="quiet">Loading…</p>
			{:else if groups.live.length === 0}
				<p class="empty">None.</p>
			{:else}
				{#each groups.live as k (k.id)}
					<article class="key" class:on={editing?.id === k.id}>
						<strong>{k.label}</strong>
						<span class="sub"
							>Made by {nameOf(k.owner_uid)}
							{daysAgo(k.created_at, clock.now)} · last used {when(k.last_used_at)}{k.expires_at
								? ` · stops ${new Date(k.expires_at).toLocaleDateString()}`
								: ''}</span
						>
						<span class="sub">Can {keyWords(k.scopes)}</span>
						<span class="mono">hc_sk_{k.prefix}…</span>
						<div class="acts">
							<button class="plain" onclick={() => edit(k)}>Edit</button>
							<button class="plain" onclick={() => rotate(k)}>New secret</button>
							<button class="plain bad" onclick={() => revoke(k)}>Revoke</button>
						</div>
					</article>
				{/each}
			{/if}
			{#if groups.stopped.length}
				<h2>Stopped</h2>
				{#each groups.stopped as k (k.id)}
					<article class="key old">
						<strong>{k.label}</strong>
						<span class="sub"
							>Made by {nameOf(k.owner_uid)}
							{daysAgo(k.created_at, clock.now)} · {keyState(k, clock.now)}</span
						>
						<span class="sub">Could {keyWords(k.scopes)}</span>
					</article>
				{/each}
			{/if}
		</section>

		<section class="card">
			{#if made}
				<h2 class="big">“{made.label}”</h2>
				<p>
					Here is the key. It’s shown <strong>only now</strong> — put it where the program reads it.
				</p>
				<code class="token">{made.token}</code>
				<div class="acts">
					<button class="go" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
					<button class="plain" onclick={() => ((made = null), (copied = false))}>Done</button>
				</div>
			{:else}
				<h2 class="big">{editing ? `Editing “${editing.label}”` : 'New key'}</h2>
				<form onsubmit={save}>
					<label class="field">
						<span>What it’s for</span>
						<input bind:value={label} placeholder="Backup script on the NAS" autocomplete="off" />
					</label>
					<fieldset>
						<legend>What it may do</legend>
						{#each Object.entries(LEVEL_WORDS) as [id, w] (id)}
							<label class="choice" class:on={level === id}>
								<input
									type="radio"
									name="level"
									checked={level === id}
									onchange={() => pickLevel(id as KeyLevel)}
								/>
								<span><strong>{w.name}</strong><span class="sub">{w.what}</span></span>
							</label>
						{/each}
					</fieldset>
					{#if level === 'custom'}
						<div class="scopes">
							{#each scopeChoices(holds) as g (g.group)}
								<div class="group">
									<span class="gname">{g.group}</span>
									{#each g.scopes as s (s)}
										<label class="check"
											><input type="checkbox" value={s} bind:group={custom} />
											<span class="mono">{s.split(':')[1]}</span></label
										>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
					{#if !editing}
						<label class="field row">
							<span>Stops working</span>
							<select bind:value={expiry}>
								{#each EXPIRY as e (e.label)}<option value={e.days}>{e.label}</option>{/each}
							</select>
						</label>
					{/if}
					{#if note}<p class="note bad" role="alert">{note}</p>{/if}
					<div class="acts">
						<button class="go" type="submit" disabled={busy}
							>{editing ? 'Save' : busy ? 'Making…' : 'Make the key'}</button
						>
						{#if editing}<button type="button" class="plain" onclick={fresh}>Cancel</button>{/if}
					</div>
					<p class="sub">
						homeCore can record addresses a key may be used from, but doesn’t check them yet, so
						this page doesn’t offer it.
					</p>
				</form>
			{/if}
		</section>
	</div>
{/if}

<style>
	.top {
		margin-bottom: var(--space-4);
	}
	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
		gap: var(--space-5);
		align-items: start;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: var(--space-2) 4px 0;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h2:first-child {
		margin-top: 0;
	}
	h2.big {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: none;
		color: var(--ink);
	}
	.empty {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
	}
	.key {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 14px 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.key.on {
		border-color: var(--accent);
	}
	.key.old {
		opacity: 0.75;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: 16px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card p {
		margin: 0;
		line-height: 1.5;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field.row {
		flex-direction: row;
		align-items: center;
		gap: 10px;
	}
	.field > span {
		font-weight: 600;
		flex: 1;
	}
	input:not([type]),
	select {
		min-height: var(--target);
		box-sizing: border-box;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--sheet);
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
		font-weight: 600;
		padding-bottom: 6px;
	}
	.choice {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--bg);
		cursor: pointer;
	}
	.choice.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.choice input {
		margin: 3px 0 0;
		accent-color: var(--accent);
	}
	.choice > span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.scopes {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}
	.gname {
		width: 96px;
		font-weight: 700;
		font-size: 13px;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
	}
	.sub {
		display: block;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.mono {
		font-family: var(--font-num);
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.token {
		padding: 12px 14px;
		border-radius: 10px;
		background: var(--surface-2);
		font-family: var(--font-num);
		font-size: 13px;
		word-break: break-all;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
	}
	.go,
	.plain {
		min-height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		font-weight: 700;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.plain.bad {
		color: var(--alert);
		border-color: var(--alert-line);
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
</style>
