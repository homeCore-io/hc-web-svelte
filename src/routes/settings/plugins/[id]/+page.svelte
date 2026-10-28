<!--
	One plugin (A4): running or not, restart and stop; a newer version; what
	it says is wrong; its actions, talking back as they work; its settings;
	its log; its devices; how much it logs; turning it off or removing it.
-->
<script lang="ts">
	import { timeOf } from '#lib/when.js';
	import { onMount } from 'svelte';
	import { core } from '#lib/core.svelte.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { ago, cap, kindOf } from '#lib/card.js';
	import { kindLabel, knownPluginName, pluginLabel } from '#lib/inventory.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import {
		LEVELS,
		buttonOf,
		dangerous,
		latestOf,
		sizeOf,
		stateOf,
		updateOf,
		versionOf,
		type LogLine,
		type PluginRecord,
		type RegistryPlugin
	} from '#lib/plugins.js';
	import {
		install,
		lifecycle,
		loadLogs,
		loadPlacements,
		loadPlugin,
		loadRuntimes,
		loadRegistry,
		removeDevices,
		setEnabled,
		setLogLevel,
		runtimeName,
		uninstall,
		wasPlaced
	} from '#lib/pluginAdmin.js';
	import ActionRun from '#lib/components/plugins/ActionRun.svelte';
	import PluginSettings from '#lib/components/plugins/PluginSettings.svelte';
	import MatterPanel from '#lib/components/plugins/MatterPanel.svelte';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';

	const id = $derived(page.params.id ?? '');
	const tab = $derived(page.url.searchParams.get('tab') ?? 'overview');
	const setTab = (t: string) => {
		const u = new URL(page.url.href);
		u.searchParams.delete('s');
		if (t === 'overview') u.searchParams.delete('tab');
		else u.searchParams.set('tab', t);
		void goto(`${u.pathname}${u.search}`, { replace: true, reset: false });
	};

	let plugin = $state<PluginRecord | null>(null);
	let failed = $state<string | null>(null);
	let reg = $state<RegistryPlugin | undefined>(undefined);
	let note = $state<string | null>(null);
	// A note about a change on its way ("…is restarting") goes once it has
	// happened, instead of staying up while the status underneath moves on.
	// "Running" here means running again: a new start, or the new version —
	// the old process can still read as active for a moment.
	let until = $state<{ want: 'running' | 'stopped'; since?: string; version?: string } | null>(
		null
	);
	$effect(() => {
		if (!until || !plugin) return;
		const running = plugin.enabled && plugin.status === 'active';
		const again =
			running &&
			(until.version ? versionOf(plugin) === until.version : plugin.uptime_started !== until.since);
		if (until.want === 'running' ? again : !running) {
			note = null;
			until = null;
		}
	});
	const expect = (want: 'running' | 'stopped', version?: string) => {
		until = { want, since: plugin?.uptime_started, version };
		// While it changes, look again often — events can be missed on a reconnect.
		for (const ms of [1500, 4000, 8000, 15000]) setTimeout(load, ms);
	};
	let busy = $state(false);

	async function load() {
		const res = await loadPlugin(id);
		if (!res.ok) return void (failed = res.error);
		failed = null;
		plugin = res.data;
	}
	onMount(() => {
		void load();
		void loadRegistry().then((r) => r.ok && (reg = r.data.plugins.find((p) => p.id === id)));
		void findRuntime();
		const stop = live.listen((f) => {
			const e = f as { type: string; plugin_id?: string };
			if (
				(e.type === 'plugin_status_changed' || e.type === 'plugin_capabilities') &&
				e.plugin_id === id
			)
				void load();
		});
		const every = setInterval(load, 15_000);
		return () => {
			stop();
			clearInterval(every);
		};
	});

	// Where it runs: homeCore itself, or a plugin runtime it was placed on.
	let runsOn = $state<{ id: string; name: string } | null>(null);
	async function findRuntime() {
		const [p, r] = await Promise.all([loadPlacements(), loadRuntimes()]);
		const here = p.ok ? p.data.find((x) => x.plugin_id === id) : undefined;
		const rt =
			here && r.ok ? r.data.runtimes.find((x) => x.runtime_id === here.runtime_id) : undefined;
		runsOn = here ? { id: here.runtime_id, name: runtimeName(rt, here.runtime_id) } : null;
	}

	const name = $derived(knownPluginName(id) ?? reg?.name ?? pluginLabel(id));
	$effect(() => heading.show(name, { href: '/settings/plugins', label: 'Plugins' }));
	const health = $derived(plugin ? stateOf(plugin, clock.now) : null);
	const update = $derived(plugin ? updateOf(plugin, reg, core.version) : undefined);
	const actions = $derived(
		plugin?.capabilities?.actions?.filter((a) => a.requires_role !== 'admin' || session.isAdmin) ??
			[]
	);
	// One count everywhere on the page — the one its Devices tab shows.
	const its = (n: number, one: string, many: string) =>
		n === 1 ? `its device ${one}` : `its ${n} devices ${many}`;
	const mine = $derived(
		Object.values(devices.byId)
			.filter((d) => d.plugin_id === id)
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const running = $derived(plugin?.status === 'active' || plugin?.status === 'starting');
	let opened = $state<string | null>(null);
	// A plugin with its own page shows that instead of its raw actions; the
	// page comes with the plugin's release.
	pluginUis.ensure();
	const page_ = $derived(pluginUis.find(id, 'plugin.page'));
	let pageFailed = $state(false);
	const ownPanel = $derived(!!page_ && !pageFailed);

	// ---- running ----
	async function act(what: 'start' | 'stop' | 'restart') {
		busy = true;
		const r = await lifecycle(id, what);
		busy = false;
		note = r.ok
			? what === 'restart'
				? `${name} is restarting.`
				: what === 'stop'
					? `${name} is stopping.`
					: `${name} is starting.`
			: r.error;
		if (r.ok) expect(what === 'stop' ? 'stopped' : 'running');
		else setTimeout(load, 1500);
	}

	async function doUpdate() {
		if (!update) return;
		const yes = await ask({
			title: `Update ${name} to ${update}?`,
			body: `Downloads it from the registry (${sizeOf(reg!, update) ?? 'signed'}), checks its signature, and restarts ${name}. Its settings stay${mine.length ? `; ${its(mine.length, 'is', 'are')} back within moments` : ''}.`,
			go: 'Update'
		});
		if (!yes) return;
		busy = true;
		note = `Updating ${name}…`;
		// On a runtime it stays on that runtime, even where another could run it.
		const r = await install(id, update, runsOn?.id);
		busy = false;
		note = !r.ok
			? r.error
			: wasPlaced(r.data)
				? `${name} ${r.data.version} is going to ${runsOn?.name ?? r.data.placed_on}, which updates it the next time it checks in.`
				: `${name} ${r.data.version} is installed${r.data.activated ? ' and starting' : ' (it’s turned off, so it isn’t running)'}.`;
		if (r.ok && !wasPlaced(r.data) && r.data.activated) expect('running', r.data.version);
		await load();
	}

	// ---- turning off, removing ----
	async function turn(on: boolean) {
		if (!on) {
			const yes = await ask({
				title: `Turn ${name} off?`,
				body: `It stops, and stays off when homeCore restarts. Its settings are kept.`,
				lost: mine.length
					? [
							`${cap(its(mine.length, 'stops', 'stop'))} reporting and can’t be controlled until it’s back on.`
						]
					: [],
				go: 'Turn off'
			});
			if (!yes) return;
		}
		busy = true;
		const r = await setEnabled(id, on);
		busy = false;
		if (!r.ok) return void (note = r.error);
		plugin = r.data;
		note = on ? `${name} is on and starting.` : `${name} is off.`;
		if (on) expect('running');
	}

	async function remove() {
		const yes = await ask({
			title: `Uninstall ${name}?`,
			body: 'It’s stopped and its program deleted. You can add it again from the registry.',
			lost: [
				...(mine.length
					? [
							`${cap(its(mine.length, 'goes', 'go'))}, with names and rooms; rules that use them are turned off.`
						]
					: []),
				'You choose next whether its settings go too.'
			],
			go: 'Uninstall',
			danger: true,
			typed: mine.length > 5 ? name.toLowerCase() : undefined
		});
		if (!yes) return;
		// Closing this keeps them: losing credentials is the step to take on purpose.
		const drop = await ask({
			title: `Delete ${name}’s settings too?`,
			body: 'Kept, they’re there if you add it again — credentials included.',
			go: 'Delete them',
			stay: 'Keep them',
			danger: true
		});
		busy = true;
		const r = await uninstall(id, !drop);
		busy = false;
		if (!r.ok) return void (note = r.error);
		void goto('/settings/plugins');
	}

	async function clearDevices() {
		const yes = await ask({
			title: `Delete ${name}’s ${mine.length === 1 ? 'device' : `${mine.length} devices`}?`,
			body: `${name} keeps running; any it still reports come back as new.`,
			lost: ['Their names and rooms in homeCore.', 'Rules that use them are turned off.'],
			go: 'Delete them',
			danger: true,
			typed: mine.length > 5 ? 'delete' : undefined
		});
		if (!yes) return;
		const r = await removeDevices(id);
		note = r.ok
			? `${r.data.deleted} devices removed${r.data.affected_rules.length ? `; turned off ${r.data.affected_rules.join(', ')}` : ''}.`
			: r.error;
	}

	// ---- how much it logs ----
	let level = $state('');
	$effect(() => {
		if (plugin && level === '') level = plugin.log_level ?? '';
	});
	// From homeCore 0.1.81 a level set here is kept in the plugin's own
	// settings — when it runs beside homeCore, which has its file.
	const levelKept = $derived(core.since('0.1.81') && !runsOn);
	async function setLevel(v: string) {
		level = v;
		const r = await setLogLevel(id, v);
		note = r.ok
			? `${name} now logs ${v} and above${levelKept ? '.' : ', until it restarts.'}`
			: r.error;
	}

	// ---- the log ----
	let logLevel = $state('info');
	let lines = $state<LogLine[] | null>(null);
	let logNote = $state<string | null>(null);
	async function readLog() {
		const r = await loadLogs(id, logLevel);
		if (!r.ok) return void (logNote = r.error);
		logNote = null;
		lines = [...r.data.lines].reverse();
	}
	$effect(() => {
		if (tab !== 'logs') return;
		void logLevel;
		void readLog();
		const t = setInterval(readLog, 5000);
		return () => clearInterval(t);
	});
	const time = (iso: string) => timeOf(iso, true);
	// Someone who may read plugins but not change them (plugins:read) sees how
	// each is and what it has, and nothing to press; its log is admins' (logs).
	const canWrite = $derived(session.isAdmin || session.can('plugins:write'));
	const mayRead = $derived(session.isAdmin || session.can('plugins:read'));
	const TABS_ALL = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'settings', label: 'Settings' },
		{ id: 'logs', label: 'Log' },
		{ id: 'devices', label: 'Devices' }
	];
	const TABS = $derived(
		TABS_ALL.filter(
			(t) => (t.id !== 'settings' || canWrite) && (t.id !== 'logs' || session.isAdmin)
		)
	);
