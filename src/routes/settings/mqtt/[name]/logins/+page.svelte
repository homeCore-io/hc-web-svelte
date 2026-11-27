<!--
	An ecosystem's device logins (Devices over MQTT, screen 5): each device
	that talks to homeCore's broker itself logs in with its own name and
	password. A new login's password is shown once, with what to type into
	the device; a new password, or removing the login, shuts the old one out.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { agoOf } from '#lib/when.js';
	import { loadBroker, type BrokerStatus } from '#lib/pluginAdmin.js';
	import EcoTabs from '#lib/components/mqtt/EcoTabs.svelte';
	import {
		addLogin,
		ecosystemName,
		loadLogins,
		loadProfile,
		removeLogin,
		resetLogin,
		slug,
		type DeviceLogin
	} from '#lib/mqttDevices.js';

	const name = $derived(page.params.name ?? '');
	const label = $derived(ecosystemName(name));
	$effect(() => heading.show(label, { href: '/settings/mqtt', label: 'Devices over MQTT' }));

	let file = $state<string | null>(null);
	let logins = $state<DeviceLogin[] | null>(null);
	let asks = $state<boolean | null>(null);
	let broker = $state<BrokerStatus | null>(null);
	let failed = $state<string | null>(null);
	let note = $state<string | null>(null);
	let busy = $state(false);
	let adding = $state(false);
	let newLabel = $state('');
	let newUser = $state('');
	/** A password just made: shown this once. */
	let shown = $state<{ user: string; password: string } | null>(null);
	let copied = $state(false);

	// Where a device reaches the broker: its own address when it names one, else
	// this homeCore's, as the browser reached it (a broker listening on every
	// address, or only this machine, names none a device can use).
	const brokerHost = $derived(
		broker && !['0.0.0.0', '::', '127.0.0.1', 'localhost', '::1'].includes(broker.host)
			? broker.host
			: page.url.hostname
	);

	// The device's own name, by its label: "Garage plug" → "tasmota-garage-plug".
	const suggestedUser = $derived(newLabel.trim() ? `${slug(name)}-${slug(newLabel)}` : '');

	async function load() {
		const asking = name;
		const [l, p, b] = await Promise.all([loadLogins(asking), loadProfile(asking), loadBroker()]);
		if (asking !== name) return;
		if (!l.ok) return void (failed = l.error);
		failed = null;
		logins = l.data.logins;
		asks = l.data.broker_asks;
		if (p.ok) file = p.data.profile.file;
		if (b.ok) broker = b.data;
	}
	// Each ecosystem from the start; a password shown for one isn't for the next.
	$effect(() => {
		void name;
		untrack(() => {
			shown = null;
			note = failed = null;
			void load();
		});
	});

	async function add() {
		const user = (newUser.trim() || suggestedUser).trim();
		if (!user) return void (note = 'Say what the login is for.');
		busy = true;
		const r = await addLogin(name, user, newLabel.trim());
		busy = false;
		if (!r.ok) return void (note = r.error);
		note = null;
		shown = r.data;
		copied = false;
		adding = false;
		newLabel = '';
		newUser = '';
		await load();
	}

	async function reset(l: DeviceLogin) {
		const yes = await ask({
			title: `A new password for ${l.user}?`,
			body: 'The old one stops working: the device can’t connect with it again until it has the new one.',
			go: 'New password'
		});
		if (!yes) return;
		const r = await resetLogin(l.user);
		if (!r.ok) return void (note = r.error);
		shown = { user: l.user, password: r.data.password };
		copied = false;
	}

	async function remove(l: DeviceLogin) {
		const yes = await ask({
			title: `Remove ${l.user}?`,
			body: 'The device can’t connect with it again. One connected now stays until it drops.',
			go: 'Remove',
			danger: true
		});
		if (!yes) return;
		const r = await removeLogin(l.user);
		note = r.ok ? `${l.user} removed.` : r.error;
		if (shown?.user === l.user) shown = null;
		await load();
	}

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Devices over MQTT are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">{failed} <a href="/settings/mqtt">All ecosystems</a></p>
{:else if !logins}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<EcoTabs {name} {file} current="logins" />
		<p class="lead">
			Each {label} device logs in to homeCore’s broker with its own name and password. A new password,
			or removing a login, shuts the old one out.
		</p>
		{#if asks === false}
			<p class="note">
				The broker is only on this machine and doesn’t ask for logins yet. Once it’s open to the
				network it asks every device for one; make them here first.
				{#if broker && !broker.reachable_from_network}<a href="/settings/plugins/runtimes"
						>Open the broker</a
					>{/if}
			</p>
		{/if}
		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if shown}
			<section class="shown" aria-label="New password">
				<div class="split">
					<h2>Login for {shown.user}</h2>
					<span class="warn">The password is shown this once</span>
				</div>
				<div class="grid">
					<div class="cell"><span>Host</span><b class="mono">{brokerHost}</b></div>
					<div class="cell"><span>Port</span><b class="mono">{broker?.port ?? '—'}</b></div>
					<div class="cell"><span>User</span><b class="mono">{shown.user}</b></div>
					<div class="cell pw">
						<span>Password</span><b class="mono">{shown.password}</b>
						<button type="button" class="btn" onclick={() => copy(shown!.password)}
							>{copied ? 'Copied' : 'Copy'}</button
						>
					</div>
				</div>
				<p class="quiet">
					Type these into the device’s MQTT settings{name === 'tasmota'
						? ' (in Tasmota: Configuration › MQTT)'
						: ''}.
				</p>
				<div class="actions">
					<button type="button" class="done" onclick={() => (shown = null)}>Done</button>
				</div>
			</section>
		{/if}

		<div class="split">
			<h2>Logins</h2>
			{#if !adding}<button type="button" class="btn" onclick={() => (adding = true)}
					>Add a login</button
				>{/if}
		</div>

		{#if adding}
			<form
				class="add"
				onsubmit={(e) => {
					e.preventDefault();
					void add();
				}}
			>
				<label
					>What it’s for<input type="text" bind:value={newLabel} placeholder="Garage plug" /></label
				>
				<label
					>User<input
						type="text"
						class="mono"
						bind:value={newUser}
						placeholder={suggestedUser || `${slug(name)}-garage-plug`}
					/></label
				>
				<div class="actions">
					<button type="button" class="btn" onclick={() => (adding = false)}>Cancel</button>
					<button type="submit" class="done" disabled={busy}>Make it</button>
				</div>
			</form>
		{/if}

		{#if logins.length === 0}
			<p class="quiet">None yet.</p>
		{:else}
			<ul class="list">
				{#each logins as l (l.user)}
					<li>
						<span class="text">
							<span class="mono name">{l.user}</span>
							<span class="sub"
								>{l.label || 'No note'} · {l.last_login
									? `connected ${agoOf(l.last_login)}`
									: 'not connected since homeCore started'}</span
							>
						</span>
						<button type="button" class="btn" onclick={() => reset(l)}>New password</button>
						<button type="button" class="btn" onclick={() => remove(l)}>Remove</button>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="quiet">
			homeCore’s own broker checks each login, not which topics it uses. For that, run an external
			Mosquitto (Settings › Configuration › MQTT broker).
		</p>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 900px;
	}
	.lead {
		margin: 0;
		color: var(--ink-muted);
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.split {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.shown {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 2px solid var(--accent);
	}
	.warn {
		color: var(--alert);
		font-weight: 700;
		font-size: 14px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 8px;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg);
	}
	.cell span {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.cell b {
		font-weight: 500;
		overflow-wrap: anywhere;
	}
	.cell.pw {
		position: relative;
		padding-right: 90px;
	}
	.cell.pw .btn {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
	}
	.mono {
		font-family: var(--font-num);
		font-size: 14px;
	}
	.add {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.add label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 700;
		font-size: 14px;
	}
	.add input {
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 11px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 500;
	}
	.add .actions {
		grid-column: 1 / -1;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}
	.btn,
	.done {
		min-height: 40px;
		padding: 0 14px;
		border-radius: 10px;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
	}
	.btn {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.done {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		padding: 10px 14px;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.text {
		flex: 1 1 240px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
