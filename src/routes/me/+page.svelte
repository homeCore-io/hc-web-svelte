<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { theme, type ThemeChoice } from '#lib/theme.svelte.js';

	const choices: { value: ThemeChoice; label: string }[] = [
		{ value: 'system', label: 'Like this device' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	async function signOut() {
		await session.signOut();
		void goto('/login');
	}
</script>

<div class="stack">
	<section>
		<p class="who">{session.me?.username}</p>
		<p class="role">{session.me?.role}</p>
	</section>

	<section>
		<h2 class="section-label" id="appearance">Appearance</h2>
		<div class="segmented" role="radiogroup" aria-labelledby="appearance">
			{#each choices as c (c.value)}
				<button
					role="radio"
					aria-checked={theme.choice === c.value}
					onclick={() => theme.set(c.value)}>{c.label}</button
				>
			{/each}
		</div>
	</section>

	<button class="out" onclick={signOut}>Sign out</button>
</div>

<style>
	.stack {
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-2);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.who {
		margin: 0;
		font-size: 19px;
		font-weight: 700;
	}
	.role {
		margin: 0;
		color: var(--ink-muted);
		text-transform: capitalize;
	}
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		padding: 4px;
		border-radius: 26px;
		background: var(--surface-2);
	}
	.segmented button {
		height: 40px;
		border: none;
		border-radius: 20px;
		background: none;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.segmented button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.out {
		align-self: flex-start;
		height: var(--target);
		padding: 0 var(--space-5);
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
	}
</style>
