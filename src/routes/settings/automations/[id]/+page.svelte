<!--
	One rule (A2, doc 09 §3): what it does in a sentence, what's wrong with
	it, why it did or didn't run lately (its history, newest first), a test
	against the house as it is now, the rules it's a family with, and its text.
	On and off, tags, a copy, export and delete. Changing what it does is the
	editor's (A3).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import X from '@lucide/svelte/icons/x';
	import Toggle from '#lib/components/Toggle.svelte';
	import Words from '#lib/components/rules/Words.svelte';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { capitalised, readRule, sentence, type Rule, type Step } from '#lib/ruleWords.js';
	import {
		dayOf,
		familiesOf,
		houseOf,
		likelyFor,
		onlyTells,
		repoint,
		rowsOf
	} from '#lib/ruleList.js';
	import { runsOf, tested, type Record_, type Tested } from '#lib/ruleRuns.js';
	import {
		cloneRule,
		deleteRule,
		download,
		history,
		loadRules,
		modeMade,
		ronOf,
		saveRule,
		loadVocabulary,
		runRule,
		setEnabled,
		testRule
	} from '#lib/ruleAdmin.js';
	import { featuresOf, type Features } from '#lib/ruleEdit.js';

	const id = $derived(page.params.id ?? '');

	let all = $state<Rule[] | null>(null);
	let records = $state<Record_[]>([]);
	let byMode = $state<Record<string, string>>({});
	let failed = $state<string | null>(null);

	async function load() {
		const res = await loadRules();
		if (!res.ok) failed = res.error;
		else {
			failed = null;
			all = res.data;
		}
	}
	async function loadHistory() {
		const res = await history(id);
		records = res.ok ? res.data : [];
	}

	let features = $state<Features | null>(null);
	onMount(() => {
		void modeMade().then((m) => (byMode = m));
		void loadVocabulary().then((v) => (features = featuresOf(v)));
		const stop = live.listen((frame) => {
			const f = frame as { type: string; rule_id?: string; rule?: Rule };
			if (f.type === 'rule_fired' && f.rule_id === id) void loadHistory();
			if (f.type === 'rule_changed' && f.rule && all) {
				const changed = f.rule;
				all = all.some((r) => r.id === changed.id)
					? all.map((r) => (r.id === changed.id ? changed : r))
					: [...all, changed];
			}
			if (f.type === 'rule_removed' && all) all = all.filter((r) => r.id !== f.rule_id);
		});
		const back = () => {
			if (document.visibilityState === 'visible') {
				void load();
				void loadHistory();
			}
		};
		document.addEventListener('visibilitychange', back);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', back);
		};
	});

	const rule = $derived(all?.find((r) => r.id === id));
	const house = $derived(houseOf(devices.byId, scenes.list, all ?? []));
	const row = $derived(rule ? rowsOf([rule], house, {}, byMode)[0] : undefined);
	const reading = $derived(rule ? readRule(house, rule) : null);
	const words = $derived(rule ? sentence(house, rule) : []);
	const runs = $derived(rule ? runsOf(house, rule, records) : []);
	const family = $derived(rule && all ? familiesOf(all).get(rule.id) : undefined);
	const kin = $derived(
		family ? (all ?? []).filter((r) => family.ids.includes(r.id) && r.id !== id) : []
	);
	const madeBy = $derived(rule ? byMode[rule.id] : undefined);

	$effect(() =>
		heading.show(rule?.name ?? 'Automation', {
			href: '/settings/automations',
			label: 'Automations'
		})
	);

	let note = $state<string | null>(null);
	let busy = $state(false);

	async function replace(next: Rule, done: string) {
		busy = true;
		const res = await saveRule($state.snapshot(next) as Rule);
		busy = false;
		if (!res.ok) note = res.error;
		else {
			all = (all ?? []).map((r) => (r.id === id ? res.data : r));
			note = done;
		}
	}

	async function turn(on: boolean) {
		const res = await setEnabled(id, on);
		if (!res.ok) note = res.error;
		else all = (all ?? []).map((r) => (r.id === id ? res.data : r));
	}

	// ---- a device it names that the house doesn't have ----
	const fixes = $derived(
		row && rule ? row.missing.map((m) => ({ id: m, to: likelyFor(m, devices.byId) })) : []
	);
	async function sendTo(from: string, to: string) {
		if (!rule) return;
		const toName = displayName(devices.byId[to]!);
		const yes = await ask({
			title: `Send it to ${toName} instead?`,
			body: `Every place this rule names “${from}” will name ${toName} (${to}). Nothing else changes.`,
			go: 'Change it'
		});
		if (yes) await replace(repoint(rule, from, to), `It now names ${toName}.`);
	}

	// ---- tags (E9) ----
	let newTag = $state('');
	async function addTag() {
		const tag = newTag.trim().toLowerCase();
		if (!rule || tag === '' || rule.tags?.includes(tag)) return;
		newTag = '';
		await replace({ ...rule, tags: [...(rule.tags ?? []), tag] }, `Tagged “${tag}”.`);
	}
	async function dropTag(tag: string) {
		if (!rule) return;
		await replace(
			{ ...rule, tags: (rule.tags ?? []).filter((t) => t !== tag) },
			`No longer tagged “${tag}”.`
		);
	}
	const knownTags = $derived([...new Set((all ?? []).flatMap((r) => r.tags ?? []))].sort());

	// ---- copy, export, delete ----
	async function copy() {
		busy = true;
		const res = await cloneRule(id);
		busy = false;
		if (!res.ok) note = res.error;
		else void goto(`/settings/automations/${encodeURIComponent(res.data.id)}`);
	}
	async function remove() {
		if (!rule) return;
		const yes = await ask({
			title: `Delete “${rule.name}”?`,
			lost: [
				'It stops running, and its file goes.',
				'Export it first to keep a copy you can import again.'
			],
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const res = await deleteRule(id);
		if (!res.ok) note = res.error;
		else void goto('/settings/automations', { replace: true });
	}
	const fileName = (r: Rule) =>
		`${
			r.name
				.replace(/[^\p{L}\p{N}]+/gu, '-')
				.replace(/^-|-$/g, '')
				.toLowerCase() || 'rule'
		}.json`;

	// ---- test: now, or as if it were another time ----
	let test = $state<Tested | null>(null);
	let testing = $state(false);
	let atTime = $state(false);
	/** `datetime-local`'s value: the house's own time, as homeCore reads it. */
	let at = $state('');
	async function runTest() {
		if (!rule) return;
		const then = atTime && at ? at : undefined;
		testing = true;
		const res = await testRule(id, then);
		testing = false;
		if (!res.ok) note = res.error;
		else test = tested(house, rule, res.data, then ? whenText(then) : undefined);
	}
	/** "at 22:30 on Sun 19 Oct". */
	function whenText(local: string): string {
		const [d, t] = local.split('T');
		const day = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
		return `at ${t?.slice(0, 5)} on ${day}`;
	}
	function chooseTime(on: boolean) {
		atTime = on;
		test = null;
		if (on && !at) {
			const n = new Date(clock.now);
			const pad = (x: number) => String(x).padStart(2, '0');
			at = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
		}
	}

	// ---- run it now ----
	let running = $state(false);
	async function runNow(checks: boolean) {
		if (!rule) return;
		const yes = await ask({
			title: checks ? `Run “${rule.name}” now?` : `Do the steps of “${rule.name}” now?`,
			body: checks
				? 'As if its moment came: its checks still decide, and if they pass it does its steps — on the house, for real.'
				: 'Its steps are done on the house, for real, whatever its checks say.',
			go: checks ? 'Run it' : 'Do the steps'
		});
		if (!yes) return;
		running = true;
		const res = await runRule(id, checks);
		running = false;
		note = res.ok
			? checks
				? 'Asked. What it did shows under Recent runs in a moment.'
				: 'Asked. Its steps are being done; they show under Recent runs in a moment.'
			: res.error;
		// A run its checks stop isn't announced; look anyway.
		if (res.ok) setTimeout(() => void loadHistory(), 1500);
	}

	// A different rule (a family member, a copy) is a different page.
	$effect(() => {
		void id;
		test = null;
		text = null;
		showText = false;
		note = null;
		void load();
		void loadHistory();
	});

	// ---- runs, folded open one at a time ----
	let open = $state<string | null>(null);
	const time = (iso: string) =>
		new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

	// ---- as text ----
	let text = $state<string | null>(null);
	let showText = $state(false);
	async function readText() {
		showText = !showText;
		if (!showText || text !== null || !rule) return;
		const res = await ronOf(id);
		text =
			res.ok && typeof res.data === 'string'
				? res.data
				: JSON.stringify($state.snapshot(rule), null, 2);
	}
</script>

{#snippet stepsOf(steps: Step[], top: boolean)}
	<ol class="steps" class:top>
		{#each steps as s, i (i)}
			<li class:off={s.off}>
				<span
					><Words words={s.words} />{#if s.off}<em> — turned off</em>{/if}</span
				>
				{#if s.branches}
					{#each s.branches as b, j (j)}
						{#if b.steps.length > 0}
							<div class="branch">
								{#if b.label}<span class="label">{b.label}</span>{/if}
								{@render stepsOf(b.steps, false)}
							</div>
						{/if}
					{/each}
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

{#if !session.can('automations:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else if failed}
	<p class="note bad" role="alert">{failed}</p>
{:else if all === null}
	<p class="quiet">Loading…</p>
{:else if !rule || !reading || !row}
	<p class="quiet">
		There’s no such rule — it may have been deleted. <a href="/settings/automations"
			>All automations</a
		>
	</p>
{:else}
	<div class="page">
		<header class="top">
			<div class="bar">
				<Toggle on={rule.enabled} label="On" disabled={!!madeBy} onchange={(on) => void turn(on)} />
				<span class="state">{rule.enabled ? 'On' : 'Off'}</span>
				<ul class="tags" aria-label="Tags">
					{#each rule.tags ?? [] as t (t)}
						<li>
							{t}
							{#if !madeBy}<button
									type="button"
									aria-label={`Remove the tag ${t}`}
									disabled={busy}
									onclick={() => dropTag(t)}><X size={14} aria-hidden="true" /></button
								>{/if}
						</li>
					{/each}
					{#if !madeBy}
						<li class="add">
							<input
								bind:value={newTag}
								placeholder="+ tag"
								aria-label="Add a tag"
								list="tags-known"
								onkeydown={(e) => e.key === 'Enter' && void addTag()}
								onblur={() => void addTag()}
							/>
							<datalist id="tags-known"
								>{#each knownTags as t (t)}<option value={t}></option>{/each}</datalist
							>
						</li>
					{/if}
				</ul>
				<span class="spacer"></span>
				{#if !madeBy}<a
						class="plain change"
						href={`/settings/automations/${encodeURIComponent(id)}/edit`}>Change</a
					>{/if}
				<button type="button" class="plain" disabled={busy} onclick={copy}>Make a copy</button>
				<button
					type="button"
					class="plain"
					onclick={() => download([$state.snapshot(rule) as Rule], fileName(rule))}>Export</button
				>
				{#if !madeBy}<button type="button" class="plain danger" onclick={remove}>Delete…</button
					>{/if}
			</div>
			<p class="sentence"><Words {words} /></p>

			{#if note}<p class="note" role="status">{note}</p>{/if}
			{#if madeBy}
				<p class="banner lit">
					{madeBy}’s definition made this rule, and changes it. Change it in
					<a href="/settings/modes">Modes</a>.
				</p>
			{/if}
			{#if rule.error}
				<p class="banner bad">homeCore can’t run it: {rule.error}</p>
			{/if}
			{#each fixes as f (f.id)}
				<div class="banner bad">
					<strong
						>It names “{f.id.replace(/^DELETED:/, '')}”, which homeCore has no device for. homeCore
						reports its steps as done, but nothing receives them.</strong
					>
					{#if f.to && !madeBy}
						<button type="button" disabled={busy} onclick={() => sendTo(f.id, f.to!.device_id)}
							>Send it to {displayName(f.to)} ({f.to.device_id})</button
						>
					{/if}
				</div>
			{/each}
			{#if onlyTells(rule)}
				<p class="banner lit">
					It only sends a message. If that’s about something staying open or on, an
					<a href="/settings/alerts">alert</a> says so without a rule — and clears itself.
				</p>
			{/if}
		</header>

		<div class="grid">
			<div class="main">
				<section class="card full" aria-label="The rule in full">
					<div class="part">
						<h2>When</h2>
						<p><Words words={capitalised(reading.when)} /></p>
					</div>
					{#if reading.checks.length > 0}
						<div class="part">
							<h2>Only if</h2>
							<ul class="checks">
								{#each reading.checks as c, i (i)}<li><Words words={c} /></li>{/each}
							</ul>
						</div>
					{/if}
					<div class="part">
						<h2>Do</h2>
						{#if reading.steps.length > 0}{@render stepsOf(reading.steps, true)}{:else}<p
								class="quiet"
							>
								Nothing.
							</p>{/if}
					</div>
					{#if reading.more.length > 0}
						<div class="part">
							<h2>More</h2>
							<ul class="checks">
								{#each reading.more as m (m)}<li>{m}</li>{/each}
							</ul>
						</div>
					{/if}
				</section>

				<section class="runs" aria-label="Recent runs">
					{#if runs.length === 0}
						<h2>Recent runs</h2>
						<p class="quiet">
							Nothing since homeCore started — it keeps the last 20 times each rule’s moment came,
							and forgets them when it restarts.
						</p>
					{:else}
						{#each runs as r, i (r.at + i)}
							{@const day = dayOf(r.at, clock.now)}
							{@const isOpen = open === r.at}
							{#if i === 0 || dayOf(runs[i - 1]!.at, clock.now) !== day}<h2>{day}</h2>{/if}
							<div class="run" class:open={isOpen}>
								<button
									type="button"
									aria-expanded={isOpen}
									onclick={() => (open = isOpen ? null : r.at)}
								>
									<span class="time">{time(r.at)}</span>
									<span class="pill {r.tone}">{r.outcome}</span>
									<span class="sum"><Words words={r.summary} /></span>
									{#if isOpen}<ChevronUp size={16} aria-hidden="true" />{:else}<ChevronDown
											size={16}
											aria-hidden="true"
										/>{/if}
								</button>
								{#if isOpen}
									<ol>
										{#each r.lines as l, j (j)}
											<li>
												<span class="k">{l.label}</span>
												<span class="v"><Words words={l.words} /></span>
												<span class="mark {l.tone}">{l.mark}</span>
											</li>
										{/each}
									</ol>
								{/if}
							</div>
						{/each}
						<p class="quiet">
							{runs.length === 1
								? 'The one time its moment came'
								: `The last ${runs.length} times its moment came`} since homeCore last started.
						</p>
					{/if}
				</section>
			</div>

			<aside>
				<section class="card side">
					<strong>Test it</strong>
					<span class="quiet"
						>Asks its checks about the house as it is {atTime ? 'then' : 'now'}. Nothing is done.</span
					>
					{#if features?.testAt}
						<div class="seg" role="radiogroup" aria-label="When">
							<button
								type="button"
								role="radio"
								aria-checked={!atTime}
								onclick={() => chooseTime(false)}>Now</button
							>
							<button
								type="button"
								role="radio"
								aria-checked={atTime}
								onclick={() => chooseTime(true)}>At a time…</button
							>
						</div>
						{#if atTime}
							<input
								class="when"
								type="datetime-local"
								bind:value={at}
								aria-label="The time to test at"
								oninput={() => (test = null)}
							/>
							<span class="quiet"
								>Times of day and how long things have lasted move to then; devices and modes stay
								as they are now.</span
							>
						{/if}
					{/if}
					<button type="button" class="go" disabled={testing || (atTime && !at)} onclick={runTest}
						>{testing ? 'Testing…' : 'Test'}</button
					>
					{#if test}
						<div class="result" class:yes={test.yes} role="status">
							<strong>{test.headline}</strong>
							{#if test.lines.length > 0}
								<ol>
									{#each test.lines as l, j (j)}
										<li>
											<span class="v"><Words words={l.words} /></span>{#if l.mark}<span
													class="mark {l.tone}">{l.mark}</span
												>{/if}
										</li>
									{/each}
								</ol>
							{/if}
						</div>
					{/if}
				</section>

				{#if features?.runNow}
					<section class="card side">
						<strong>Run it now</strong>
						<span class="quiet"
							>As if its moment came — even while it’s off. Its steps are done on the house.</span
						>
						<button type="button" class="go" disabled={running} onclick={() => runNow(true)}
							>Run it</button
						>
						{#if rule.conditions?.length || rule.required_expression || rule.trigger_condition}
							<button
								type="button"
								class="plainbtn"
								disabled={running}
								onclick={() => runNow(false)}>Do its steps, skipping its checks</button
							>
						{/if}
					</section>
				{/if}

				{#if kin.length > 0 && family}
					<section class="card side">
						<strong>{family.label}</strong>
						<span class="quiet"
							>{kin.length === 1 ? 'Another rule looks' : `${kin.length} other rules look`} like part
							of the same thing.</span
						>
						<ul class="kin">
							{#each kin as k (k.id)}
								<li>
									<a
										href={`/settings/automations/${encodeURIComponent(k.id)}`}
										class:off={!k.enabled}>{k.name}</a
									>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<section class="card side">
					<button type="button" class="disclose" aria-expanded={showText} onclick={readText}>
						<strong>As text</strong>
						{#if showText}<ChevronUp size={16} aria-hidden="true" />{:else}<ChevronDown
								size={16}
								aria-hidden="true"
							/>{/if}
					</button>
					{#if showText}
						<pre>{text ?? '…'}</pre>
					{/if}
				</section>
			</aside>
		</div>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	.top {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.state {
		font-weight: 700;
		margin-left: -4px;
	}
	.spacer {
		flex: 1;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tags li {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 30px;
		padding: 0 6px 0 12px;
		border-radius: 15px;
		background: var(--surface-2);
		color: var(--ink-muted);
		font-size: 13px;
		font-weight: 700;
	}
	.tags button {
		display: flex;
		border: none;
		background: none;
		padding: 4px;
		color: inherit;
	}
	.tags .add {
		padding: 0;
		background: none;
	}
	.tags input {
		width: 90px;
		height: 30px;
		padding: 0 12px;
		border-radius: 15px;
		border: 1px dashed var(--line);
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 13px;
	}
	.plain {
		height: 38px;
		padding: 0 16px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		font-size: 14px;
	}
	.change {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.plain.danger {
		color: var(--alert);
	}
	.sentence {
		margin: 0;
		max-width: 920px;
		font-size: 18px;
		line-height: 1.5;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.note.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0;
		padding: 10px 14px;
		border-radius: 12px;
		line-height: 1.45;
	}
	.banner strong {
		flex: 1 1 360px;
	}
	.banner.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.banner.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.banner a {
		color: inherit;
		font-weight: 700;
	}
	.banner button {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
		font: inherit;
		font-weight: 700;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
	}
	@media (min-width: 1000px) {
		.grid {
			grid-template-columns: minmax(0, 1fr) 360px;
		}
	}
	.main,
	aside {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.card {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.full {
		display: flex;
		flex-direction: column;
	}
	.part {
		display: grid;
		grid-template-columns: 80px minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		line-height: 1.5;
	}
	.part + .part {
		border-top: 1px solid var(--line);
	}
	.part h2 {
		padding-top: 3px;
	}
	.part p {
		margin: 0;
	}
	.checks {
		margin: 0;
		padding-left: 18px;
	}
	.steps {
		margin: 0;
		padding-left: 22px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.steps:not(.top) {
		list-style: disc;
	}
	.steps li.off {
		opacity: 0.55;
	}
	.branch {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 4px 0 2px;
	}
	.label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.runs {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.runs h2 {
		margin-top: var(--space-2);
	}
	.run {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.run.open {
		border-color: var(--accent);
	}
	.run > button {
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
	.run > button :global(svg) {
		flex: none;
		color: var(--ink-muted);
	}
	.time {
		flex: none;
		width: 48px;
		font-family: var(--font-num);
	}
	.pill {
		flex: none;
		height: 24px;
		padding: 0 10px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
	}
	.pill.good {
		background: color-mix(in srgb, #2f6b3a 14%, var(--surface));
		color: light-dark(#2f6b3a, #8fd19e);
	}
	.pill.quiet {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.pill.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.sum {
		flex: 1;
		min-width: 0;
		color: var(--ink-muted);
		font-size: 13.5px;
	}
	.run ol,
	.result ol {
		list-style: none;
		margin: 0;
		padding: 4px var(--space-4) var(--space-3) calc(var(--space-4) + 60px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--line);
	}
	.run li,
	.result li {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 4px var(--space-3);
		padding-top: 8px;
	}
	.k {
		width: 56px;
		flex: none;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.v {
		flex: 1 1 200px;
		min-width: 0;
	}
	.mark {
		font-weight: 700;
	}
	.mark.good {
		color: light-dark(#2f6b3a, #8fd19e);
	}
	.mark.bad {
		color: var(--alert);
	}
	.mark.muted,
	.mark.quiet {
		color: var(--ink-muted);
	}
	@media (max-width: 699px) {
		.run ol {
			padding-left: var(--space-4);
		}
		.part {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
	}
	.go {
		height: 40px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.seg {
		display: inline-flex;
		align-self: flex-start;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.seg button {
		height: 30px;
		padding: 0 12px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.when {
		height: 38px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.plainbtn {
		height: 36px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.go:disabled,
	.plainbtn:disabled {
		opacity: 0.5;
	}
	.result {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--surface-2);
	}
	.result ol {
		padding: 0;
		border: none;
		gap: 2px;
		font-size: 13.5px;
	}
	.result li {
		padding-top: 4px;
	}
	.kin {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kin a {
		color: var(--accent);
		font-weight: 600;
	}
	.kin a.off {
		opacity: 0.65;
	}
	.disclose {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: none;
		background: none;
		padding: 0;
		color: var(--ink);
		font: inherit;
	}
	pre {
		margin: 0;
		max-height: 420px;
		overflow: auto;
		font-family: var(--font-num);
		font-size: 12px;
		line-height: 1.45;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	em {
		font-style: normal;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
