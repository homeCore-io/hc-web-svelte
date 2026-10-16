<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { theme, type ThemeChoice } from '#lib/theme.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { BAR_SIZE, PALETTES, barOf, paletteOf } from '#lib/layers.js';
	import BarChooser from '#lib/components/BarChooser.svelte';

	// ---- the phone bar (N2): their own, else the household's ----
	const bar = $derived(
		barOf(
			personal.doc,
			rooms.list.map((r) => r.id),
			household.doc
		)
	);
	const setBar = (next: string[]) => personal.change((d) => ({ ...d, bar: next }));
	function usualBar() {
		void personal.change((d) => {
			const { bar: _drop, ...rest } = d;
			return rest;
		});
	}

	// ---- theme (D9a): the house's, unless they choose another ----
	const houseTheme = $derived(PALETTES.find((p) => p.id === paletteOf(undefined, household.doc)));
	const myTheme = $derived(personal.doc.palette);
	function setTheme(id: string | undefined) {
		void personal.change((d) => {
			const { palette: _drop, ...rest } = d;
			return id === undefined ? rest : { ...rest, palette: id };
		});
	}

	const choices: { value: ThemeChoice; label: string }[] = [
		{ value: 'system', label: 'Like this device' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	// ---- a PIN, for unlocking a display (H5) ----
	let pin = $state('');
	let password = $state('');
	let pinNote = $state<string | null>(null);
	let settingPin = $state(false);
	async function savePin(e: SubmitEvent) {
		e.preventDefault();
		const res = await fetch('/api/v1/auth/pin', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin, password })
		}).catch(() => null);
		const said = (await res?.json().catch(() => ({}))) as { error?: string };
		pinNote = res?.ok ? 'Your PIN is set.' : (said.error ?? 'Couldn’t set it.');
		if (res?.ok) {
			pin = password = '';
			settingPin = false;
			await session.load();
		}
	}
	async function removePin() {
		const yes = await ask({
			title: 'Remove your PIN?',
			body: 'You won’t be able to unlock displays until you set one again.',
			go: 'Remove PIN',
			danger: true
		});
		if (!yes) return;
		await fetch('/api/v1/auth/pin', { method: 'DELETE' }).catch(() => null);
		pinNote = 'Your PIN is removed.';
		await session.load();
	}

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

	<section>
		<h2 class="section-label" id="palette">Theme</h2>
		<div class="swatches" role="radiogroup" aria-labelledby="palette">
			<button role="radio" aria-checked={myTheme === undefined} onclick={() => setTheme(undefined)}>
				<span class="swatch" style:background={houseTheme?.swatch}></span>
				The house's ({houseTheme?.name})
			</button>
			{#each PALETTES as p (p.id)}
				<button role="radio" aria-checked={myTheme === p.id} onclick={() => setTheme(p.id)}>
					<span class="swatch" style:background={p.swatch}></span>
					{p.name}
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="section-label" id="bar">Phone bar</h2>
		<p class="note">Up to {BAR_SIZE} places at the bottom of your phone, then More. Only yours.</p>
		<BarChooser {bar} label="Your phone bar" set={setBar} />
		{#if personal.doc.bar !== undefined}
			<button class="link" onclick={usualBar}>Back to the household's bar</button>
		{/if}
	</section>

	<section>
		<h2 class="section-label" id="pin">PIN for displays</h2>
		<p class="note">
			Unlocks the full app, as you, for a few minutes on a kitchen panel or hall tablet. 4 to 8
			digits; nobody else in the house can have the same one.
		</p>
		{#if settingPin || !session.me?.has_pin}
			<form class="pin" onsubmit={savePin}>
				<input
					type="password"
					inputmode="numeric"
					pattern="[0-9]{'{'}4,8{'}'}"
					autocomplete="off"
					placeholder="New PIN"
					aria-label="New PIN"
					bind:value={pin}
					required
				/>
				<input
					type="password"
					autocomplete="current-password"
					placeholder="Your password"
					aria-label="Your password"
					bind:value={password}
					required
				/>
				<button type="submit">Set PIN</button>
			</form>
		{:else}
			<div class="row">
				<button class="link" onclick={() => (settingPin = true)}>Change your PIN</button>
				<button class="link" onclick={removePin}>Remove it</button>
			</div>
		{/if}
		{#if pinNote}<p class="note" role="status">{pinNote}</p>{/if}
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
	.note {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		color: var(--accent);
		font-weight: 600;
		padding: 0;
		min-height: var(--target);
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
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.swatches button {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 14px 0 10px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
	}
	.swatches button[aria-checked='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.swatch {
		width: 18px;
		height: 18px;
		border-radius: 50%;
	}
	.pin {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pin input {
		flex: 1 1 140px;
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.pin button {
		min-height: var(--target);
		padding: 0 18px;
		border-radius: 22px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	.row {
		display: flex;
		gap: 20px;
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
