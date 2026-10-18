<!--
	Data & backups (A6): back up the house — homeCore's file, and this app's
	own pages and Homes — and put a backup back, told first exactly what it
	brings; rules and scenes on their own; the calendars rules check.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { backupDue, daysAgo, size } from '#lib/settings.js';
	import {
		addCalendar,
		calendarEvents,
		backUp,
		backUpApp,
		checkRestore,
		exportScenes,
		importScenes,
		loadCalendars,
		loadStatus,
		removeCalendar,
		restartAndWait,
		restoreApp,
		stageRestore,
		uploadCalendar,
		type Calendar,
		type RestorePlan,
		type Status
	} from '#lib/systemAdmin.js';

	let status = $state<Status | null>(null);
	let calendars = $state<Calendar[] | null>(null);
	async function load() {
		const [s, c] = await Promise.all([loadStatus(), loadCalendars()]);
		if (s.ok) status = s.data;
		if (c.ok) calendars = c.data;
	}
	onMount(load);

	const due = $derived(status ? backupDue(status.last_backup_at, clock.now) : false);
	const lastSaid = $derived(
		!status
			? ''
			: status.last_backup_at
				? `Last backup: ${new Date(status.last_backup_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} — ${daysAgo(status.last_backup_at, clock.now)}`
				: 'No backup is recorded.'
	);

	// ---- back up ----
	let backing = $state<string | null>(null);
	async function backupNow() {
		backing = 'Making the backup — this can take a minute with a lot of history…';
		const r = await backUp();
		backing = r.ok
			? `Saved ${r.data.filename} (${size(r.data.bytes)}) to your downloads. Keep it somewhere other than this machine.`
			: r.error;
		await load();
	}
	let appBacking = $state<string | null>(null);
	async function backupApp() {
		const r = await backUpApp();
		appBacking = r.ok ? `Saved ${r.data.filename}.` : r.error;
	}

	// ---- restore ----
	let file = $state<File | null>(null);
	let plan = $state<RestorePlan | null>(null);
	let restoreNote = $state<string | null>(null);
	let restoring = $state(false);
	async function chose(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0] ?? null;
		input.value = '';
		plan = null;
		restoreNote = null;
		file = f;
		if (!f) return;
		restoreNote = 'Reading the backup…';
		const r = await checkRestore(f);
		if (!r.ok) {
			file = null;
			return void (restoreNote = r.error);
		}
		plan = r.data;
		restoreNote = null;
	}
	const counts = $derived.by(() => {
		if (!plan) return [];
		const n = (pre: string) => plan!.restored.filter((x) => x.startsWith(pre)).length;
		return [
			'The house’s state: devices, rooms, scenes, people',
			plan.restored.includes('history.db') ? 'Its history' : '',
			n('rules/') ? `${n('rules/')} rules` : '',
			n('config/') ? 'homeCore’s settings and modes' : '',
			n('plugins/') ? `Settings for ${n('plugins/')} plugins` : '',
			n('calendars/') ? 'Its calendars' : ''
		].filter(Boolean);
	});
	async function putBack() {
		if (!file || !plan) return;
		const ok = await ask({
			title: 'Put the house back as this backup has it?',
			body: `Everything changed since ${plan.taken_at ? new Date(plan.taken_at).toLocaleString() : 'the backup was taken'} is lost. homeCore restarts to do it.`,
			lost: [
				'Devices, rooms, scenes, rules and people as they are now',
				'History since the backup',
				'Back up now first if you might want any of it'
			],
			go: 'Put it back and restart',
			danger: true,
			typed: 'restore'
		});
		if (!ok) return;
		restoring = true;
		restoreNote = 'Handing the backup to homeCore…';
		const staged = await stageRestore(file);
		if (!staged.ok) {
			restoring = false;
			return void (restoreNote = staged.error);
		}
		restoreNote = 'Restarting homeCore to put it in place…';
		const r = await restartAndWait((secs) => (restoreNote = `Waiting for homeCore… ${secs} s`));
		restoring = false;
		restoreNote = r.ok
			? `Done — homeCore is back after ${r.data.secs} seconds, as the backup has it.`
			: `${r.error} The backup is waiting and goes in place when homeCore next starts.`;
		file = null;
		plan = null;
		await load();
	}

	let appNote = $state<string | null>(null);
	async function choseApp(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		let doc: unknown;
		try {
			doc = JSON.parse(await f.text());
		} catch {
			return void (appNote = 'That isn’t a backup of this app.');
		}
		const ok = await ask({
			title: 'Put this app’s pages and Homes back?',
			body: 'Each page, display and person’s Home in the backup replaces the one here now. Others are left alone.',
			go: 'Put them back',
			danger: true
		});
		if (!ok) return;
		const r = await restoreApp(doc);
		appNote = r.ok ? `Put back ${r.data.restored} documents.` : r.error;
	}

	// ---- scenes ----
	async function scenesOut() {
		const r = await exportScenes();
		if (!r.ok) return;
		const blob = new Blob([JSON.stringify(r.data, null, '\t')], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `homecore-scenes-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
	}

	// homeCore adds every imported scene as a new one, so one already here by
	// name would be doubled: those start unticked.
	let incoming = $state<{ scene: { name?: string }; take: boolean; here: boolean }[] | null>(null);
	let scenesNote = $state<string | null>(null);
	async function scenesIn(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		let list: unknown;
		try {
			list = JSON.parse(await f.text());
		} catch {
			return void (scenesNote = 'That isn’t a scenes file.');
		}
		if (!Array.isArray(list) || !list.every((x) => x && typeof x === 'object' && 'name' in x))
			return void (scenesNote = 'That isn’t a scenes file.');
		const here = await exportScenes();
		const names = new Set(
			here.ok ? (here.data as { name: string }[]).map((x) => x.name.trim().toLowerCase()) : []
		);
		incoming = (list as { name: string }[]).map((scene) => {
			const dup = names.has(String(scene.name).trim().toLowerCase());
			return { scene, take: !dup, here: dup };
		});
		scenesNote = null;
	}
	async function bringScenes() {
		if (!incoming) return;
		const chosen = incoming.filter((x) => x.take).map((x) => x.scene);
		const r = await importScenes(chosen);
		scenesNote = r.ok ? `Added ${r.data.imported} scenes.` : r.error;
		if (r.ok) incoming = null;
	}

	// ---- calendars ----
	let url = $state('');
	let calName = $state('');
	let refresh = $state(24);
	let calNote = $state<string | null>(null);
	/** Adding under a name already used replaces that calendar — ask first. */
	async function replaces(name: string): Promise<boolean> {
		if (!calendars?.some((c) => c.id === name)) return true;
		return ask({
			title: `Replace the calendar “${name}”?`,
			body: 'There’s one by that name already. Its events are replaced by these; rules that check it check the new one.',
			go: 'Replace',
			danger: true
		});
	}
	async function add(e: SubmitEvent) {
		e.preventDefault();
		const name = calName.trim() || nameFromUrl(url);
		if (name && !(await replaces(name))) return;
		calNote = 'Fetching it…';
		const r = await addCalendar(url.trim(), calName.trim() || undefined, refresh || undefined);
		calNote = r.ok ? `Added “${r.data.calendar_id}” — ${r.data.event_count} events.` : r.error;
		if (r.ok) url = calName = '';
		await load();
	}
	async function uploadIcs(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		// The Name box, if filled, names it; else the file's name does.
		const name = cleanName(calName.trim() || f.name.replace(/\.ics$/i, ''));
		if (!(await replaces(name))) return;
		const r = await uploadCalendar(await f.text(), name);
		if (r.ok) calName = '';
		calNote = r.ok ? `Added “${r.data.calendar_id}” — ${r.data.event_count} events.` : r.error;
		await load();
	}
	async function remove(c: Calendar) {
		const ok = await ask({
			title: `Remove the calendar “${c.id}”?`,
			body: 'Rules that check it find nothing in it from now on.',
			go: 'Remove',
			danger: true
		});
		if (!ok) return;
		const r = await removeCalendar(c.id);
		calNote = r.ok
			? r.data.referencing_rules.length
				? `Removed. These rules still check it: ${r.data.referencing_rules.map((x) => x.rule_name).join(', ')}.`
				: 'Removed.'
			: r.error;
		await load();
	}
	const ago = (iso: string | null) => (iso ? daysAgo(iso, clock.now) : 'never');
	/** A calendar's name as homeCore keeps it: letters, digits, `-` and `_`. */
	const cleanName = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
	/** The name homeCore gives a fetched calendar with none: the file's, from its address. */
	function nameFromUrl(u: string): string {
		try {
			const last = new URL(u.trim()).pathname.split('/').pop() ?? '';
			return cleanName(last.replace(/\.ics$/i, ''));
		} catch {
			return '';
		}
	}

	// A fetched calendar: fetch it now, or change how often.
	let busyCal = $state<string | null>(null);
	let everyFor = $state<string | null>(null);
	let every = $state(24);
	async function refetch(c: Calendar, hours = c.refresh_hours ?? undefined) {
		if (!c.source_url) return;
		busyCal = c.id;
		const r = await addCalendar(c.source_url, c.id, hours);
		busyCal = null;
		calNote = r.ok ? `Fetched “${c.id}” — ${r.data.event_count} events.` : r.error;
		if (r.ok) {
			everyFor = null;
			delete coming[c.id];
			coming = { ...coming };
			if (showing === c.id) {
				showing = null;
				void toggleComing(c.id);
			}
		}
		await load();
	}
	const howOften = (c: Calendar) =>
		c.refresh_hours
			? `again every ${c.refresh_hours === 24 ? 'day' : `${c.refresh_hours} h`}`
			: 'not again';

	// What's coming up in a calendar, read when asked.
	type Coming = { uid: string; summary: string; start: string; is_all_day: boolean }[];
	let coming = $state<Record<string, Coming | string>>({});
	let showing = $state<string | null>(null);
	/** How many coming events each shows: 8, then more on asking. */
	let shown = $state<Record<string, number>>({});
	async function moreComing(id: string) {
		shown = { ...shown, [id]: (shown[id] ?? 8) + 25 };
		const r = await calendarEvents(id, shown[id]);
		coming = { ...coming, [id]: r.ok ? r.data.events : r.error };
	}
	async function toggleComing(id: string) {
		if (showing === id) return void (showing = null);
		showing = id;
		if (coming[id] && typeof coming[id] !== 'string') return;
		const r = await calendarEvents(id, shown[id] ?? 8);
		coming = { ...coming, [id]: r.ok ? r.data.events : r.error };
	}
	const when = (e: Coming[number]) => {
		const d = new Date(e.start);
		// An all-day event is a date. homeCore 0.1.79 and later send the house's
		// midnight; earlier ones sent midnight UTC — read that one in UTC, or a
		// house west of Greenwich would see the evening before.
		const utcMidnight = e.is_all_day && /T00:00:00(\.0+)?Z$/.test(e.start);
		const day = d.toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			...(utcMidnight ? { timeZone: 'UTC' } : {})
		});
		return e.is_all_day
			? day
			: `${day}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
	};
</script>

{#if !session.isAdmin}
	<p class="quiet">Backups are for the house’s admins.</p>
{:else}
	<div class="grid">
		<section class="card" class:due>
			<h2>Back up</h2>
			<p class:bad={due}><strong>{lastSaid}</strong></p>
			<p class="sub">
				One file with the house’s state{status ? ` (${size(status.state_db_bytes)})` : ''}, history{status
					? ` (${size(status.history_db_bytes)})`
					: ''}, rules, settings and calendars.
			</p>
			<button class="go" onclick={backupNow} disabled={backing?.startsWith('Making')}
				>Back up now</button
			>
			{#if backing}<p class="sub" role="status">{backing}</p>{/if}
			<p class="sub">
				This app’s own pages, displays and everyone’s Home are kept apart from homeCore —
				<button class="link" onclick={backupApp}>save them too</button>.
			</p>
			{#if appBacking}<p class="sub" role="status">{appBacking}</p>{/if}
			<p class="sub">homeCore doesn’t back itself up on a schedule.</p>
		</section>

		<section class="card">
			<h2>Restore</h2>
			<p class="sub">
				Put the house back as a backup has it. You’re told what it brings before anything happens.
			</p>
			{#if !plan}
				<label class="plain bad file"
					>Choose a backup file…<input
						type="file"
						accept=".zip,application/zip"
						onchange={chose}
					/></label
				>
			{:else}
				<div class="plan">
					<strong
						>A backup from {plan.taken_at
							? new Date(plan.taken_at).toLocaleString(undefined, {
									dateStyle: 'medium',
									timeStyle: 'short'
								})
							: 'an unknown time'}</strong
					>
					<ul>
						{#each counts as c (c)}<li>{c}</li>{/each}
					</ul>
					{#if plan.skipped.length}<span class="sub"
							>Left out: {plan.skipped.join(', ')} — not for this homeCore.</span
						>{/if}
				</div>
				<div class="acts">
					<button class="plain" onclick={backupNow}>Back up now first</button>
					<button class="danger" onclick={putBack} disabled={restoring}>Put it back…</button>
					<button class="plain" onclick={() => ((plan = null), (file = null))} disabled={restoring}
						>Cancel</button
					>
				</div>
			{/if}
			{#if restoreNote}<p class="sub" role="status">{restoreNote}</p>{/if}
			<p class="sub">
				This app’s pages and Homes: <label class="link file"
					>put a saved copy back<input
						type="file"
						accept=".json,application/json"
						onchange={choseApp}
					/></label
				>
			</p>
			{#if appNote}<p class="sub" role="status">{appNote}</p>{/if}
		</section>

		<section class="card">
			<h2>Rules and scenes, on their own</h2>
			<p class="sub">
				As JSON — to keep a copy, move them to another homeCore, or look through them.
			</p>
			<div class="acts">
				<a class="plain" href="/settings/automations">Export or import rules</a>
				<button class="plain" onclick={scenesOut}>Export scenes</button>
				<label class="plain file"
					>Import scenes…<input
						type="file"
						accept=".json,application/json"
						onchange={scenesIn}
					/></label
				>
			</div>
			{#if incoming}
				<div class="plan">
					<strong>{incoming.length} scenes in the file</strong>
					{#each incoming as x, i (i)}
						<label class="pick"
							><input type="checkbox" bind:checked={x.take} />
							{x.scene.name}{#if x.here}<span class="sub">
									— one by this name is here already</span
								>{/if}</label
						>
					{/each}
				</div>
				<div class="acts">
					<button class="go" onclick={bringScenes} disabled={!incoming.some((x) => x.take)}
						>Add {incoming.filter((x) => x.take).length}</button
					>
					<button class="plain" onclick={() => (incoming = null)}>Cancel</button>
				</div>
			{/if}
			{#if scenesNote}<p class="sub" role="status">{scenesNote}</p>{/if}
		</section>

		<section class="card">
			<h2>Calendars</h2>
			<p class="sub">
				Holidays, bin days, school terms — rules can check whether there’s an event now.
			</p>
			{#if calendars?.length}
				<ul class="cals">
					{#each calendars as c (c.id)}
						<li>
							<span class="text"
								><strong>{c.id}</strong>
								<span class="sub"
									>{c.upcoming_count} coming up of {c.event_count} · {c.source_url
										? `fetched ${ago(c.fetched_at)}${'refresh_hours' in c ? `, ${howOften(c)}` : ''}`
										: 'uploaded'}</span
								></span
							>
							<button
								class="plain"
								aria-expanded={showing === c.id}
								onclick={() => toggleComing(c.id)}
								>{showing === c.id ? 'Hide' : 'What’s coming'}</button
							>
							{#if c.source_url && 'refresh_hours' in c}
								<button class="plain" disabled={busyCal === c.id} onclick={() => refetch(c)}
									>{busyCal === c.id ? 'Fetching…' : 'Fetch now'}</button
								>
								<button
									class="plain"
									aria-expanded={everyFor === c.id}
									onclick={() => {
										everyFor = everyFor === c.id ? null : c.id;
										every = c.refresh_hours ?? 24;
									}}>How often…</button
								>
							{/if}
							<button class="plain bad" onclick={() => remove(c)}>Remove</button>
						</li>
						{#if everyFor === c.id}
							<li class="coming">
								<form
									class="every"
									onsubmit={(e) => {
										e.preventDefault();
										void refetch(c, every > 0 ? every : undefined);
									}}
								>
									<label class="sub refresh"
										>Fetch it again every <input
											type="number"
											min="0"
											bind:value={every}
											aria-label="Hours"
										/> hours — 0 for never</label
									>
									<button class="go" type="submit" disabled={busyCal === c.id}>Save</button>
								</form>
							</li>
						{/if}
						{#if showing === c.id}
							{@const list = coming[c.id]}
							<li class="coming">
								{#if list === undefined}
									<span class="sub">Reading it…</span>
								{:else if typeof list === 'string'}
									<span class="sub bad">{list}</span>
								{:else if list.length === 0}
									<span class="sub">Nothing coming up.</span>
								{:else}
									<ol>
										{#each list as e (e.uid + e.start)}
											<li><span class="day">{when(e)}</span> {e.summary || '(no title)'}</li>
										{/each}
									</ol>
									{#if list.length >= (shown[c.id] ?? 8) && list.length < c.upcoming_count}
										<button class="plain" onclick={() => moreComing(c.id)}>More</button>
									{/if}
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			{:else if calendars}
				<p class="sub">None yet.</p>
			{/if}
			<form class="add" onsubmit={add}>
				<input
					type="url"
					bind:value={url}
					placeholder="A calendar’s web address (.ics)"
					aria-label="Calendar address"
					required
				/>
				<input
					bind:value={calName}
					placeholder="Name (optional — for an upload too)"
					aria-label="Calendar name"
				/>
				<label class="sub refresh"
					>Fetch again every <input type="number" min="0" bind:value={refresh} aria-label="Hours" /> hours</label
				>
				<button class="go" type="submit">Add</button>
			</form>
			<label class="link file"
				>or upload an .ics file<input
					type="file"
					accept=".ics,text/calendar"
					onchange={uploadIcs}
				/></label
			>
			{#if calNote}<p class="sub" role="status">{calNote}</p>{/if}
		</section>
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.card.due {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	p {
		margin: 0;
		line-height: 1.5;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13.5px;
		line-height: 1.5;
		margin: 0;
	}
	.bad {
		color: var(--alert);
	}
	.go,
	.plain,
	.danger {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		display: inline-flex;
		align-items: center;
		font-weight: 700;
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
	.danger {
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
	}
	.plain.bad {
		border-color: var(--alert-line);
		background: none;
		color: var(--alert);
	}
	.go:disabled,
	.danger:disabled {
		opacity: 0.5;
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font-weight: 600;
		font-size: inherit;
		cursor: pointer;
	}
	.file {
		position: relative;
		cursor: pointer;
	}
	.file input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.file:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.plan {
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.plan ul {
		margin: 0;
		padding-left: 20px;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.cals {
		align-self: stretch;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.cals li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
	}
	.cals li + li {
		border-top: 1px solid var(--line);
	}
	.coming ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
	}
	.cals li.coming {
		display: block;
		padding: 4px 0 10px 12px;
		border-top: none;
		border-left: 2px solid var(--line);
	}
	.day {
		display: inline-block;
		min-width: 150px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.add {
		align-self: stretch;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.add input:not([type='number']) {
		flex: 1 1 200px;
		min-height: 40px;
		box-sizing: border-box;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--sheet);
	}
	.refresh {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.refresh input {
		width: 56px;
		min-height: 34px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--sheet);
		padding: 0 6px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
