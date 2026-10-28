<script lang="ts">
	import { momentOf } from '#lib/when.js';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { theme, type ThemeChoice } from '#lib/theme.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { BAR_SIZE, PALETTES, barOf, paletteOf } from '#lib/layers.js';
	import BarChooser from '#lib/components/BarChooser.svelte';
	import { roleName } from '#lib/people.js';
	import { changeMyPassword } from '#lib/peopleAdmin.js';
	import { onMount } from 'svelte';
	import { core } from '#lib/core.svelte.js';
	import { browserOf } from '#lib/systemAdmin.js';
	import { units, type Measures, type TemperatureUnit } from '#lib/units.js';

	// ---- where you're signed in (homeCore 0.1.83) ----
	interface SignedIn {
		id: string;
		user_agent: string;
		started_at?: string | null;
		last_active: string;
		/** This browser (core 0.1.84). */
		current?: boolean;
	}
	let sessions = $state<SignedIn[] | null>(null);
	let sessionNote = $state<string | null>(null);
	// The newest few; the rest on asking (an old browser left signed in, a script).
	let allSessions = $state(false);
	const shownSessions = $derived(sessions ? (allSessions ? sessions : sessions.slice(0, 8)) : []);
	async function loadSessions() {
		const res = await fetch('/api/v1/auth/sessions').catch(() => null);
		sessions = res?.ok ? ((await res.json()) as SignedIn[]) : null;
	}
	onMount(() => {
		if (!session.isDisplay && !session.me?.unlocked_on) void loadSessions();
	});
	const day = (iso: string) => momentOf(iso, Date.now(), true);
	async function endSession(x: SignedIn) {
		const res = await fetch(`/api/v1/auth/sessions/${encodeURIComponent(x.id)}`, {
			method: 'DELETE'
		}).catch(() => null);
		// Since homeCore 0.1.84 it ends at once; before, it lasted until its
		// access token ran out — a day by default.
		sessionNote = res?.ok
			? core.since('0.1.84')
				? `${browserOf(x.user_agent)} is signed out.`
				: `${browserOf(x.user_agent)} is signed out within a day.`
			: 'homeCore didn’t end it.';
		await loadSessions();
	}
	async function endAll() {
		const yes = await ask({
			title: 'Sign out everywhere?',
			body: 'Every browser and app signed in as you, this one included. Your API keys keep working.',
			go: 'Sign out everywhere',
			danger: true
		});
		if (!yes) return;
		const res = await fetch('/api/v1/auth/sessions/end-all', { method: 'POST' }).catch(() => null);
		if (!res?.ok) return void (sessionNote = 'homeCore didn’t sign you out.');
		await session.signOut();
		void goto('/', { replace: true });
	}

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

	// ---- units: theirs, else this browser's language says ----
	const myUnits = $derived(units());
	const temperatures: { value: TemperatureUnit; label: string }[] = [
		{ value: 'F', label: '°F' },
		{ value: 'C', label: '°C' }
	];
	const measures: { value: Measures; label: string }[] = [
		{ value: 'us', label: 'inHg · mph · in' },
		{ value: 'metric', label: 'hPa · m/s · mm' }
	];

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

	// ---- their password (A5): every session ends, this one too ----
	let changingPassword = $state(false);
	let current = $state('');
	let next = $state('');
	let passwordNote = $state<string | null>(null);
	async function savePassword(e: SubmitEvent) {
		e.preventDefault();
		if (next.length < 8) return void (passwordNote = 'The new one needs at least 8 characters.');
		const r = await changeMyPassword(current, next);
		if (!r.ok) return void (passwordNote = r.error);
		await session.signOut();
		void goto('/login?changed=1');
	}

	async function signOut() {
		await session.signOut();
		void goto('/login');
	}
</script>

