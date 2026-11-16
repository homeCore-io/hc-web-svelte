<!--
	Plugin runtimes: containers you run yourself that host plugins written in
	other languages. Add one here; homeCore makes its login and shows its key
	once, to paste into the runtime's own page (or set as HC_RUNTIME_KEY).
	Mockups: the "Plugin runtime setup" canvas (Main, Key, Joined).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ask } from '#lib/confirm.svelte.js';
	import { restart } from '#lib/config.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ago } from '#lib/card.js';
	import { pluginLabel } from '#lib/inventory.js';
	import {
		addRuntime,
		loadBroker,
		loadPlacements,
		loadRuntimes,
		openBroker,
		removeRuntime,
		resetRuntime,
		updateRuntime,
		type BrokerStatus,
		type IssuedKey,
		type Placement,
		type Runtime
	} from '#lib/pluginAdmin.js';
	import { copyText, homecoreUrlFrom, nextName, runtimeState } from '#lib/runtimes.js';

	$effect(() => heading.show('Plugin runtimes', { href: '/settings/plugins', label: 'Plugins' }));

	let runtimes = $state<Runtime[] | null>(null);
	let placements = $state<Placement[]>([]);
	let broker = $state<BrokerStatus | null>(null);
	let note = $state<string | null>(null);
	let unlisted = $state(false);
	/** A key just made: shown once, then gone with Done. */
	let issued = $state<IssuedKey | null>(null);
	let detailsOpen = $state(false);
	let showSecret = $state(false);
	let copied = $state<string | null>(null);
	/** Which runtimes in the list have Show details open. */
	let shown = $state<Record<string, boolean>>({});

	async function load() {
		const [r, p, b] = await Promise.all([loadRuntimes(), loadPlacements(), loadBroker()]);
		if (!r.ok) {
			unlisted = runtimes === null;
			return void (note = r.error);
		}
		unlisted = false;
		runtimes = r.data.runtimes;
		if (p.ok) placements = p.data;
		if (b.ok) broker = b.data;
	}
	onMount(() => {
		void load();
		const t = setInterval(load, 5_000);
		return () => clearInterval(t);
	});
	const hosted = (id: string) => placements.filter((p) => p.runtime_id === id);
	const when = (iso?: string) => (iso ? `${ago(clock.now - Date.parse(iso))} ago` : '');
	/** The issued runtime as the list has it now, for its live status. */
	const issuedNow = $derived(
		issued
			? (runtimes?.find((r) => r.runtime_id === issued!.runtime.runtime_id) ?? issued.runtime)
			: null
	);

	// ---- Add a runtime ----
	let dialog = $state<HTMLDialogElement | null>(null);
	let name = $state('');
	let url = $state('');
	/** Blank: no limit. */
	let limit = $state<number | null>(null);
	let adding = $state(false);
	let addError = $state<string | null>(null);
	function openAdd() {
		name = nextName(runtimes ?? []);
		url = homecoreUrlFrom(location);
		limit = null;
		addError = null;
		dialog?.showModal();
	}
	async function add() {
		adding = true;
		addError = null;
		const r = await addRuntime({
			name,
			kind: 'python',
			homecore_url: url,
			max_plugins: limit ?? undefined
		});
		adding = false;
		if (!r.ok) return void (addError = r.error);
		dialog?.close();
		show(r.data);
		await load();
	}
	function show(k: IssuedKey) {
		issued = k;
		detailsOpen = false;
		showSecret = false;
		copied = null;
		window.scrollTo({ top: 0 });
	}
	async function copy(what: string, text: string) {
		copied = (await copyText(text)) ? what : null;
		if (!copied) note = 'This browser would not copy it. Select it and copy it by hand.';
	}

	// ---- The plugin limit ----
	let editingLimit = $state<string | null>(null);
	let limitDraft = $state<number | null>(null);
	function setLimit(r: Runtime) {
		editingLimit = r.runtime_id;
		limitDraft = r.max_plugins ?? null;
	}
	async function saveLimit(r: Runtime) {
		const res = await updateRuntime(r.runtime_id, { max_plugins: limitDraft || null });
		if (!res.ok) note = res.error;
		else
			note = res.data.max_plugins
				? `${r.name} may hold ${res.data.max_plugins} plugins.`
				: `${r.name} has no limit.`;
		editingLimit = null;
		await load();
	}

	// ---- Reset, remove, open the broker ----
	async function reset(r: Runtime) {
		const yes = await ask({
			title: `A new key for ${r.name}?`,
			body: 'The old key stops working now. The runtime disconnects until the new key is pasted in. Its plugins keep their own logins and come back when it does.',
			go: 'Reset login',
			danger: true
		});
		if (!yes) return;
		const res = await resetRuntime(r.runtime_id);
		if (!res.ok) return void (note = res.error);
		show(res.data);
		await load();
	}
	async function remove(r: Runtime) {
		const mine = hosted(r.runtime_id);
		const yes = await ask({
			title: `Remove ${r.name}?`,
			body: 'Its key stops working. The container is yours to stop.',
			lost: mine.length
				? mine.map((p) => `${pluginLabel(p.plugin_id)}, its devices and its settings`)
				: undefined,
			go: 'Remove',
			danger: true
		});
		if (!yes) return;
		const res = await removeRuntime(r.runtime_id);
		note = res.ok ? `${r.name} was removed.` : res.error;
		if (issued?.runtime.runtime_id === r.runtime_id) issued = null;
		await load();
	}
	async function open() {
		const yes = await ask({
			title: 'Open the broker to the network?',
			body: 'homeCore restarts to make the change. Devices and plugins reconnect by themselves a few seconds later. The broker asks every connection for a login.',
			go: 'Open and restart'
		});
		if (!yes) return;
		const res = await openBroker();
		if (!res.ok) return void (note = res.error);
		const failed = await restart();
		note = failed ?? 'homeCore is restarting with the broker open to the network.';
	}

	const stateWords = {
		waiting: 'Waiting for it to connect',
		connected: 'Connected',
		quiet: 'Not heard from'
	};
