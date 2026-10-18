<!--
	One person (A5): their role, a new password if they've forgotten theirs,
	their PIN cleared if forgotten, the keys they made, and removing them.
	The house always keeps an admin.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		ROLE_WORDS,
		initialOf,
		keyState,
		keyWords,
		lastAdmin,
		ordered,
		programKeys,
		roleName,
		type ApiKey,
		type Person,
		type RoleInfo
	} from '#lib/people.js';
	import {
		clearPin,
		loadKeys,
		loadPeople,
		loadRoles,
		removePerson,
		setPassword,
		setRole
	} from '#lib/peopleAdmin.js';

	const id = $derived(page.params.id ?? '');
	let people = $state<Person[] | null>(null);
	let roles = $state<RoleInfo[]>([]);
	let keys = $state<ApiKey[]>([]);
	let failed = $state<string | null>(null);

	async function load() {
		const [p, r, k] = await Promise.all([loadPeople(), loadRoles(), loadKeys()]);
		if (!p.ok) return void (failed = p.error);
		people = p.data;
		if (r.ok) roles = ordered(r.data);
		if (k.ok) keys = k.data;
	}
	onMount(() => {
		void load();
		return onReturn(load);
	});

	const person = $derived(people?.find((p) => p.id === id));
	const isMe = $derived(person?.id === session.me?.id);
	$effect(() =>
		heading.show(person?.username ?? 'Person', {
			href: '/settings/people',
			label: 'People & access'
		})
	);
	// homeCore with A5 says whether a PIN is set — and ends sessions on a new role.
	const newCore = $derived(person?.has_pin !== undefined);

	// ---- role ----
	let role = $state('');
	$effect(() => {
		if (person) role = person.role;
	});
	const keeps = $derived(!!people && !!person && !lastAdmin(people, person, role));
	const changed = $derived(!!person && role !== person.role);
	let roleNote = $state<string | null>(null);
	async function saveRole() {
		if (!person || !changed) return;
		if (isMe) {
			const ok = await ask({
				title: `Make yourself ${roleName(role).toLowerCase()}?`,
				body: 'You’ll be signed out, and sign in again without admin — you won’t be able to undo this yourself.',
				go: 'Change my role',
				danger: true
			});
			if (!ok) return;
		}
		const r = await setRole(person.id, role);
		if (!r.ok) return void (roleNote = r.error);
		if (isMe) return void (await session.signOut(), goto('/login'));
		roleNote = newCore
			? `${person.username} is now ${roleName(role).toLowerCase()}. They’re signed out everywhere and sign in again under it.`
			: `${person.username} is now ${roleName(role).toLowerCase()}. It applies when they next sign in.`;
		await load();
	}

	// ---- password ----
	let settingPassword = $state(false);
	let password = $state('');
	let passwordNote = $state<string | null>(null);
	async function savePassword(e: SubmitEvent) {
		e.preventDefault();
		if (!person) return;
		if (password.length < 8) return void (passwordNote = 'At least 8 characters.');
		const r = await setPassword(person.id, password);
		if (!r.ok) return void (passwordNote = r.error);
		password = '';
		settingPassword = false;
		passwordNote = `Set. ${person.username} is signed out everywhere; give them the new one in person.`;
	}

	// ---- PIN ----
	let pinNote = $state<string | null>(null);
	async function forgetPin() {
		if (!person) return;
		const r = await clearPin(person.id);
		if (!r.ok)
			return void (pinNote =
				r.status === 404 || r.status === 405
					? 'This homeCore can’t clear someone else’s PIN yet.'
					: r.error);
		pinNote = `Cleared. ${person.username} can choose another on Me.`;
		await load();
	}

	// ---- keys ----
	const theirs = $derived(
		person
			? programKeys(keys)
					.filter((k) => k.owner_uid === person.id && keyState(k, clock.now) === 'in use')
					.sort((a, b) => b.created_at.localeCompare(a.created_at))
			: []
	);

	// ---- remove ----
	let removeNote = $state<string | null>(null);
	async function remove() {
		if (!person) return;
		const ok = await ask({
			title: `Remove ${person.username}?`,
			body: 'They can’t sign in any more. Rules, scenes and pages they made stay.',
			lost: [
				'Their own Home, phone bar and preferences',
				...(theirs.length
					? [`${theirs.length === 1 ? 'The key' : `The ${theirs.length} keys`} they made`]
					: [])
			],
			go: 'Remove',
			danger: true
		});
		if (!ok) return;
		const r = await removePerson(person.id);
		if (!r.ok) return void (removeNote = r.error);
		void goto('/settings/people');
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">People and access are for the house’s admins.</p>
{:else if failed}
	<p class="note bad" role="alert">{failed}</p>
{:else if people === null}
	<p class="quiet">Loading…</p>
{:else if !person}
	<p class="quiet">There’s nobody with that account. <a href="/settings/people">Everyone</a></p>
{:else}
	<header class="who">
		<span class="face" aria-hidden="true">{initialOf(person.username)}</span>
		<span class="whotext">
			<strong>{person.username}{isMe ? ' (you)' : ''}</strong>
			<span class="sub"
				>Since {new Date(person.created_at).toLocaleDateString(undefined, {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})}</span
			>
		</span>
	</header>
	{#if page.url.searchParams.get('added')}
		<p class="lit" role="status">
			Added. Give {person.username} their password in person — they can change it, and set a PIN, on Me.
		</p>
	{/if}

	<div class="grid">
		<section class="card">
			<h2>Role</h2>
			<select bind:value={role} aria-label="Role">
				{#each roles as r (r.role)}<option value={r.role}>{roleName(r.role)}</option>{/each}
			</select>
			<span class="sub">{ROLE_WORDS[role]?.what ?? ''}</span>
			{#if changed && !keeps}
				<p class="lit">
					{person.username} is the house’s only admin, so stays one. Make someone else an admin first.
				</p>
			{:else if changed}
				<p class="sub">
					{newCore
						? `${isMe ? 'Your' : `${person.username}’s`} sessions end when you save, so the new role applies at once.`
						: 'It applies when they next sign in.'}
				</p>
				<button class="go" onclick={saveRole}>Save</button>
			{/if}
			{#if roleNote}<p class="sub" role="status">{roleNote}</p>{/if}
		</section>

		<section class="card">
			<h2>Password</h2>
			{#if isMe}
				<span class="sub">Change your own on <a href="/me#password">Me</a>.</span>
			{:else if settingPassword}
				<form class="inline" onsubmit={savePassword}>
					<input
						type="password"
						bind:value={password}
						autocomplete="new-password"
						aria-label="New password"
						placeholder="New password"
						required
					/>
					<button class="go" type="submit">Set</button>
					<button type="button" class="plain" onclick={() => (settingPassword = false)}
						>Cancel</button
					>
				</form>
			{:else}
				<span class="sub"
					>Set a new one if {person.username} has forgotten theirs. They’re signed out everywhere, phones
					and computers.</span
				>
				<button class="plain" onclick={() => (settingPassword = true)}>Set a new password…</button>
			{/if}
			{#if passwordNote}<p class="sub" role="status">{passwordNote}</p>{/if}
		</section>

		<section class="card">
			<h2>PIN for displays</h2>
			{#if person.has_pin === undefined}
				<span class="sub"
					>{person.username} sets their own on Me. This homeCore doesn’t say whether one is set.</span
				>
			{:else if person.has_pin}
				<span class="sub"
					>{person.username} has a PIN. If it’s forgotten, clear it here so they can choose another on
					Me.</span
				>
				<button class="plain" onclick={forgetPin}>Clear {isMe ? 'my' : 'their'} PIN</button>
			{:else}
				<span class="sub"
					>No PIN. {isMe ? 'You set yours' : `${person.username} sets their own`} on Me.</span
				>
			{/if}
			{#if pinNote}<p class="sub" role="status">{pinNote}</p>{/if}
		</section>

		<section class="card">
			<h2>Keys {isMe ? 'you' : 'they'} made</h2>
			{#if theirs.length === 0}
				<span class="sub">None.</span>
			{:else}
				<ul class="keys">
					{#each theirs as k (k.id)}
						<li><strong>{k.label}</strong> <span class="sub">Can {keyWords(k.scopes)}</span></li>
					{/each}
				</ul>
				<a class="plain" href="/settings/people/keys">API keys</a>
			{/if}
		</section>

		{#if !isMe}
			<section class="card danger">
				<span class="whotext"
					><strong class="bad">Remove {person.username}</strong>
					<span class="sub"
						>They can’t sign in any more; their own Home is deleted. Rules, scenes and pages they
						made stay.</span
					></span
				>
				{#if lastAdmin(people, person)}
					<span class="sub">The house’s only admin can’t be removed.</span>
				{:else}
					<button class="plain bad" onclick={remove}>Remove…</button>
				{/if}
				{#if removeNote}<p class="note bad" role="alert">{removeNote}</p>{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	.who {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: var(--space-4);
	}
	.face {
		width: 48px;
		height: 48px;
		border-radius: 24px;
		flex: none;
		background: var(--surface-2);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		font-weight: 700;
	}
	.whotext {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.whotext strong {
		font-size: 17px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card.danger {
		grid-column: 1 / -1;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		border-color: var(--alert-line);
	}
	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}
	select,
	.inline input {
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--sheet);
		padding: 0 10px;
		font-weight: 600;
	}
	select {
		align-self: stretch;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-self: stretch;
	}
	.inline input {
		flex: 1 1 180px;
		font-weight: 400;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13.5px;
		line-height: 1.45;
		margin: 0;
	}
	.lit {
		margin: 0 0 var(--space-4);
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		line-height: 1.45;
	}
	.card .lit {
		margin: 0;
	}
	.go,
	.plain {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		display: inline-flex;
		align-items: center;
		font-weight: 700;
		text-decoration: none;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.plain.bad {
		border-color: var(--alert-line);
		background: none;
	}
	.bad {
		color: var(--alert);
	}
	.keys {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
