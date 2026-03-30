<script lang="ts">
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
			radial-gradient(circle at top left, rgba(23, 89, 152, 0.22), transparent 32%),
			radial-gradient(circle at bottom right, rgba(213, 75, 50, 0.12), transparent 28%),
			linear-gradient(180deg, #eef3f7, #e6edf4);
	}

	.login-card {
		width: min(440px, 100%);
		padding: 1.5rem;
		border-radius: 1.2rem;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid #d9e4ef;
		box-shadow: 0 18px 48px rgba(16, 33, 50, 0.12);
		display: grid;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.8rem;
	}

	p {
		margin: 0.3rem 0 0;
		color: #5f7286;
	}

	label {
		display: grid;
		gap: 0.4rem;
	}

	span {
		font-size: 0.92rem;
		font-weight: 600;
	}

	input {
		padding: 0.85rem 0.95rem;
		border-radius: 0.85rem;
		border: 1px solid #cfd9e5;
		font: inherit;
	}

	button {
		border: 0;
		border-radius: 999px;
		padding: 0.85rem 1.1rem;
		font: inherit;
		font-weight: 700;
		color: white;
		background: linear-gradient(135deg, #12416b, #215f97);
		cursor: pointer;
	}

	.error {
		color: #b53622;
	}
</style>
