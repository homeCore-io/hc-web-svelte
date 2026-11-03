<!--
	Adding a person (A5): what they should be able to do first, then the
	name they sign in with and a first password. A PIN is theirs alone, so
	they set it on Me.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { MAIN_ROLES, ROLE_WORDS, ordered, roleName, type RoleInfo } from '#lib/people.js';
	import { addPerson, loadRoles } from '#lib/peopleAdmin.js';

	$effect(() =>
		heading.show('Add a person', { href: '/settings/people', label: 'People & access' })
	);

	let roles = $state<RoleInfo[]>([]);
	let role = $state('');
	let more = $state(false);
	onMount(async () => {
		const r = await loadRoles();
		if (!r.ok) return;
		roles = ordered(r.data);
		role = roles.some((x) => x.role === 'household_member') ? 'household_member' : 'user';
	});
	const main = $derived(
		[...MAIN_ROLES]
			.filter((id) => roles.some((r) => r.role === id))
			.map((id) => roles.find((r) => r.role === id)!)
	);
	const rest = $derived(roles.filter((r) => !MAIN_ROLES.includes(r.role)));
	const shown = $derived(more || rest.some((r) => r.role === role) ? [...main, ...rest] : main);

	let username = $state('');
	let password = $state('');
	let busy = $state(false);
	let note = $state<string | null>(null);
	async function add(e: SubmitEvent) {
		e.preventDefault();
		note = null;
		if (password.length < 8) return void (note = 'The password needs at least 8 characters.');
		busy = true;
		const r = await addPerson(username.trim(), password, role);
		busy = false;
		if (!r.ok)
			return void (note =
				r.status === 409 ? `There’s already someone called “${username.trim()}”.` : r.error);
		void goto(`/settings/people/${encodeURIComponent(r.data.id)}?added=1`);
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">People and access are for the house’s admins.</p>
{:else}
	<form class="split" class:one={!wide.current} onsubmit={add}>
		<fieldset class="roles">
			<legend>What should they be able to do?</legend>
			{#each shown as r (r.role)}
				<label class="choice" class:on={role === r.role}>
					<input type="radio" name="role" value={r.role} bind:group={role} />
					<span class="text">
						<strong
							>{roleName(r.role)}
							{#if r.role === 'household_member'}<span class="hint">suggested for family</span
								>{/if}</strong
						>
						<span class="sub">{ROLE_WORDS[r.role]?.what ?? r.scopes.join(', ')}</span>
					</span>
				</label>
			{/each}
			{#if rest.length && shown.length < roles.length}
				<button type="button" class="more" onclick={() => (more = true)}
					>More roles — {rest.map((r) => roleName(r.role).toLowerCase()).join(', ')}</button
				>
			{/if}
		</fieldset>

		<section class="card">
			<label class="field">
				<span>Name they sign in with</span>
				<input
					bind:value={username}
					autocomplete="off"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</label>
			<label class="field">
				<span>First password</span>
				<input type="password" bind:value={password} autocomplete="new-password" required />
				<!-- Said as it's typed, not after homeCore refuses it (#91). -->
				<span class="sub" class:short={password.length > 0 && password.length < 8}
					>At least 8 characters{password.length > 0 && password.length < 8
						? ` — ${8 - password.length} more`
						: ''}. Give it to them in person; they can change it on Me.</span
				>
			</label>
			<div class="aside">
				<strong>PIN for displays</strong>
				<span class="sub"
					>They set their own on Me — a PIN is theirs alone, and only they should know it.</span
				>
			</div>
			{#if note}<p class="note bad" role="alert">{note}</p>{/if}
			<button
				class="go"
				type="submit"
				disabled={busy || !role || !username.trim() || password.length < 8}
				>{busy ? 'Adding…' : `Add as ${roleName(role || 'user').toLowerCase()}`}</button
			>
		</section>
	</form>
{/if}

<style>
	.split {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.split.one {
		grid-template-columns: minmax(0, 1fr);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	legend {
		padding: 0 4px var(--space-2);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.choice {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		cursor: pointer;
	}
	.choice.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.choice input {
		margin: 3px 0 0;
		accent-color: var(--accent);
		width: 18px;
		height: 18px;
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.hint {
		margin-left: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--accent);
	}
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
		line-height: 1.45;
	}
	.more {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 4px;
		color: var(--ink-muted);
		font-weight: 600;
		text-align: left;
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
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field > span:first-child {
		font-weight: 600;
	}
	.field input {
		min-height: var(--target);
		box-sizing: border-box;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--sheet);
	}
	.aside {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.go {
		min-height: 46px;
		border-radius: 23px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		font-size: 15px;
	}
	.go:disabled {
		opacity: 0.5;
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
	.short {
		color: var(--alert);
	}
</style>
