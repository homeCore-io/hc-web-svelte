<script lang="ts">
	import MaterialIcon from '$lib/components/ui/MaterialIcon.svelte';
	import { authState } from '$lib/stores/auth.svelte';

	let username = $state('');
	let password = $state('');
	let localError = $state<string | null>(null);

	async function submit() {
		localError = null;
		try {
			await authState.login(username.trim(), password);
		} catch (error) {
			localError = error instanceof Error ? error.message : 'Login failed';
		}
	}
</script>

<div class="login-shell">
	<section class="login-card">
		<div>
			<div class="brand-mark" aria-hidden="true">
				<MaterialIcon name="home" size={22} />
			</div>
			<h1>HomeCore</h1>
			<p>Sign in to the Svelte web client.</p>
		</div>

		<label>
			<span>Username</span>
			<input bind:value={username} autocomplete="username" />
		</label>

		<label>
			<span>Password</span>
			<input bind:value={password} autocomplete="current-password" type="password" />
		</label>

		{#if localError || authState.error}
			<p class="error">{localError ?? authState.error}</p>
		{/if}

		<button type="button" disabled={authState.loggingIn} onclick={submit}>
			{authState.loggingIn ? 'Signing in…' : 'Sign in'}
		</button>
	</section>
</div>

<style>
	.login-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)),
			repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(21, 101, 192, 0.035) 48px);
	}

	.login-card {
		width: min(440px, 100%);
		padding: 1.25rem;
		border-radius: 0.8rem;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid var(--hc-border);
		display: grid;
		gap: 0.9rem;
	}

	.brand-mark {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border-radius: 0.55rem;
		background: var(--hc-accent-soft);
		color: var(--hc-accent);
		margin-bottom: 0.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
	}

	p {
		margin: 0.3rem 0 0;
		color: var(--hc-text-muted);
	}

	label {
		display: grid;
		gap: 0.4rem;
	}

	span {
		font-size: 0.92rem;
		font-weight: 600;
	}

	button {
		font: inherit;
		font-weight: 700;
		color: var(--hc-surface);
		background: var(--hc-accent);
		border-color: var(--hc-accent);
	}

	.error { color: var(--hc-danger); }
</style>