</script>

{#if !mayRead}
	<p class="quiet">Plugins are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">{failed} <a href="/settings/plugins">All plugins</a></p>
{:else if !plugin || !health}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<header class="top">
			<div class="line">
				<span class="state {health.tone}"><b>{health.word}</b> {health.detail}</span>
				{#if !canWrite}
					<!-- Look, don't touch. -->
				{:else if plugin.enabled}
					<button type="button" class="plain" disabled={busy} onclick={() => act('restart')}
						>Restart</button
					>
					<!-- Stopped, or crashed and given up on: start it. -->
					{#if !running}
						<button type="button" class="go" disabled={busy} onclick={() => act('start')}
							>Start</button
						>
					{:else}
						<button type="button" class="plain" disabled={busy} onclick={() => act('stop')}
							>Stop</button
						>
					{/if}
				{:else}
					<button type="button" class="go" disabled={busy} onclick={() => turn(true)}
						>Turn on</button
					>
				{/if}
			</div>
			{#if reg?.description}<p class="what">{reg.description}</p>{/if}
			<div class="tabs" role="tablist">
				{#each TABS as t (t.id)}
					<button role="tab" aria-selected={tab === t.id} onclick={() => setTab(t.id)}
						>{t.label}{t.id === 'devices' ? ` · ${mine.length}` : ''}</button
					>
				{/each}
			</div>
		</header>

		{#if note}<p class="note" role="status">{note}</p>{/if}
		{#if page_ && pageFailed}
			<!-- Never a silent swap: this generic page stands in only when its own didn't load. -->
			<p class="note" role="alert">
				{name}’s own page didn’t load, so this is the general one.
				<button type="button" class="reload" onclick={() => location.reload()}>Reload</button>
			</p>
		{/if}

		{#if tab === 'settings' && canWrite}
			<!-- Read again when it restarts: a new version can bring a new form. -->
			{#key plugin.uptime_started}
				<PluginSettings pluginId={id} {name} running={plugin.enabled} />
			{/key}
		{:else if tab === 'logs' && session.isAdmin}
			<section class="logs">
				<label class="lvl">
					Show
					<select bind:value={logLevel}
						>{#each LEVELS as l (l)}<option value={l}>{l} and above</option>{/each}</select
					>
				</label>
				{#if logNote}<p class="trouble">{logNote}</p>{/if}
				{#if lines === null}<p class="quiet">Loading…</p>
				{:else if lines.length === 0}<p class="quiet">Nothing at this level yet.</p>
				{:else}
					<ol class="log">
						{#each lines as l, i (i)}
							<li class={l.level.toLowerCase()}>
								<span class="t">{time(l.timestamp)}</span><span class="lv"
									>{l.level.toLowerCase()}</span
								>{l.message}
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{:else if tab === 'devices'}
			<section class="card">
				{#if mine.length === 0}
					<p class="quiet">
						{name} reports no devices{plugin.device_count
							? `, though it says it has ${plugin.device_count}`
							: ''}.
					</p>
				{:else}
					<ul class="devices">
						{#each mine as d (d.device_id)}
							<li>
								<a
									href={`/settings/devices/${encodeURIComponent(d.device_id)}?from=${encodeURIComponent(`plugin:${id}`)}`}
									><span>{displayName(d)}</span><span class="muted"
										>{[kindLabel(kindOf(d)), roomOf(d, rooms.list)?.name]
											.filter(Boolean)
											.join(' · ')}</span
									><ChevronRight size={16} aria-hidden="true" /></a
								>
							</li>
						{/each}
					</ul>
					<!-- Its own size, at the end — not a full-width red bar over the list (#113). -->
					<button type="button" class="plain danger end" onclick={clearDevices}
						>Delete all its devices…</button
					>
				{/if}
			</section>
		{:else}
			{#if update}
				<div class="banner lit">
					<span
						><strong>Version {update} is in the registry.</strong> You have {versionOf(plugin)}. {name}
						restarts to update.</span
					>
					<button type="button" class="go" disabled={busy} onclick={doUpdate}>Update</button>
				</div>
			{/if}
			{#each plugin.notices ?? [] as n (n.code)}
				<div class="banner {n.level === 'error' ? 'bad' : n.level === 'warning' ? 'lit' : 'info'}">
					<span
						><strong>{n.message}</strong>{#if n.remedy}{' '}{n.remedy}{/if}</span
					>
				</div>
			{/each}

			{#if page_ && !pageFailed}
				<PluginSlot
					pluginId={id}
					ui={page_.ui}
					slot={page_.slot}
					onfail={() => (pageFailed = true)}
				/>
			{/if}

			{#if actions.length && canWrite && !ownPanel}
				<section class="actions">
					<h2>Actions</h2>
					{#each actions as a (a.id)}
						{@const isOpen = opened === a.id}
						<div class="act" class:open={isOpen}>
							<button
								type="button"
								class="head"
								aria-expanded={isOpen}
								onclick={() => (opened = isOpen ? null : a.id)}
							>
								<span class="txt"
									><strong class:danger={dangerous(a)}>{a.label}</strong>{#if a.description}<span
											>{a.description}</span
										>{/if}</span
								>
								<span class="btn">{isOpen ? '' : buttonOf(a)}</span>
								{#if isOpen}<ChevronDown size={16} aria-hidden="true" />{:else}<ChevronRight
										size={16}
										aria-hidden="true"
									/>{/if}
							</button>
							{#if isOpen}<div class="body">
									<ActionRun pluginId={id} pluginName={name} action={a} />
								</div>{/if}
						</div>
					{/each}
				</section>
			{/if}

			{#if mine.some((d) => d.device_id === 'matter_controller')}<MatterPanel />{/if}

			<section class="card facts">
				<dl>
					<dt>Version</dt>
					<dd>
						{`${versionOf(plugin) ?? '—'}${reg && latestOf(reg, core.version) && !update ? ' · the latest' : ''}`}
					</dd>
					<dt>Runs on</dt>
					<dd>
						{#if runsOn}<a href="/settings/plugins/runtimes">{runsOn.name}</a>, a plugin runtime{:else}homeCore{/if}
					</dd>
					<dt>Devices</dt>
					<dd>{mine.length}</dd>
					<dt>Last heard</dt>
					<dd>
						{plugin.last_heartbeat
							? `${ago(clock.now - Date.parse(plugin.last_heartbeat))} ago`
							: '—'}
					</dd>
					<dt>Restarts</dt>
					<dd>{plugin.restart_count}</dd>
					<dt>Id</dt>
					<dd class="mono">{id}</dd>
				</dl>
				<label class="lvl">
					How much it logs
					<select
						value={level}
						onchange={(e) => setLevel(e.currentTarget.value)}
						disabled={!running || !canWrite}
					>
						{#if level === ''}<option value="">As its settings say</option>{/if}
						<!-- A finer rule ("hc_sonos=debug,info") is shown as it is, not as a blank box. -->
						{#if level !== '' && !(LEVELS as readonly string[]).includes(level)}<option
								value={level}>Custom — {level}</option
							>{/if}
						{#each LEVELS as l (l)}<option value={l}>{l}</option>{/each}
					</select>
					<span class="quiet"
						>{levelKept
							? 'Kept in its settings, so it starts at this level too.'
							: 'Until it restarts; to keep it, change its settings.'}</span
					>
				</label>
			</section>

			{#if canWrite}
				<section class="card danger-zone">
					<h2>{plugin.enabled ? 'Turn off or uninstall' : 'Uninstall'}</h2>
					<p class="quiet">
						{#if plugin.enabled}Turning it off keeps its settings and stays off through restarts{mine.length
								? `; ${its(mine.length, 'goes', 'go')} quiet`
								: ''}.
						{/if}{' '}Uninstalling it deletes its program and its devices — rules that use them are
						turned off.
					</p>
					<div class="buttons">
						{#if plugin.enabled}<button
								type="button"
								class="plain"
								disabled={busy}
								onclick={() => turn(false)}>Turn off</button
							>{/if}
						<button type="button" class="plain danger" disabled={busy} onclick={remove}
							>Uninstall…</button
						>
					</div>
				</section>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 1100px;
	}
	.top {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.state {
		flex: 1;
		color: var(--ink-muted);
	}
	.state b {
		color: var(--ink);
	}
	.state.good b {
		color: light-dark(#2f6b3a, #8fd19e);
	}
	.state.bad b {
		color: var(--alert);
	}
	.what {
		margin: 0;
		color: var(--ink-muted);
	}
	.tabs {
		display: flex;
		gap: 2px;
		border-bottom: 1px solid var(--line);
		overflow-x: auto;
	}
	.tabs button {
		height: 40px;
		padding: 0 14px;
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		white-space: nowrap;
	}
	.tabs button[aria-selected='true'] {
		color: var(--ink);
		border-bottom-color: var(--accent);
	}
	.plain,
	.go {
		height: 36px;
		padding: 0 16px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		white-space: nowrap;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.danger {
		color: var(--alert);
	}
	button:disabled {
		opacity: 0.5;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: 10px 14px;
		border-radius: 12px;
		line-height: 1.45;
	}
	.banner span {
		flex: 1 1 300px;
	}
	.banner.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.banner.info {
		background: var(--surface-2);
		color: var(--ink);
	}
	.banner.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.act {
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.act.open {
		border-color: var(--accent);
	}
	.act .head {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.txt span {
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.4;
	}
	.btn {
		color: var(--accent);
		font-weight: 700;
		font-size: 13px;
	}
	.act .head :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.body {
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-top: 1px solid var(--line);
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
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px var(--space-4);
		margin: 0;
	}
	dt {
		color: var(--ink-muted);
	}
	dd {
		margin: 0;
	}
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
	}
	.lvl {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-muted);
		font-size: 13px;
	}
	select {
		height: 36px;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
	}
	.devices {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.devices li + li {
		border-top: 1px solid var(--line);
	}
	.devices a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 44px;
		color: var(--ink);
		text-decoration: none;
	}
	.devices a span:first-child {
		flex: 1;
	}
	.muted {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.logs {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.log {
		list-style: none;
		margin: 0;
		padding: var(--space-3);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		font-family: var(--font-num);
		font-size: 12.5px;
		line-height: 1.6;
		max-height: 70vh;
		overflow: auto;
	}
	.log li {
		overflow-wrap: anywhere;
	}
	.t {
		color: var(--ink-muted);
		margin-right: 8px;
	}
	.lv {
		display: inline-block;
		width: 48px;
		color: var(--ink-muted);
	}
	.log .error {
		color: var(--alert);
	}
	.log .warn {
		color: var(--lit-ink);
	}
	.trouble {
		margin: 0;
		color: var(--alert);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.reload {
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-weight: 600;
	}
	.end {
		align-self: flex-start;
		margin-top: var(--space-2);
	}
</style>