</script>

{#if !session.can('plugins:write')}
	<p class="quiet">Plugin runtimes are for people who may change plugins.</p>
{:else if issued && issuedNow}
	{@const k = issued.details}
	{@const st = runtimeState(issuedNow, clock.now)}
	<div class="page">
		<button type="button" class="back" onclick={() => (issued = null)}>‹ Plugin runtimes</button>
		<div class="title">
			<h2>{issuedNow.name}</h2>
			<span class="pill {st}"
				><i aria-hidden="true"></i>{st === 'quiet'
					? `Not heard from since ${when(issuedNow.last_seen_at)}`
					: stateWords[st]}</span
			>
		</div>

		<section class="card" aria-label="Connection key">
			<div class="head">
				<h3>Connection key</h3>
				<p class="quiet">
					Everything the runtime needs, in one line. It's shown only now; if it's lost, make a new
					one with Reset login.
				</p>
			</div>
			<div class="keyrow">
				<code class="key">{issued.key}</code>
				<button type="button" class="go" onclick={() => copy('key', issued!.key)}
					>{copied === 'key' ? 'Copied' : 'Copy'}</button
				>
			</div>
			<div class="ways">
				<div class="way">
					<b>Paste it into the runtime's page</b>
					<span class="quiet">Open the runtime in a browser, on port 8790 of wherever it runs.</span
					>
					<code>http://[runtime host]:8790</code>
				</div>
				<div class="way">
					<b>Or set it when you start the container</b>
					<span class="quiet">For compose files and scripts.</span>
					<code>HC_RUNTIME_KEY={issued.key.slice(0, 10)}…</code>
				</div>
			</div>
		</section>

		<section class="card details" aria-label="Details">
			<button
				type="button"
				class="toggle"
				aria-expanded={detailsOpen}
				onclick={() => (detailsOpen = !detailsOpen)}
			>
				<span class="chev" class:open={detailsOpen} aria-hidden="true">›</span>
				{detailsOpen ? 'Hide details' : 'Show details'}
				<span class="quiet">What's inside the key, for setting a runtime up by hand</span>
			</button>
			{#if detailsOpen}
				<dl class="fields">
					{#each [{ label: 'homeCore address', value: k.url }, { label: 'Broker', value: `${k.broker_host}:${k.broker_port}` }, { label: 'Runtime id (username)', value: k.username }] as f (f.label)}
						<dt>{f.label}</dt>
						<dd class="mono">{f.value}</dd>
						<dd>
							<button type="button" class="small" onclick={() => copy(f.label, f.value)}
								>{copied === f.label ? 'Copied' : 'Copy'}</button
							>
						</dd>
					{/each}
					<dt>Password</dt>
					<dd class="mono">{showSecret ? k.secret : '••••••••••••••••••••••••'}</dd>
					<dd class="two">
						<button type="button" class="small" onclick={() => (showSecret = !showSecret)}
							>{showSecret ? 'Hide' : 'Show'}</button
						>
						<button type="button" class="small" onclick={() => copy('Password', k.secret)}
							>{copied === 'Password' ? 'Copied' : 'Copy'}</button
						>
					</dd>
					<dt>Language</dt>
					<dd>Python 3.12 ({k.abi})</dd>
					<dd></dd>
				</dl>
				<p class="quiet">
					The password logs the runtime in to both the broker and homeCore. Each plugin you place on
					it gets its own login from homeCore.
				</p>
			{/if}
		</section>
		{#if note}<p class="note" role="status">{note}</p>{/if}
		<div><button type="button" class="plain" onclick={() => (issued = null)}>Done</button></div>
	</div>
{:else}
	<div class="page">
		<div class="title">
			<p class="lead">
				A runtime is a container you run yourself that holds plugins written in Python. Add one
				here, then paste its key into the runtime.
			</p>
			<button type="button" class="go" onclick={openAdd}>Add runtime</button>
		</div>

		{#if broker && !broker.reachable_from_network}
			<section class="warn" aria-label="Broker check">
				<div>
					<b>Runtimes can't reach the broker yet</b>
					<span
						>homeCore's broker only answers on this machine. A runtime in another container or on
						another computer needs it to listen on the network.{broker.can_open
							? ' homeCore restarts to make the change.'
							: ' Set [broker] host = "0.0.0.0" in homecore.toml, with a [[broker.clients]] login, and restart.'}</span
					>
				</div>
				{#if broker.can_open}
					<button type="button" class="plain" onclick={open}>Open the broker to the network</button>
				{/if}
			</section>
		{/if}
		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if runtimes === null}
			{#if !unlisted}<p class="quiet">Loading…</p>{/if}
		{:else if runtimes.length === 0}
			<section class="card empty">
				<b>No runtimes yet</b>
				<span class="quiet">Python plugins in the Catalog need one.</span>
			</section>
		{:else}
			{#each runtimes as r (r.runtime_id)}
				{@const st = runtimeState(r, clock.now)}
				{@const mine = hosted(r.runtime_id)}
				<section class="card rt" aria-label={r.name}>
					<div class="rthead">
						<div class="who">
							<div class="title">
								<b class="name">{r.name}</b>
								<span class="pill {st}"
									><i aria-hidden="true"></i>{st === 'quiet'
										? `Not heard from since ${when(r.last_seen_at)}`
										: stateWords[st]}</span
								>
							</div>
							<span class="quiet"
								>{[
									r.kind === 'python' ? 'Python 3.12' : r.kind,
									r.arch,
									r.host_version ? `host ${r.host_version}` : '',
									r.source_ip ? `from ${r.source_ip}` : '',
									r.last_seen_at ? `seen ${when(r.last_seen_at)}` : ''
								]
									.filter(Boolean)
									.join(' · ')}</span
							>
						</div>
						<div class="acts">
							<button
								type="button"
								class="plain"
								aria-expanded={!!shown[r.runtime_id]}
								onclick={() => (shown[r.runtime_id] = !shown[r.runtime_id])}
								>{shown[r.runtime_id] ? 'Hide details' : 'Show details'}</button
							>
							<button type="button" class="plain" onclick={() => reset(r)}>Reset login</button>
							<button type="button" class="plain danger" onclick={() => remove(r)}>Remove</button>
						</div>
					</div>
					{#if r.outdated}
						<p class="note" role="status">
							This runtime is version {r.host_version}, and homeCore expects {r.min_host_version} or later.
							Pull the newer image and restart its container; its plugins come back by themselves.
						</p>
					{/if}
					{#if shown[r.runtime_id]}
						<dl class="fields two-col">
							<dt>homeCore address</dt>
							<dd class="mono">{r.homecore_url}</dd>
							<dt>Runtime id (username)</dt>
							<dd class="mono">{r.plugin_id}</dd>
							<dt>Password</dt>
							<dd>Shown only when the key is made. Reset login makes a new one.</dd>
							<dt>Language</dt>
							<dd>Python 3.12 ({r.abi})</dd>
							{#if r.hostname}<dt>Container</dt>
								<dd class="mono">
									{r.hostname}{r.network_mode ? ` · ${r.network_mode} network` : ''}
								</dd>{/if}
						</dl>
					{/if}
					<div class="plugins">
						<div class="phead">
							<b
								>Plugins in it <span class="quiet count"
									>{r.max_plugins ? `${mine.length} of ${r.max_plugins}` : 'no limit'}</span
								></b
							>
							{#if editingLimit === r.runtime_id}
								<span class="limit">
									<input
										type="number"
										min="1"
										inputmode="numeric"
										aria-label="Most plugins it may hold"
										placeholder="No limit"
										bind:value={limitDraft}
									/>
									<button type="button" class="small go" onclick={() => saveLimit(r)}>Save</button>
									<button type="button" class="small" onclick={() => (editingLimit = null)}
										>Cancel</button
									>
								</span>
							{:else}
								<button type="button" class="small" onclick={() => setLimit(r)}>Change limit</button
								>
							{/if}
							<a href="/settings/plugins/add">Add from the Catalog</a>
						</div>
						{#if mine.length}
							<ul>
								{#each mine as p (p.plugin_id)}
									<li>
										<a href={`/settings/plugins/${encodeURIComponent(p.plugin_id)}`}
											>{pluginLabel(p.plugin_id)}</a
										>
										<span class="mono quiet">{p.version}</span>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="quiet">
								{st === 'waiting'
									? 'Once it connects, install a Python plugin from the Catalog and choose this runtime.'
									: 'Nothing yet. Install a Python plugin from the Catalog and it goes here.'}
							</p>
						{/if}
					</div>
				</section>
			{/each}
		{/if}
	</div>
{/if}

<dialog bind:this={dialog} aria-label="Add a runtime" class="sheet">
	<form
		method="dialog"
		onsubmit={(e) => {
			e.preventDefault();
			void add();
		}}
	>
		<h3>Add a runtime</h3>
		<p class="quiet">homeCore makes its login now. You'll get one key to paste into the runtime.</p>
		<label>Name <input type="text" bind:value={name} required /></label>
		<fieldset>
			<legend>Language</legend>
			<div class="chips">
				<button type="button" class="chip on" aria-pressed="true">Python 3.12</button>
				<button type="button" class="chip" disabled>Node, later</button>
			</div>
		</fieldset>
		<label
			>How it reaches homeCore
			<input type="text" class="mono" bind:value={url} required spellcheck="false" />
			<span class="quiet"
				>Filled in from the address you're using now. Change it if the runtime reaches homeCore
				another way.</span
			>
		</label>
		<label
			>Most plugins it may hold
			<input type="number" min="1" inputmode="numeric" bind:value={limit} placeholder="No limit" />
			<span class="quiet"
				>A few suit a Raspberry Pi; a large server takes many. Leave it blank for no limit. You can
				change it later.</span
			>
		</label>
		{#if addError}<p class="error" role="alert">{addError}</p>{/if}
		<div class="buttons">
			<button type="button" class="plain" onclick={() => dialog?.close()}>Cancel</button>
			<button type="submit" class="go" disabled={adding}
				>{adding ? 'Adding…' : 'Add and make key'}</button
			>
		</div>
	</form>
</dialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 960px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.title h2 {
		margin: 0;
		font-size: 24px;
	}
	.lead {
		margin: 0;
		flex: 1 1 320px;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.mono {
		font-family: var(--font-num);
		overflow-wrap: anywhere;
	}
	.back {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--accent);
		cursor: pointer;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card h3 {
		margin: 0;
		font-size: 17px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.empty {
		align-items: center;
		padding: 40px;
	}
	.keyrow {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
		flex-wrap: wrap;
	}
	.key {
		flex: 1 1 320px;
		min-width: 0;
		font-family: var(--font-num);
		font-size: 14px;
		line-height: 1.5;
		padding: 12px 14px;
		border-radius: 11px;
		background: var(--surface-2);
		overflow-wrap: anywhere;
	}
	.ways {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--space-3);
	}
	.way {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px;
		border-radius: 12px;
		background: var(--sheet);
		border: 1px solid var(--card-line);
	}
	.way code {
		font-family: var(--font-num);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		font-weight: 800;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.toggle .quiet {
		font-weight: 500;
	}
	.chev {
		display: inline-block;
		transition: transform 0.15s;
	}
	.chev.open {
		transform: rotate(90deg);
	}
	.fields {
		margin: 0;
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr) auto;
		font-size: 14px;
	}
	.fields.two-col {
		grid-template-columns: 200px minmax(0, 1fr);
	}
	.fields dt,
	.fields dd {
		margin: 0;
		padding: 10px var(--space-3) 10px 0;
		border-top: 1px solid var(--line);
	}
	.fields dt {
		color: var(--ink-muted);
		font-weight: 600;
	}
	.fields dd.two {
		display: flex;
		gap: 6px;
	}
	@media (max-width: 640px) {
		.fields,
		.fields.two-col {
			grid-template-columns: 1fr;
		}
		.fields dd {
			border-top: none;
			padding-top: 2px;
		}
	}
	.rthead {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.who {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.name {
		font-size: 18px;
	}
	.acts {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.plugins {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-top: 1px solid var(--line);
		padding-top: var(--space-3);
	}
	.phead {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.phead b {
		flex: 1;
	}
	.count {
		font-weight: 500;
		margin-left: 6px;
	}
	.limit {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.limit input {
		width: 96px;
		height: 32px;
		padding: 0 10px;
		border-radius: var(--radius-chip);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.plugins ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.plugins li {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.plugins li a {
		flex: 1;
		font-weight: 700;
		color: var(--ink);
		text-decoration: none;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 12px;
		border-radius: 14px;
		font-weight: 700;
		font-size: 13px;
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.pill i {
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: currentColor;
	}
	.pill.connected {
		background: color-mix(in srgb, var(--good-ink, #2f9e6a) 14%, transparent);
		color: var(--good-ink, #7fd1a8);
	}
	.pill.quiet {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.warn {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		padding: 14px 16px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.warn div {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.go,
	.plain,
	.small {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.small {
		height: 32px;
		padding: 0 12px;
		font-size: 13px;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.6;
	}
	.danger {
		color: var(--alert);
		border-color: var(--alert-line);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.error {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
	.sheet {
		width: min(520px, calc(100vw - 32px));
		border: none;
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		padding: 28px;
		box-sizing: border-box;
	}
	.sheet::backdrop {
		background: var(--scrim);
	}
	.sheet form {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.sheet h3 {
		margin: 0;
		font-size: 22px;
	}
	.sheet label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 700;
		font-size: 14px;
	}
	.sheet input {
		height: 42px;
		padding: 0 12px;
		border-radius: var(--radius-chip);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 500;
	}
	.sheet input.mono {
		font-family: var(--font-num);
		font-size: 14px;
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	legend {
		font-weight: 700;
		font-size: 14px;
		padding: 0 0 6px;
	}
	.chips {
		display: flex;
		gap: var(--space-2);
	}
	.chip {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
	}
	.chip.on {
		border: 2px solid var(--accent);
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
	}
	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
