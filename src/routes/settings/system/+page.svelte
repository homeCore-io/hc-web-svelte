<!--
	System (A6): how homeCore is — running since when, its plugins, devices,
	alerts, the last backup and storage — how much it writes to its log, its
	versions, and restarting it.
-->
<script lang="ts">
	import { dateOf, fullDateOf, momentOf, timeOf } from '#lib/when.js';
	import { page } from '$app/state';
	import { deviceHref } from '#lib/popup.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { alertIgnores, ignoreAlerts } from '#lib/admin.js';
	import type { AlertIgnore } from '#lib/alerts.js';
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { backupDue, daysAgo, size, uptime } from '#lib/settings.js';
	import { houseDevices } from '#lib/inventory.js';
	import { isRunning } from '#lib/plugins.js';
	import { PRESETS, directiveOf, keptOf, readLevel, type Preset } from '#lib/system.js';
	import { loadConfig } from '#lib/config.js';
	import {
		keepLevel,
		loadLevel,
		loadStatus,
		loadVersions,
		loadUpdates,
		restartAndWait,
		setLevel,
		type Status,
		loadConnections,
		browserOf,
		type Connection
	} from '#lib/systemAdmin.js';
	import { loadStatus as loadPlugins } from '#lib/pluginAdmin.js';
	import { newer, type Latest } from '#lib/updates.js';

	let status = $state<Status | null>(null);
	let failed = $state<string | null>(null);
	let versions = $state<Record<string, unknown>>({});
	let level = $state<string | null>(null);
	let levelMissing = $state(false);
	// Turned off on purpose isn't trouble: counted apart from the ones meant to run.
	let plugins = $state<{ running: number; all: number; off: number } | null>(null);

	let connections = $state<Connection[] | null>(null);
	async function load() {
		const [st, v, l, p, c] = await Promise.all([
			loadStatus(),
			loadVersions(),
			loadLevel(),
			loadPlugins(),
			loadConnections()
		]);
		connections = c.ok ? c.data.connections : null;
		if (!st.ok) return void (failed = st.error);
		failed = null;
		status = st.data;
		if (v.ok) versions = v.data;
		if (l.ok) level = l.data.level;
		else levelMissing = true;
		if (p.ok)
			plugins = {
				running: p.data.filter(isRunning).length,
				all: p.data.filter((x) => x.enabled).length,
				off: p.data.filter((x) => !x.enabled).length
			};
	}
	let updates = $state.raw<{ core?: Latest; app?: Latest }>({});
	onMount(() => {
		void load();
		void loadUpdates().then((u) => {
			if (u.ok) updates = u.data;
		});
		const every = setInterval(load, 30_000);
		return () => clearInterval(every);
	});

	// Counted as the Devices page counts them, plugin scenes left out.
	/** Connections grouped by who, where and which browser — a person's tabs, once. */
	const sameAs = (list: Connection[]) => {
		const by = new Map<
			string,
			{ key: string; user: string; where: string; browser: string; since: string; count: number }
		>();
		for (const c of list) {
			const user = c.user.replace(/^api_key:/, '');
			const where = c.endpoint === 'logs_stream' ? 'the log' : 'the house';
			const browser = browserOf(c.user_agent);
			const key = `${user}|${where}|${browser}`;
			const g = by.get(key);
			if (g) {
				g.count++;
				if (c.connected_at < g.since) g.since = c.connected_at;
			} else by.set(key, { key, user, where, browser, since: c.connected_at, count: 1 });
		}
		return [...by.values()];
	};
	const deviceList = $derived(houseDevices(devices.byId));
	const offline = $derived(deviceList.filter((d) => !d.available).length);
	const since = (iso: string) => {
		const d = new Date(iso);
		const today = d.toDateString() === new Date(clock.now).toDateString();
		return today ? `since ${timeOf(d)} today` : `since ${dateOf(d)}`;
	};

	interface Tile {
		label: string;
		value: string;
		detail: string;
		href?: string;
		bad?: boolean;
	}
	const tiles = $derived.by((): Tile[] => {
		if (!status) return [];
		const due = backupDue(status.last_backup_at, clock.now);
		return [
			{
				label: 'homeCore',
				value: 'Running',
				detail: `${since(status.started_at)} · up ${uptime(status.uptime_seconds)}`
			},
			{
				label: 'Plugins',
				value: plugins
					? `${plugins.running} of ${plugins.all} running`
					: `${status.plugins_active} running`,
				detail:
					plugins && plugins.running < plugins.all
						? 'Some aren’t running'
						: `All well${plugins?.off ? ` · ${plugins.off} turned off` : ''}`,
				href: '/settings/plugins',
				bad: !!plugins && plugins.running < plugins.all
			},
			{
				label: 'Devices',
				value: String(devices.loaded ? deviceList.length : status.devices_total),
				detail: offline ? `${offline} offline` : 'none offline',
				href: '/settings/devices'
			},
			{
				label: 'Alerts',
				value: String(alerts.list.length),
				detail: alerts.list.length ? 'need a look' : 'none now',
				href: '/alerts',
				bad: alerts.list.length > 0
			},
			{
				label: 'Last backup',
				value: status.last_backup_at ? daysAgo(status.last_backup_at, clock.now) : 'None recorded',
				detail: due ? 'Back up now' : fullDateOf(status.last_backup_at!),
				href: '/settings/data',
				bad: due
			},
			{
				label: 'Storage',
				value: size(status.history_db_bytes + status.state_db_bytes),
				detail: `history ${size(status.history_db_bytes)} · everything else ${size(status.state_db_bytes)}`
			}
		];
	});

	// ---- the log level ----
	const reading = $derived(level === null ? null : readLevel(level));
	let editing = $state(false);
	let text = $state('');
	let keep = $state(false);
	let levelNote = $state<string | null>(null);
	async function choose(directive: string, bare: string | null) {
		levelNote = null;
		const r = await setLevel(directive);
		if (!r.ok) return void (levelNote = r.error);
		level = r.data.level;
		editing = false;
		const kept = keep ? keptOf(directive) : null;
		if (kept) {
			// The modules kept before, so ones no longer set apart are taken out.
			const got = await loadConfig();
			const was =
				typeof got === 'string'
					? {}
					: (((got.config.parsed as { logging?: { targets?: Record<string, unknown> } } | null)
							?.logging?.targets ?? {}) as Record<string, unknown>);
			const err = await keepLevel(kept.level, kept.targets, was);
			levelNote = err ?? 'Set, and kept for after a restart.';
		} else
			levelNote =
				keep && !bare
					? 'Set until homeCore restarts — it doesn’t say one level for everything, so it can’t be kept.'
					: 'Set until homeCore restarts.';
	}
	const pick = (p: Preset) => choose(directiveOf(p), PRESETS.find((x) => x.id === p)!.level);

	// ---- versions ----
	const appVersion = __APP_VERSION__;
	const coreNew = $derived(
		status && updates.core && newer(updates.core.version, status.version) ? updates.core : null
	);
	const appNew = $derived(
		updates.app && newer(updates.app.version, appVersion) ? updates.app : null
	);
	const extra = $derived(
		Object.entries(versions).filter(([k, v]) => k !== 'core' && typeof v === 'string') as [
			string,
			string
		][]
	);

	// ---- device firmware: what plugins say is out for their devices ----
	let fwIgnores = $state<AlertIgnore[]>([]);
	$effect(() => {
		void alertIgnores().then((l) => (fwIgnores = l ?? []));
	});
	const skipped = (d: CoreDevice) =>
		fwIgnores.some(
			(i) =>
				i.topic === 'firmware_update' &&
				i.key === d.attributes.firmware_latest &&
				(!i.device_id || i.device_id === d.device_id)
		);
	const firmware = $derived(
		Object.values(devices.byId).filter(
			(d) => d.attributes.firmware_update_available === true && !skipped(d)
		)
	);
	let fwNote = $state('');
	async function installFirmware(d: CoreDevice) {
		const v = String(d.attributes.firmware_latest ?? '');
		if (
			!(await ask({
				title: `Install firmware ${v} on ${displayName(d)}? It goes dark for about a minute; a backup is taken first.`,
				go: 'Install'
			}))
		)
			return;
		fwNote = (await commands.act(d.device_id, 'install_firmware', { version: v }))
			? `Installing ${v} on ${displayName(d)} — its alert says when it's done.`
			: "It couldn't be asked.";
	}
	async function skipFirmware(d: CoreDevice) {
		const r = await ignoreAlerts({
			kind: 'plugin',
			plugin_id: d.plugin_id,
			topic: 'firmware_update',
			device_id: d.device_id,
			key: String(d.attributes.firmware_latest ?? '')
		});
		fwNote = r ?? '';
		fwIgnores = (await alertIgnores()) ?? fwIgnores;
	}

	// ---- restart ----
	let restarting = $state<string | null>(null);
	async function restartNow() {
		const ok = await ask({
			title: 'Restart homeCore?',
			lost: [
				'Every screen in the house disconnects until it’s back.',
				`${plugins ? `Its ${plugins.all} plugins restart` : 'Its plugins restart'}; devices reappear as they reconnect.`,
				'Rules don’t run until it’s back.'
			],
			go: 'Restart'
		});
		if (!ok) return;
		restarting = 'Restarting…';
		const r = await restartAndWait((secs) => (restarting = `Waiting for homeCore… ${secs} s`));
		restarting = r.ok ? `Back after ${r.data.secs} seconds.` : r.error;
		await load();
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">The system is for the house’s admins.</p>
{:else if failed}
	<p class="note bad" role="alert">{failed}</p>
{:else if !status}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<div class="tools">
			<a class="plain" href="/settings/logs">Logs</a>
			<a class="plain" href="/settings/events">Events</a>
			<a class="plain" href="/settings/audit">Audit</a>
			<span class="grow"></span>
			<button class="plain" onclick={restartNow} disabled={restarting === 'Restarting…'}
				>Restart homeCore…</button
			>
		</div>
		{#if restarting}<p class="lit" role="status">{restarting}</p>{/if}

		<div class="tiles">
			{#each tiles as t (t.label)}
				<svelte:element this={t.href ? 'a' : 'div'} href={t.href} class="tile" class:bad={t.bad}>
					<span class="label">{t.label}</span>
					<span class="value">{t.value}</span>
					<span class="detail">{t.detail}</span>
				</svelte:element>
			{/each}
		</div>

		<section class="card">
			<div class="head">
				<h2>How much homeCore writes to its log</h2>
				<a href="/settings/logs">Open the live log</a>
			</div>
			{#if levelMissing}
				<p class="sub">This homeCore can’t change its log level while running.</p>
			{:else if reading}
				<div class="seg" role="radiogroup" aria-label="Log detail">
					{#each PRESETS as p (p.id)}
						<button role="radio" aria-checked={reading.preset === p.id} onclick={() => pick(p.id)}
							>{p.label}</button
						>
					{/each}
					<button
						role="radio"
						aria-checked={reading.preset === null}
						onclick={() => ((editing = true), (text = level ?? ''))}>Custom</button
					>
				</div>
				<p class="sub">
					{reading.preset
						? PRESETS.find((p) => p.id === reading.preset)!.what
						: `Set by hand${reading.level ? `, at ${reading.level} for everything else` : ''}.`}
					{reading.note ?? ''}
				</p>
				<label class="keep"
					><input type="checkbox" bind:checked={keep} /> Keep it after a restart</label
				>
				<p class="sub">
					Exactly: <code>{level}</code>
					{#if !editing}· <button
							class="link"
							onclick={() => ((editing = true), (text = level ?? ''))}>edit as text</button
						>{/if}
				</p>
				{#if editing}
					<form
						class="inline"
						onsubmit={(e) => {
							e.preventDefault();
							void choose(text.trim(), readLevel(text).preset ? readLevel(text).level : null);
						}}
					>
						<input
							bind:value={text}
							aria-label="Log filter"
							spellcheck="false"
							autocomplete="off"
						/>
						<button class="go" type="submit">Set</button>
						<button type="button" class="plain" onclick={() => (editing = false)}>Cancel</button>
					</form>
					<p class="sub">
						A filter like <code>info,hc_core=debug</code>. Keep
						<code>rumqttc::state=info,rumqttd=info</code> in it, or the broker says a lot.
					</p>
				{/if}
				{#if levelNote}<p class="sub" role="status">{levelNote}</p>{/if}
			{/if}
		</section>

		{#if connections}
			<section class="card connected">
				<h2>Connected now</h2>
				<p class="sub">
					Screens following the house live — each tab of the app, each display — and anyone reading
					the log.
				</p>
				{#if connections.length === 0}<p class="sub">Nobody.</p>{/if}
				<!-- The same person, place and browser said once, with how many (#88). -->
				<ul class="conns">
					{#each sameAs(connections) as g (g.key)}
						<li>
							<strong>{g.user}</strong>
							<span class="sub"
								>{g.where} · {g.browser}{g.count > 1 ? ` × ${g.count}` : ''} · since {momentOf(
									g.since,
									Date.now(),
									true
								)}</span
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="card row">
			<span>homeCore <strong class="mono">{status.version}</strong></span>
			<span>this app <strong class="mono">{appVersion}</strong></span>
			{#each extra as [k, v] (k)}<span>{k} <strong class="mono">{v}</strong></span>{/each}
			<span>time zone <strong>{status.timezone}</strong></span>
			<span class="grow"></span>
			<a href="https://homecore-io.github.io/docs/release-notes" target="_blank" rel="noreferrer"
				>Release notes</a
			>
		</section>
		{#if coreNew || appNew}
			<p class="banner info" role="status">
				{#if coreNew}<span
						>homeCore <strong class="mono">{coreNew.version}</strong> is out —
						<a href={coreNew.url} target="_blank" rel="noreferrer">what’s new</a>.</span
					>{/if}
				{#if appNew}<span
						>This app <strong class="mono">{appNew.version}</strong> is out —
						<a href={appNew.url} target="_blank" rel="noreferrer">what’s new</a>.</span
					>{/if}
				<span class="sub">Updating is done where homeCore runs, not from here.</span>
			</p>
		{/if}
		{#if firmware.length}
			<section class="fw">
				<h2 class="section-label">Device firmware</h2>
				<ul>
					{#each firmware as d (d.device_id)}
						{@const a = d.attributes}
						<li>
							<span class="text">
								<a href={deviceHref(d.device_id, page.url)}>{displayName(d)}</a>
								<span class="sub mono"
									>{d.sw_version ?? '?'} → {a.firmware_latest}{a.firmware_status === 'installing'
										? ' · installing…'
										: a.firmware_status === 'failed'
											? ' · the last try failed'
											: ''}</span
								>
							</span>
							<button
								class="go"
								disabled={a.firmware_status === 'installing'}
								onclick={() => installFirmware(d)}>Update…</button
							>
							<button class="plain" onclick={() => skipFirmware(d)}>Skip {a.firmware_latest}</button
							>
						</li>
					{/each}
				</ul>
				{#if fwNote}<p class="sub" role="status">{fwNote}</p>{/if}
			</section>
		{/if}
	</div>
{/if}

<style>
	.fw ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.fw li {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		padding: 10px 12px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.fw .text {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
	}
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.grow {
		flex: 1;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
		gap: var(--space-3);
	}
	@media (min-width: 900px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 18px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		color: var(--ink);
		text-decoration: none;
	}
	.tile.bad {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.tile.bad .value {
		color: var(--alert);
	}
	.label {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.value {
		font-size: 22px;
		font-weight: 700;
	}
	.detail,
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
		margin: 0;
		line-height: 1.45;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card.row {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-5);
		color: var(--ink-muted);
	}
	.card.row strong {
		color: var(--ink);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.head h2 {
		flex: 1;
		margin: 0;
		font-size: 16px;
	}
	a {
		color: var(--accent);
		font-weight: 600;
	}
	.seg {
		align-self: flex-start;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
		border-radius: 22px;
		background: var(--surface-2);
	}
	.seg button {
		height: 36px;
		padding: 0 16px;
		border: none;
		border-radius: 18px;
		background: none;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.keep {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}
	code,
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font-weight: 600;
		font-size: 13px;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.inline input {
		flex: 1 1 260px;
		min-height: 40px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--sheet);
		font-family: var(--font-num);
		font-size: 13px;
	}
	.plain,
	.go {
		min-height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		display: inline-flex;
		align-items: center;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.lit {
		margin: 0;
		padding: 10px 14px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
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
	/* Sized as the other cards' headings, without the browser's margins (#88). */
	.connected h2 {
		margin: 0;
		font-size: 16px;
	}
	.connected > p {
		margin: 0;
	}
	.conns {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.conns li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
	}
	.banner {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 10px 14px;
		border-radius: 12px;
		line-height: 1.45;
		background: var(--surface-2);
		color: var(--ink);
	}
	.banner .sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
