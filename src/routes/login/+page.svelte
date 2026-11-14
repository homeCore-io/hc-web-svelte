<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session } from '#lib/me.svelte.js';
	import Mark from '#lib/components/Mark.svelte';

	let username = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = await session.signIn(username, password);
		busy = false;
		if (error === null) void goto('/');
	}
	// Someone already signed in (not a display) is told so, with the way home.
	const signedIn = $derived(session.me !== null && !session.isDisplay ? session.me : null);
	async function signOut() {
		busy = true;
		await session.signOut();
		busy = false;
	}
</script>

<svelte:head><title>Sign in · homeCore</title></svelte:head>

<main>
	<form onsubmit={submit}>
		<h1><Mark size={36} />homeCore</h1>
		{#if signedIn}
			<p class="said" role="status">You’re signed in as <strong>{signedIn.username}</strong>.</p>
			<a class="home" href="/">Go to homeCore</a>
			<button type="button" class="plain" disabled={busy} onclick={signOut}
				>Sign out to sign in as someone else</button
			>
		{:else}
			{#if page.url.searchParams.get('changed')}
				<p class="said" role="status">Your password is changed. Sign in with the new one.</p>
			{/if}
			<label>
				<span>Username</span>
				<input bind:value={username} autocomplete="username" autocapitalize="none" required />
			</label>
			<label>
				<span>Password</span>
				<input type="password" bind:value={password} autocomplete="current-password" required />
			</label>
			{#if error !== null}<p class="error" role="alert">{error}</p>{/if}
			<button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
			<a class="display" href="/display">Set this screen up as a display</a>
		{/if}
	</form>
</main>

<style>
	.said {
		margin: 0;
		color: var(--ink-muted);
		font-size: 14px;
	}
	main {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}
	form {
		width: 100%;
		max-width: 340px;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		box-shadow: var(--shadow);
	}
	h1 {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 var(--space-2);
		font-size: 24px;
		font-weight: 700;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
	}
	input {
		height: var(--target);
		padding: 0 var(--space-3);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		font-size: 16px;
	}
	button {
		height: var(--target);
		border: none;
		border-radius: 22px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 15px;
	}
	.home {
		display: grid;
		place-items: center;
		height: var(--target);
		border-radius: 22px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 15px;
		text-decoration: none;
	}
	button.plain {
		background: none;
		color: var(--ink-muted);
		font-weight: 500;
		font-size: 14px;
	}
	button:disabled {
		opacity: 0.6;
	}
	.error {
		margin: 0;
		color: var(--alert);
	}
	.display {
		text-align: center;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
