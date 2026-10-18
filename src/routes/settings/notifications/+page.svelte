<!--
	Notifications (A0): where homeCore can send a message — homecore.toml's
	`[[notify.channels]]`, one channel at a time through the form engine, with
	a test send and the automations that use each.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { FormState } from '#lib/form.svelte.js';
	import { describe, valuesOf } from '#lib/descriptor.js';
	import { loadConfig, putConfig, restart } from '#lib/config.js';
	import {
		PROVIDERS,
		channelOf,
		channelsOf,
		descriptorFor,
		isProvider,
		nameProblem,
		rulesSendingTo,
		sendTest,
		summary,
		valuesOfChannel,
		type Channel,
		type Provider
	} from '#lib/notify.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import { loadRules } from '#lib/ruleAdmin.js';
	import { alertRules } from '#lib/admin.js';
	import type { AlertRule } from '#lib/alerts.js';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import SectionForm from '#lib/components/form/SectionForm.svelte';

	let channels = $state<Channel[] | null>(null);
	let batteryChannel = $state<string | null>(null);
	/** `[alerts] notify_channel`: where wet, smoke, jammed and offline alerts go. */
	let alertsChannel = $state<string | null>(null);
	let alertRuleList = $state<AlertRule[]>([]);
	let rules = $state<{ id: string; name: string; actions?: unknown }[]>([]);
	let trouble = $state<string | null>(null);
	let saving = $state(false);
	let saved = $state(false);

	async function load() {
		const got = await loadConfig();
		if (typeof got === 'string') return void (trouble = got);
		channels = channelsOf(got.config.parsed);
		const b = (got.config.parsed as { battery?: { notify_channel?: unknown } }).battery;
		batteryChannel = typeof b?.notify_channel === 'string' ? b.notify_channel : null;
		const a = (got.config.parsed as { alerts?: { notify_channel?: unknown } }).alerts;
		alertsChannel = typeof a?.notify_channel === 'string' ? a.notify_channel : null;
		trouble = null;
	}
	onMount(async () => {
		await load();
		const [res, alerting] = await Promise.all([loadRules(), alertRules()]);
		if (res.ok) rules = res.data;
		alertRuleList = alerting ?? [];
	});

	// ---- which channel: ?c=name, or ?new=type ----
	const askedName = $derived(page.url.searchParams.get('c'));
	const askedNew = $derived(page.url.searchParams.get('new'));
	const adding = $derived(page.url.searchParams.has('add'));
	const current = $derived(
		channels?.find((c) => c.name === askedName) ??
			(wide.current && askedNew === null && !adding ? channels?.[0] : undefined)
	);
	const type = $derived(askedNew !== null && isProvider(askedNew) ? askedNew : current?.type);
	const chosen = $derived(askedName !== null || askedNew !== null || adding);
	const open = (q: string) =>
		goto(`/settings/notifications${q}`, { replace: wide.current, reset: !wide.current });

	const form = new FormState();
	// A channel chosen (or a new one begun) starts a fresh form. Set before
	// the page draws, so the form never shows the last channel's fields.
	$effect.pre(() => {
		const t = type;
		const c = current;
		const isNew = askedNew !== null;
		if (t === undefined) return;
		untrack(() => {
			const d = descriptorFor(t);
			form.descriptor = d;
			form.load(isNew || !c ? {} : valuesOf(d, valuesOfChannel(c)));
			tested = null;
		});
	});

	const title = $derived(
		askedNew !== null
			? `New ${PROVIDERS[askedNew as Provider]?.label ?? ''} channel`
			: (current?.name ?? null)
	);
	$effect(() =>
		!wide.current && chosen
			? heading.show(adding ? 'Add a channel' : title, {
					href: '/settings/notifications',
					label: 'Notifications'
				})
			: undefined
	);

	// ---- saving ----
	const others = $derived((channels ?? []).filter((c) => askedNew !== null || c !== current));
	const draftName = $derived(String(form.draft.name ?? '').trim());
	const badName = $derived(nameProblem(draftName, others));
	const renaming = $derived(
		current !== undefined && askedNew === null && draftName !== current.name
	);
	const using = $derived(current ? rulesSendingTo(rules, current.name) : []);
	/** Everything else that sends here, in words: alert rules and homeCore's own alerts. */
	const alsoUsing = $derived.by(() => {
		if (!current) return [];
		const here = (c: string | null | undefined) => c === current.name || c === 'all';
		return [
			...alertRuleList
				.filter((r) => here(r.notify))
				.map((r) => ({
					what: `The alert rule “${r.name}”`,
					lost: `The alert rule “${r.name}” tells it, and will fail to.`
				})),
			...(here(alertsChannel)
				? [
						{
							what: 'Wet, smoke, jammed and offline alerts',
							lost: 'Wet, smoke, jammed and offline alerts are sent here.'
						}
					]
				: []),
			...(here(batteryChannel)
				? [{ what: 'Low-battery alerts', lost: 'Low-battery alerts are sent here.' }]
				: [])
		];
	});
	const blocked = $derived(
		badName ?? (form.blocked ? 'Fill in or fix the fields marked in red first.' : null)
	);
	const saveSummary = $derived(
		renaming && using.length > 0
			? `Renaming it: ${using.length === 1 ? 'one automation still uses' : `${using.length} automations still use`} “${current!.name}”.`
			: form.changes.map((c) => `${c.field.label}: ${describe(c.field, c.now)}`).join(' · ')
	);

	async function write(items: Channel[]): Promise<boolean> {
		saving = true;
		const err = await putConfig({ array_of_tables: { section: 'notify.channels', items } });
		saving = false;
		if (err) {
			trouble = err;
			return false;
		}
		saved = true;
		await load();
		return true;
	}

	async function save() {
		if (!channels || type === undefined) return;
		const next = channelOf(type, { ...form.draft, name: draftName });
		const items =
			askedNew !== null ? [...channels, next] : channels.map((c) => (c === current ? next : c));
		if (await write(items)) void open(`?c=${encodeURIComponent(next.name)}`);
	}

	async function remove() {
		if (!channels || !current) return;
		const lost = [
			...using.map((r) => `“${r.name}” sends here, and will fail to.`),
			...alsoUsing.map((w) => w.lost)
		];
		const yes = await ask({
			title: `Remove ${current.name}?`,
			body: 'It is taken out of homecore.toml. homeCore stops using it when it next restarts.',
			lost,
			go: 'Remove',
			danger: true
		});
		if (!yes) return;
		if (await write(channels.filter((c) => c !== current))) void open('');
	}

	// ---- test ----
	let tested = $state<{ ok: boolean; text: string } | null>(null);
	let testing = $state(false);
	/** What the test says; homeCore's own words when left empty. */
	let testText = $state('');
	async function test() {
		if (!current) return;
		testing = true;
		const err = await sendTest(current.name, testText);
		testing = false;
		const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		tested = err
			? { ok: false, text: err }
			: { ok: true, text: `A test went to ${current.name} at ${at} — check that it arrived.` };
	}
	// Every channel at once, from the list.
	let testedAll = $state<{ ok: boolean; text: string } | null>(null);
	async function testAll() {
		testedAll = null;
		testing = true;
		const err = await sendTest('all');
		testing = false;
		const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		testedAll = err
			? { ok: false, text: err }
			: { ok: true, text: `A test went to every channel at ${at} — check that each arrived.` };
	}

	async function restartNow() {
		const yes = await ask({
			title: 'Restart homeCore?',
			lost: [
				'Every screen in the house disconnects until it is back — usually under a minute.',
				'Plugins restart and reconnect to their devices.',
				'Automations don’t run while it is down.'
			],
			go: 'Restart',
			danger: true
		});
		if (!yes) return;
		trouble = await restart();
		if (!trouble) saved = false;
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Notifications are for admins.</p>
{:else if channels === null}
	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{:else}<p class="quiet">
			Loading…
		</p>{/if}
{:else}
	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	{#if saved}
		<div class="saved" role="status">
			<span
				><strong>Saved to homecore.toml.</strong> homeCore reads channels when it starts: restart it to
				use the change.</span
			>
			<button type="button" class="ghost" onclick={restartNow}>Restart homeCore…</button>
		</div>
	{/if}
	<ListDetail {chosen} label="Channels">
		{#snippet list()}
			<p class="quiet intro">
				Where homeCore can send a message. Automations name a channel; <code>all</code> sends to every
				one.
			</p>
			{#if channels!.length > 0}
				<ul class="channels">
					{#each channels! as c (c.name)}
						{@const p = isProvider(c.type) ? PROVIDERS[c.type] : null}
						<li>
							<a
								href={`?c=${encodeURIComponent(c.name)}`}
								aria-current={current === c && askedNew === null && !adding ? 'page' : undefined}
								onclick={(e) => {
									e.preventDefault();
									void open(`?c=${encodeURIComponent(c.name)}`);
								}}
							>
								<span class="mark" aria-hidden="true">{p?.mark ?? '?'}</span>
								<span class="text">
									<span class="name">{c.name}</span>
									<span class="sub">{p?.label ?? c.type} · {summary(c)}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">No channels yet. Add one so automations can reach your phone.</p>
			{/if}
			<button type="button" class="add" onclick={() => open('?add')}
				><Plus size={16} aria-hidden="true" />Add a channel</button
			>
			{#if channels!.length > 1}
				<button type="button" class="ghost all" disabled={testing} onclick={testAll}
					>Test every channel</button
				>
				{#if testedAll}
					<p class="tested" class:bad={!testedAll.ok} role="status">
						<strong>{testedAll.ok ? 'Sent.' : 'Not everywhere.'}</strong>
						{testedAll.text}
					</p>
				{/if}
			{/if}
		{/snippet}
		{#snippet detail()}
			{#if adding}
				<section class="card">
					{#if wide.current}<h2>Add a channel</h2>{/if}
					<p class="quiet">Which service should it send through?</p>
					<div class="providers">
						{#each Object.entries(PROVIDERS) as [id, p] (id)}
							<button type="button" onclick={() => open(`?new=${id}`)}>
								<span class="mark" aria-hidden="true">{p.mark}</span>{p.label}
							</button>
						{/each}
					</div>
				</section>
			{:else if type !== undefined && !isProvider(type)}
				<section class="card">
					<h2>{current?.name}</h2>
					<p class="quiet">
						A “{type}” channel — not one this app knows how to edit. Change it in homecore.toml.
					</p>
				</section>
			{:else if type !== undefined}
				<section class="card">
					<div class="head">
						{#if wide.current}<h2>{title}</h2>{/if}
						{#if current && askedNew === null}
							<button
								type="button"
								class="ghost"
								disabled={testing || form.dirty}
								title={form.dirty ? 'Save first: a test uses the saved channel' : undefined}
								onclick={test}>{testing ? 'Sending…' : 'Send a test'}</button
							>
						{/if}
					</div>
					{#if current && askedNew === null}
						<input
							class="test-text"
							bind:value={testText}
							placeholder="What the test says (optional)"
							aria-label="What the test says"
						/>
					{/if}
					{#if tested}
						<p class="tested" class:bad={!tested.ok} role="status">
							<strong>{tested.ok ? 'Sent.' : 'Didn’t send.'}</strong>
							{tested.text}
						</p>
					{/if}
					<SectionForm {form} section={form.descriptor.sections[0]!} showKeys={false} />
					{#if badName && form.draft.name !== undefined}
						<p class="problem" role="alert">{badName}</p>
					{/if}
					{#if current && askedNew === null}
						<div class="used">
							<h3>Sent here by</h3>
							{#if using.length === 0 && alsoUsing.length === 0}
								<p class="quiet">Nothing names this channel yet.</p>
							{:else}
								<ul>
									{#each using as r (r.id)}<li>{r.name}</li>{/each}
									{#each alsoUsing as w (w.what)}<li>{w.what}</li>{/each}
								</ul>
							{/if}
						</div>
						<div class="foot">
							<button type="button" class="danger" onclick={remove}>Remove this channel…</button>
							<span class="quiet"
								>Saved to the <code>[[notify.channels]]</code> list in homecore.toml.</span
							>
						</div>
					{/if}
				</section>
			{/if}
		{/snippet}
	</ListDetail>
	{#if form.dirty || askedNew !== null}
		<SaveBar
			count={Math.max(form.changes.length, 1)}
			summary={saveSummary}
			{saving}
			{blocked}
			{save}
			discard={() => (askedNew !== null ? open('') : form.discard())}
			saveLabel={askedNew !== null ? 'Add the channel' : 'Save'}
		/>
	{/if}
{/if}

<style>
	.intro {
		margin-bottom: var(--space-3);
	}
	.channels {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.channels a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 60px;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius);
		border: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.channels a[aria-current='page'] {
		background: var(--surface);
		border-color: var(--accent);
	}
	.mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--surface-2);
		font-weight: 700;
		font-size: 13px;
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		font-family: var(--font-num);
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.empty {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: var(--space-3);
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.card {
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	h2 {
		flex: 1;
		margin: 0;
		font-size: 20px;
		font-family: var(--font-num);
	}
	h3 {
		margin: 0 0 6px;
		font-size: 15px;
	}
	.providers {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.providers button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 56px;
		padding: 0 18px 0 10px;
		border-radius: var(--radius);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.tested {
		margin: 0;
		padding: var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		line-height: 1.45;
	}
	.tested.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.used {
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}
	.used ul {
		margin: 0;
		padding-left: 1.2em;
		line-height: 1.6;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}
	.ghost,
	.danger {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		font: inherit;
		font-weight: 700;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.ghost:disabled {
		opacity: 0.5;
	}
	.danger {
		border-color: var(--alert-line);
		background: none;
		color: var(--alert);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	code {
		font-family: var(--font-num);
	}
	.problem {
		margin: 0;
		color: var(--alert);
		font-weight: 600;
		font-size: 13px;
	}
	.trouble {
		margin: 0 0 var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--alert);
		font-weight: 600;
	}
	.saved {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		border: 1px solid var(--lit-card-line);
	}
	.saved span {
		flex: 1 1 260px;
	}
	.all {
		align-self: flex-start;
		margin-top: var(--space-2);
	}
	.test-text {
		height: 38px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
</style>