<div class="stack">
	<section>
		<p class="who">{session.me?.username}</p>
		<p class="role">{session.me ? roleName(session.me.role) : ''}</p>
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
		<h2 class="section-label" id="units">Units</h2>
		<p class="note">
			How readings are shown to you. Only yours — homeCore keeps them in °C and metric.
		</p>
		<div class="segmented two" role="radiogroup" aria-label="Temperature">
			{#each temperatures as c (c.value)}
				<button
					role="radio"
					aria-checked={myUnits.temperature === c.value}
					onclick={() => void personal.setUnits({ temperature: c.value })}>{c.label}</button
				>
			{/each}
		</div>
		<div class="segmented two" role="radiogroup" aria-label="Pressure, wind and rain">
			{#each measures as c (c.value)}
				<button
					role="radio"
					aria-checked={myUnits.measures === c.value}
					onclick={() => void personal.setUnits({ measures: c.value })}>{c.label}</button
				>
			{/each}
		</div>
		{#if personal.doc.units !== undefined}
			<button
				class="link"
				onclick={() => void personal.setUnits({ temperature: undefined, measures: undefined })}
				>Back to this device's language</button
			>
		{/if}
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
				<button class="link" onclick={removePin}>Remove PIN…</button>
			</div>
		{/if}
		{#if pinNote}<p class="note" role="status">{pinNote}</p>{/if}
	</section>

	{#if !session.isDisplay && !session.me?.unlocked_on}
		{#if sessions && core.since('0.1.83')}
			<section>
				<h2 class="section-label" id="sessions">Signed in</h2>
				<p class="note">Each browser and app signed in as you, newest first.</p>
				<ul class="sessions">
					{#each shownSessions as x (x.id)}
						<li>
							<span
								><strong
									>{browserOf(x.user_agent)}{#if x.current}<span class="this">
											· this one</span
										>{/if}</strong
								>
								<span class="note"
									>{x.started_at ? `since ${day(x.started_at)}` : ''}{x.started_at ? ' · ' : ''}last
									active {day(x.last_active)}</span
								></span
							>
							{#if x.current}
								<button class="link" onclick={() => session.signOut()}>Sign out</button>
							{:else}
								<button class="link" onclick={() => endSession(x)}>Sign it out</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if sessions.length > shownSessions.length}
					<button class="link" onclick={() => (allSessions = true)}
						>Show all {sessions.length}</button
					>
				{/if}
				<button class="link" onclick={endAll}>Sign out everywhere</button>
				{#if sessionNote}<p class="note" role="status">{sessionNote}</p>{/if}
			</section>
		{/if}

		<section>
			<h2 class="section-label" id="keys">API keys</h2>
			<p class="note">
				Keys let a program — a script, another app — use homeCore as you, with no more than you may. <a
					href="/settings/people/keys">Your keys</a
				>
			</p>
		</section>

		<section>
			<h2 class="section-label" id="password">Password</h2>
			{#if changingPassword}
				<form class="pin" onsubmit={savePassword}>
					<input
						type="password"
						autocomplete="current-password"
						placeholder="Your password now"
						aria-label="Your password now"
						bind:value={current}
						required
					/>
					<input
						type="password"
						autocomplete="new-password"
						placeholder="New password"
						aria-label="New password"
						bind:value={next}
						required
					/>
					<button type="submit">Change</button>
				</form>
				<p class="note">
					You’re signed out everywhere, this screen too, and sign in with the new one.
				</p>
			{:else}
				<button class="link" onclick={() => (changingPassword = true)}>Change your password</button>
			{/if}
			{#if passwordNote}<p class="note" role="status">{passwordNote}</p>{/if}
		</section>
	{/if}

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
	}
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		padding: 4px;
		border-radius: 26px;
		background: var(--surface-2);
	}
	.segmented.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
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
	.this {
		font-weight: 400;
		color: var(--ink-muted);
	}
	.sessions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sessions li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.sessions li > span {
		display: flex;
		flex-direction: column;
	}
</style>
