<!--
	Make this tablet a display (D7): type the key an admin was shown in
	Settings → Displays. From then on it opens on the display's pages, with no
	sign-in, until the display is removed.
-->
<script lang="ts">
	import { session } from '#lib/me.svelte.js';

	let key = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (session.me !== null && !session.isDisplay) {
			if (!confirm(`This signs ${session.me.username} out here and makes this screen a display.`))
				return;
		}
		busy = true;
		const res = await fetch('/ui/display/enroll', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key })
		}).catch(() => null);
		busy = false;
		if (res?.ok) {
			// A fresh start, as the display.
			location.href = '/';
			return;
		}
		const said = (await res?.json().catch(() => ({}))) as { error?: string };
		error = said.error ?? 'That didn’t work.';
	}
</script>

<svelte:head><title>Set up a display · homeCore</title></svelte:head>

<main>
	<form onsubmit={submit}>
		<h1>Set up a display</h1>
		<p class="note">
			An admin makes the display in Settings → Displays and is shown its key once. Type or paste it
			here.
		</p>
		<label>
			<span>Display key</span>
			<input
				bind:value={key}
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				placeholder="hc_sk_…"
				required
			/>
		</label>
		{#if error !== null}<p class="error" role="alert">{error}</p>{/if}
		<button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Make this a display'}</button>
		<a href="/login">Sign in as a person instead</a>
	</form>
</main>

<style>
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
	button:disabled {
		opacity: 0.6;
	}
	.error {
		margin: 0;
		color: var(--alert);
	}
	.note {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	a {
		text-align: center;
		color: var(--accent);
		font-size: 13px;
		font-weight: 600;
	}
</style>
