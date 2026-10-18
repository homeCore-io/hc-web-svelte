<!--
	Automations (A2, doc 09): the house's rules, each in a sentence with the
	house's names, grouped by tag (E9) with families kept together (E4). What
	needs looking at first; search by device as well as by name; several at
	once — on, off, tag, export, delete; import and export.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Toggle from '#lib/components/Toggle.svelte';
	import Words from '#lib/components/rules/Words.svelte';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import type { Rule } from '#lib/ruleWords.js';
	import {
		counts,
		groupsOf,
		houseOf,
		rowsOf,
		shows,
		whenText,
		type Item,
		type LastRuns,
		type Row,
		type Show
	} from '#lib/ruleList.js';
	import { lastRuns } from '#lib/ruleRuns.js';
	import { featuresOf } from '#lib/ruleEdit.js';
	import {
		deleteRules,
		download,
		exportAll,
		history,
		importRules,
		changeGroup,
		createGroup,
		deleteGroup,
		loadGroups,
		loadRules,
		loadVocabulary,
		modeMade,
		retag,
		setEnabled,
		setGroupEnabled,
		setManyEnabled,
		withMembers,
		type Imported,
		type RuleGroup
	} from '#lib/ruleAdmin.js';

	// Someone who may read rules but not change them sees them, and nothing to press.
	const canWrite = $derived(session.can('automations:write'));

	// The filter lives in the address, so Back returns to the same list.
	const show = $derived((page.url.searchParams.get('show') as Show | null) ?? 'all');
	let query = $state(page.url.searchParams.get('q') ?? '');
	function set(key: string, value: string | null) {
		const next = new URL(page.url.href);
		if (value === null || value === '') next.searchParams.delete(key);
		else next.searchParams.set(key, value);
		void goto(`${next.pathname}${next.search}`, { replace: true, reset: false });
	}

	// ---- the rules, and what homeCore remembers of their runs ----
	let rules = $state<Rule[] | null>(null);
	let failed = $state<string | null>(null);
	let runs = $state<Record<string, LastRuns>>({});
	let byMode = $state<Record<string, string>>({});
	let groups = $state<RuleGroup[]>([]);

	async function load() {
		const res = await loadRules();
		if (!res.ok) {
			failed = res.error;
			return;
		}
		failed = null;
		rules = res.data;
		void readRuns(res.data.map((r) => r.id));
	}

	/** Each rule's history, a few at a time; the list fills in as they come. */
	async function readRuns(ids: string[]) {
		const queue = [...ids];
		const next: Record<string, LastRuns> = {};
		await Promise.all(
			Array.from({ length: 6 }, async () => {
				for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
					const res = await history(id);
					if (res.ok) next[id] = lastRuns(res.data);
				}
			})
		);
		runs = next;
	}

	// Combining needs several moments per rule and checks in if/otherwise (E2, E3).
	let canCombine = $state(false);

	onMount(() => {
		void load();
		void loadVocabulary().then((v) => {
			const f = featuresOf(v);
			canCombine = f.triggers && f.ifChecks;
		});
		void modeMade().then((m) => (byMode = m));
		void loadGroups().then((g) => (groups = g.ok ? g.data : []));
		// homeCore says when a rule fires, not when one changes.
		const stop = live.listen((frame) => {
			const f = frame as { type: string; rule_id?: string; timestamp?: string; rule?: Rule };
			if (f.type === 'rule_fired' && f.rule_id)
				runs = {
					...runs,
					[f.rule_id]: { ...runs[f.rule_id], ran: f.timestamp, tried: f.timestamp }
				};
			// Its moment came, but it couldn't settle its checks: tried, not ran.
			if (f.type === 'rule_evaluation_failed' && f.rule_id)
				runs = { ...runs, [f.rule_id]: { ...runs[f.rule_id], tried: f.timestamp } };
			// A homeCore with rule events says when one changes, by anyone.
			if (f.type === 'rule_changed' && f.rule && rules) {
				const changed = f.rule;
				rules = rules.some((r) => r.id === changed.id)
					? rules.map((r) => (r.id === changed.id ? changed : r))
					: [...rules, changed];
			}
			if (f.type === 'rule_removed' && rules) rules = rules.filter((r) => r.id !== f.rule_id);
		});
		const back = () => document.visibilityState === 'visible' && void load();
		document.addEventListener('visibilitychange', back);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', back);
		};
	});

	const house = $derived(houseOf(devices.byId, scenes.list, rules ?? []));
	const rows = $derived(rules ? rowsOf(rules, house, runs, byMode) : []);
	// A set chosen to look at narrows the list to its rules.
	const setId = $derived(page.url.searchParams.get('set'));
	const lookingAt = $derived(groups.find((g) => g.id === setId));
	const shown = $derived(
		rows.filter(
			(r) => shows(r, query, show) && (!lookingAt || lookingAt.rule_ids.includes(r.rule.id))
		)
	);
	const tally = $derived(counts(rows, query));
	const grouped = $derived(
		groupsOf(
			shown,
			rooms.list.map((r) => r.name)
		)
	);
	const onCount = $derived(rows.filter((r) => r.rule.enabled).length);

	const CHIPS: { id: Show; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'attention', label: 'Needs attention' },
		{ id: 'off', label: 'Off' },
		{ id: 'families', label: 'Families' }
	];

	// Families start folded, unless searching found something in one.
	let unfolded = $state<Record<string, boolean>>({});
	const isOpen = (key: string) => unfolded[key] ?? (query.trim() !== '' || show !== 'all');

	// ---- one at a time ----
	let note = $state<string | null>(null);
	let busy = $state(false);

	async function turn(rule: Rule, on: boolean) {
		const res = await setEnabled(rule.id, on);
		if (!res.ok) note = res.error;
		else rules = (rules ?? []).map((r) => (r.id === rule.id ? res.data : r));
	}

	async function turnTag(tag: string, title: string, on: boolean) {
		const n = rows.filter((r) => r.rule.tags?.includes(tag) && r.rule.enabled !== on).length;
		if (n === 0) return;
		const yes = await ask({
			title: `Turn ${on ? 'on' : 'off'} ${n === 1 ? 'one rule' : `${n} rules`} tagged “${title}”?`,
			go: on ? 'Turn on' : 'Turn off'
		});
		if (!yes) return;
		const ids = rows.filter((r) => r.rule.tags?.includes(tag)).map((r) => r.rule.id);
		const res = await setManyEnabled(ids, on);
		note = res.ok
			? `${title}: ${n === 1 ? 'one rule' : `${n} rules`} turned ${on ? 'on' : 'off'}.`
			: res.error;
		await load();
	}

	async function turnGroup(g: RuleGroup, on: boolean) {
		const res = await setGroupEnabled(g.id, on);
		note = res.ok ? `${g.name}: turned ${on ? 'on' : 'off'}.` : res.error;
		await load();
	}

	// ---- sets: made, renamed, filled, removed ----
	const reloadGroups = async () => {
		const g = await loadGroups();
		if (g.ok) groups = g.data;
	};
	/** The set being changed ('new' for one being made), and its form. */
	let editing = $state<string | null>(null);
	let setName = $state('');
	let setAbout = $state('');
	function editSet(g: RuleGroup | null) {
		editing = g ? g.id : 'new';
		setName = g?.name ?? '';
		setAbout = g?.description ?? '';
	}
	const nameTaken = (name: string, except?: string) =>
		groups.some((g) => g.id !== except && g.name.trim().toLowerCase() === name.toLowerCase());
	const setProblem = $derived.by(() => {
		const name = setName.trim();
		if (name === '') return 'A set needs a name.';
		if (nameTaken(name, editing ?? undefined)) return `There is already a set called “${name}”.`;
		return null;
	});

	async function saveSet() {
		if (setProblem || !editing) return;
		busy = true;
		const name = setName.trim();
		const about = setAbout.trim();
		const was = groups.find((g) => g.id === editing);
		const res = was
			? await changeGroup(was.id, {
					name,
					...(about !== (was.description ?? '') ? { description: about } : {})
				})
			: await createGroup(
					name,
					selected.filter((r) => !byMode[r.id]).map((r) => r.id),
					about || undefined
				);
		busy = false;
		if (!res.ok) {
			note = res.error;
			return;
		}
		note = was
			? `Set “${name}” saved.`
			: `Set “${name}” made${res.data.rule_ids.length ? ` with ${count(res.data.rule_ids.length).toLowerCase()}` : ''}.`;
		if (!was) picked = {};
		editing = null;
		await reloadGroups();
	}

	async function removeSet(g: RuleGroup) {
		const yes = await ask({
			title: `Delete the set “${g.name}”?`,
			body: 'Its rules stay as they are, on or off. Only the set goes.',
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const res = await deleteGroup(g.id);
		note = res.ok ? `Set “${g.name}” deleted.` : res.error;
		if (res.ok) {
			editing = null;
			if (setId === g.id) set('set', null);
		}
		await reloadGroups();
	}

	/** Ids a set still holds for rules that have since been deleted. */
	const goneFrom = (g: RuleGroup) =>
		rules ? g.rule_ids.filter((id) => !rules!.some((r) => r.id === id)) : [];
	async function forgetGone(g: RuleGroup) {
		const gone = goneFrom(g);
		const res = await changeGroup(g.id, { rule_ids: withMembers(g, gone, false) });
		note = res.ok
			? `${g.name}: forgot ${gone.length === 1 ? 'one deleted rule' : `${gone.length} deleted rules`}.`
			: res.error;
		await reloadGroups();
	}

	let intoSet = $state('');
	async function bulkSet(add: boolean) {
		const g = groups.find((x) => x.id === intoSet);
		if (!g) return;
		const ids = selected.filter((r) => !add || !byMode[r.id]).map((r) => r.id);
		const next = withMembers(g, ids, add);
		const moved = Math.abs(next.length - g.rule_ids.length);
		busy = true;
		const res = await changeGroup(g.id, { rule_ids: next });
		busy = false;
		note = res.ok
			? moved === 0
				? `${add ? 'They were all in' : 'None of them was in'} “${g.name}” already.`
				: `${count(moved)} ${add ? 'added to' : 'taken out of'} “${g.name}”.`
			: res.error;
		if (res.ok) picked = {};
		await reloadGroups();
	}

	// ---- several at once ----
	let picked = $state<Record<string, boolean>>({});
	const selected = $derived(rows.filter((r) => picked[r.rule.id]).map((r) => r.rule));
	const pick = (id: string) => (picked = { ...picked, [id]: !picked[id] });
	const pickAll = (list: Row[]) => {
		const all = list.every((r) => picked[r.rule.id]);
		const next = { ...picked };
		for (const r of list) next[r.rule.id] = !all;
		picked = next;
	};
	let tagText = $state('');

	async function bulkTurn(on: boolean) {
		busy = true;
		const res = await setManyEnabled(
			selected.map((r) => r.id),
			on
		);
		busy = false;
		note = res.ok
			? `${count(selected.length)} turned ${on ? 'on' : 'off'}.${selected.some((r) => byMode[r.id]) ? ' Rules a mode made are left as they are.' : ''}`
			: res.error;
		if (res.ok) picked = {};
		await load();
	}

	async function bulkTag(add: boolean) {
		const tag = tagText.trim().toLowerCase();
		if (tag === '') return;
		busy = true;
		const res = await retag(
			selected.filter((r) => !byMode[r.id]),
			tag,
			add
		);
		busy = false;
		note = res.error ?? `${count(res.done)} ${add ? 'tagged' : 'untagged'} “${tag}”.`;
		if (!res.error) {
			picked = {};
			tagText = '';
		}
		await load();
	}

	async function bulkDelete() {
		const list = selected.filter((r) => !byMode[r.id]);
		const yes = await ask({
			title: `Delete ${list.length === 1 ? `“${list[0]!.name}”` : `${list.length} rules`}?`,
			body:
				list.length > 1
					? list
							.slice(0, 8)
							.map((r) => r.name)
							.join(', ') + (list.length > 8 ? `, and ${list.length - 8} more` : '')
					: undefined,
			lost: [
				'They stop running, and their files go.',
				'Export them first to keep a copy you can import again.'
			],
			go: 'Delete',
			danger: true,
			typed: list.length > 5 ? 'delete' : undefined
		});
		if (!yes) return;
		busy = true;
		const res = await deleteRules(list.map((r) => r.id));
		busy = false;
		note = res.error
			? `${count(res.done)} deleted, then: ${res.error}`
			: `${count(res.done)} deleted.`;
		picked = {};
		await load();
	}

	const count = (n: number) => (n === 1 ? 'One rule' : `${n} rules`);
	const stamp = () => new Date().toISOString().slice(0, 10);

	// ---- import and export ----
	async function exportEvery() {
		const res = await exportAll();
		if (res.ok) download(res.data, `homecore-rules-${stamp()}.json`);
		else note = res.error;
	}

	let file = $state<HTMLInputElement | null>(null);
	let imported = $state<Imported | null>(null);
	async function importFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (!f) return;
		const text = await f.text();
		input.value = '';
		let n = 0;
		try {
			const list = JSON.parse(text);
			n = Array.isArray(list) ? list.length : 1;
		} catch {
			// importRules says so.
		}
		if (n > 0) {
			const yes = await ask({
				title: `Add ${n === 1 ? 'one rule' : `${n} rules`} from ${f.name}?`,
				body: 'Each is added as a new rule, as it is in the file — on or off. Rules already here that are the same aren’t replaced: you’ll have both.',
				go: 'Add'
			});
			if (!yes) return;
		}
		imported = await importRules(text);
		if (imported.imported > 0) {
			note = `${count(imported.imported)} added.`;
			imported = null;
			await load();
		}
	}
</script>

{#snippet rowOf(row: Row, inFamily = false)}
	{@const r = row.rule}
	{@const last = runs[r.id]}
	{@const href = `/settings/automations/${encodeURIComponent(r.id)}`}
	<div class="row" class:off={!r.enabled} class:kin={inFamily} class:picked={picked[r.id]}>
		{#if wide.current && canWrite}
			<input
				type="checkbox"
				aria-label={`Select ${r.name}`}
				checked={!!picked[r.id]}
				onchange={() => pick(r.id)}
			/>
			<Toggle
				on={r.enabled}
				label={`${r.name} on`}
				disabled={!!row.byMode}
				onchange={(on) => void turn(r, on)}
			/>
		{/if}
		<a class="say" {href}>
			<span class="words"><Words words={row.words} /></span>
			<span class="meta">
				<span class="name">{r.name}</span>
				{#if !wide.current && !r.enabled}<span>· off</span>{/if}
				{#if row.byMode}<span>· made by {row.byMode}</span>{/if}
			</span>
		</a>
		<span
			class="last"
			title={last?.tried && last.tried !== last.ran
				? `Last checked ${whenText(last.tried, clock.now)}`
				: undefined}>{last?.ran ? `ran ${whenText(last.ran, clock.now)}` : ''}</span
		>
		{#if !wide.current}<ChevronRight size={18} aria-hidden="true" />{/if}
	</div>
	{#if row.trouble.length > 0}
		<a class="trouble bad" {href}>{row.trouble.join(' · ')}</a>
	{:else if row.alertish && r.enabled !== false && show !== 'off'}
		<p class="trouble lit">
			It only sends a message. If it’s about something staying open or on, an
			<a href="/settings/alerts">alert</a> does that without a rule.
		</p>
	{/if}
{/snippet}

{#snippet setForm(g: RuleGroup | null)}
	<form
		class="set-form"
		onsubmit={(e) => {
			e.preventDefault();
			void saveSet();
		}}
	>
		<label>Name <input bind:value={setName} required /></label>
		<label>What it’s for <input bind:value={setAbout} placeholder="Optional" /></label>
		{#if setProblem && setName.trim() !== ''}<p class="bad" role="alert">{setProblem}</p>{/if}
		{#if !g && selected.length}
			<p class="quiet">
				It starts with the {selected.length === 1
					? 'selected rule'
					: `${selected.length} selected rules`}{selected.some((r) => byMode[r.id])
					? ', leaving out rules a mode made'
					: ''}.
			</p>
		{/if}
		<div class="buttons">
			<button type="submit" disabled={busy || !!setProblem}>{g ? 'Save' : 'Make the set'}</button>
			<button type="button" class="plain" onclick={() => (editing = null)}>Cancel</button>
			{#if g && goneFrom(g).length}
				<button type="button" class="plain" onclick={() => forgetGone(g)}
					>Forget the deleted rules</button
				>
			{/if}
			{#if g}
				<span class="spacer"></span>
				<button type="button" class="danger" onclick={() => removeSet(g)}>Delete set…</button>
			{/if}
		</div>
	</form>
{/snippet}

{#snippet itemOf(item: Item)}
	{#if 'row' in item}
		{@render rowOf(item.row)}
	{:else}
		{@const open = isOpen(item.family.key)}
		{@const on = item.rows.filter((r) => r.rule.enabled).length}
		<div class="family" class:open>
			{#if wide.current && canWrite}
				<input
					type="checkbox"
					aria-label={`Select the ${item.rows.length} rules of ${item.family.label}`}
					checked={item.rows.every((r) => picked[r.rule.id])}
					onchange={() => pickAll(item.rows)}
				/>
			{/if}
			<button
				type="button"
				aria-expanded={open}
				onclick={() => (unfolded = { ...unfolded, [item.family.key]: !open })}
			>
				{#if open}<ChevronDown size={18} aria-hidden="true" />{:else}<ChevronRight
						size={18}
						aria-hidden="true"
					/>{/if}
				<strong>{item.family.label}</strong>
				<span class="chip"
					>{item.rows.length} rules{on < item.rows.length
						? `, ${item.rows.length - on} off`
						: ''}</span
				>
				{#if item.rows.some((r) => r.trouble.length)}<span class="chip bad">needs attention</span
					>{/if}
			</button>
			{#if canCombine}
				<a
					class="link"
					href={`/settings/automations/new?combine=${item.rows.map((r) => r.rule.id).join(',')}`}
					>Combine…</a
				>
			{/if}
		</div>
		{#if open}
			{#each item.rows as row (row.rule.id)}{@render rowOf(row, true)}{/each}
		{/if}
	{/if}
{/snippet}

{#if !session.can('automations:read')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="page">
		<div class="tools">
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					onchange={() => set('q', query.trim())}
					placeholder="A device, a room or a rule"
					aria-label="Find automations"
				/>
			</label>
			<div class="chips" role="group" aria-label="Show">
				{#each CHIPS as c (c.id)}
					<button
						type="button"
						aria-pressed={show === c.id}
						class:bad={c.id === 'attention' && tally.attention > 0}
						onclick={() => set('show', c.id === 'all' ? null : c.id)}
						>{c.label} <span class="n">{tally[c.id]}</span></button
					>
				{/each}
			</div>
			<span class="spacer"></span>
			{#if canWrite}
				<a class="new" href="/settings/automations/new">+ New automation</a>
				<button type="button" class="plain" onclick={() => file?.click()}>Import…</button>
			{/if}
			<button type="button" class="plain" onclick={exportEvery}>Export all</button>
			<input
				bind:this={file}
				type="file"
				accept="application/json,.json"
				hidden
				onchange={importFile}
			/>
		</div>

		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if imported?.error}
			<div class="failures" role="alert">
				<strong>Nothing was added. {imported.error}</strong>
				{#if imported.failures?.length}
					<ul>
						{#each imported.failures as f (f.index)}<li>
								<b>{f.name || `Rule ${f.index + 1}`}</b>: {f.error}
							</li>{/each}
					</ul>
					<span
						>homeCore adds all of a file or none of it. Change those, or take them out of the file,
						and try again.</span
					>
				{/if}
				<button type="button" class="plain" onclick={() => (imported = null)}>Close</button>
			</div>
		{/if}

		{#if rules && rows.length > 0}
			<section class="sets" aria-label="Sets of rules">
				<header>
					<h2>Sets</h2>
					{#if editing !== 'new' && canWrite}
						<button type="button" class="link" onclick={() => editSet(null)}
							>{selected.length
								? `New set of the ${selected.length} selected…`
								: 'New set…'}</button
						>
					{/if}
				</header>
				{#if groups.length === 0 && editing !== 'new'}
					<p class="quiet">
						A set is rules you turn on and off together — for when you’re away, say. Select rules
						and make one, or make it empty and add rules later.
					</p>
				{/if}
				{#each groups as g (g.id)}
					{@const inSet = rows.filter((r) => g.rule_ids.includes(r.rule.id))}
					{@const gone = goneFrom(g)}
					<div class="set" class:looking={setId === g.id}>
						<span
							><strong>{g.name}</strong> · {inSet.filter((r) => r.rule.enabled).length} of {inSet.length}
							on{#if gone.length}<span class="gone">
									· {gone.length === 1 ? 'one deleted rule' : `${gone.length} deleted rules`}</span
								>{/if}
							{#if g.description}<small>{g.description}</small>{/if}</span
						>
						<button
							type="button"
							class="plain"
							aria-pressed={setId === g.id}
							onclick={() => set('set', setId === g.id ? null : g.id)}
							>{setId === g.id ? 'Show all' : 'Show'}</button
						>
						{#if canWrite}
							<button
								type="button"
								class="plain"
								disabled={inSet.length === 0}
								onclick={() => turnGroup(g, true)}>All on</button
							>
							<button
								type="button"
								class="plain"
								disabled={inSet.length === 0}
								onclick={() => turnGroup(g, false)}>All off</button
							>
							<button
								type="button"
								class="plain"
								aria-expanded={editing === g.id}
								onclick={() => (editing === g.id ? (editing = null) : editSet(g))}>Change…</button
							>
						{/if}
					</div>
					{#if editing === g.id}{@render setForm(g)}{/if}
				{/each}
				{#if editing === 'new'}{@render setForm(null)}{/if}
			</section>
		{/if}

		{#if lookingAt}
			<p class="note" role="status">
				Showing the set “{lookingAt.name}”.
				<button type="button" class="link" onclick={() => set('set', null)}>Show all rules</button>
			</p>
		{/if}

		{#if failed}
			<p class="note bad" role="alert">{failed}</p>
		{:else if rules === null}
			<p class="quiet">Loading rules…</p>
		{:else if shown.length === 0}
			<p class="quiet">{rows.length === 0 ? 'The house has no rules yet.' : 'No rule matches.'}</p>
		{:else}
			{#each grouped as g (g.tag)}
				<section class="group">
					<header>
						<h2>{g.title} <span class="n">{g.count}</span></h2>
						{#if g.tag !== '' && wide.current && canWrite}
							<button type="button" class="link" onclick={() => turnTag(g.tag, g.title, true)}
								>All on</button
							>
							<button type="button" class="link" onclick={() => turnTag(g.tag, g.title, false)}
								>All off</button
							>
						{/if}
					</header>
					<div class="card">
						{#each g.items as item ('row' in item ? item.row.rule.id : item.family.key)}
							{@render itemOf(item)}
						{/each}
					</div>
				</section>
			{/each}
		{/if}
		{#if rules}
			<p class="quiet">
				{rows.length === 1 ? 'One rule' : `${rows.length} rules`}, {onCount} on. A rule with two tags
				is under both.
			</p>
		{/if}
	</div>

	{#if selected.length > 0}
		<div class="bulk" role="region" aria-label="Selected rules">
			<strong>{selected.length} selected</strong>
			<button type="button" disabled={busy} onclick={() => bulkTurn(true)}>Turn on</button>
			<button type="button" disabled={busy} onclick={() => bulkTurn(false)}>Turn off</button>
			<span class="tag">
				<input bind:value={tagText} placeholder="A tag" aria-label="Tag" list="known-tags" />
				<button type="button" disabled={busy || tagText.trim() === ''} onclick={() => bulkTag(true)}
					>Tag</button
				>
				<button
					type="button"
					disabled={busy || tagText.trim() === ''}
					onclick={() => bulkTag(false)}>Untag</button
				>
			</span>
			{#if groups.length}
				<span class="tag">
					<select bind:value={intoSet} aria-label="Set">
						<option value="">A set…</option>
						{#each groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
					</select>
					<button type="button" disabled={busy || !intoSet} onclick={() => bulkSet(true)}
						>Add to set</button
					>
					<button type="button" disabled={busy || !intoSet} onclick={() => bulkSet(false)}
						>Take out</button
					>
				</span>
			{/if}
			<datalist id="known-tags">
				{#each [...new Set(rows.flatMap((r) => r.rule.tags ?? []))].sort() as t (t)}<option
						value={t}
					></option>{/each}
			</datalist>
			<button
				type="button"
				disabled={busy}
				onclick={() => download($state.snapshot(selected), `homecore-rules-${stamp()}.json`)}
				>Export</button
			>
			<button type="button" class="danger" disabled={busy} onclick={bulkDelete}>Delete…</button>
			<button type="button" class="clear" aria-label="Clear selection" onclick={() => (picked = {})}
				><X size={18} aria-hidden="true" /></button
			>
		</div>
	{/if}
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.spacer {
		flex: 1;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 260px;
		max-width: 420px;
		height: 42px;
		padding: 0 var(--space-3);
		border-radius: 21px;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--ink-muted);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		color: var(--ink);
		font: inherit;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips button {
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.chips button.bad {
		color: var(--alert);
		border-color: var(--alert-line);
	}
	.chips button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.n {
		opacity: 0.7;
		font-family: var(--font-num);
		font-weight: 500;
	}
	.plain {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.new {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		display: inline-flex;
		align-items: center;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
	}
	.link {
		border: none;
		background: none;
		padding: 0 4px;
		color: var(--accent);
		font: inherit;
		font-size: 12px;
		font-weight: 700;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.group header {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0 4px;
	}
	h2 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.group header h2 {
		flex: 1;
	}
	.card {
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.card > :global(* + *) {
		border-top: 1px solid var(--line);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
	}
	.row.kin {
		padding-left: calc(var(--space-4) + 28px);
		background: color-mix(in srgb, var(--surface-2) 35%, var(--surface));
	}
	.row.picked {
		background: var(--nav-on);
	}
	.row > :global(svg) {
		flex: none;
		color: var(--ink-muted);
	}
	.say {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--ink);
		text-decoration: none;
		line-height: 1.45;
	}
	.off .say {
		opacity: 0.6;
	}
	.say:hover .words {
		text-decoration: underline;
		text-decoration-color: var(--line);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.last {
		flex: none;
		width: 120px;
		text-align: right;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	@media (max-width: 699px) {
		.last {
			width: auto;
			max-width: 84px;
		}
	}
	.trouble {
		display: block;
		margin: 0;
		padding: 8px var(--space-4) 10px calc(var(--space-4) + 98px);
		font-size: 13px;
		font-weight: 600;
		line-height: 1.45;
		text-decoration: none;
		border-top: none !important;
	}
	@media (max-width: 699px) {
		.trouble {
			padding-left: var(--space-4);
		}
	}
	.trouble.bad {
		color: var(--alert);
	}
	.trouble.lit {
		color: var(--lit-ink);
		font-weight: 500;
	}
	.trouble.lit a {
		color: inherit;
		font-weight: 700;
	}
	.family {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 6px var(--space-4);
	}
	.family button {
		flex: 1;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2);
		min-height: 40px;
		border: none;
		background: none;
		padding: 0;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.family button :global(svg) {
		color: var(--ink-muted);
	}
	.chip {
		height: 24px;
		padding: 0 10px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		font-size: 12px;
		font-weight: 700;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.chip.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.sets {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sets header {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}
	.set {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.set.looking {
		border-color: var(--accent);
	}
	.set > span {
		flex: 1 1 200px;
	}
	.set small {
		display: block;
		color: var(--ink-muted);
	}
	.set .gone,
	.set-form .bad {
		color: var(--alert);
	}
	.set-form .danger {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
		font: inherit;
		font-weight: 600;
	}
	.set-form .spacer {
		flex: 1;
	}
	.set-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.set-form label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 13px;
		font-weight: 600;
	}
	.set-form input {
		max-width: 420px;
		height: 38px;
		padding: 0 var(--space-3);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.set-form button[type='submit'] {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
		font-size: 13px;
	}
	.set-form button:disabled {
		opacity: 0.5;
	}
	.set-form .buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.set-form p {
		margin: 0;
		font-size: 13px;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.note.bad,
	.failures {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.failures {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
	}
	.failures ul {
		margin: 0;
		padding-left: 18px;
		color: var(--ink);
	}
	.failures span {
		color: var(--ink);
		font-size: 13px;
	}
	.bulk {
		position: sticky;
		bottom: calc(72px + env(safe-area-inset-bottom));
		z-index: 3;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
		margin-top: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--bg);
		box-shadow: var(--shadow);
	}
	@media (min-width: 700px) and (orientation: landscape), (min-width: 1100px) {
		.bulk {
			bottom: var(--space-4);
		}
	}
	.bulk strong {
		flex: 1;
	}
	.bulk button,
	.bulk input {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		border: 1px solid color-mix(in srgb, var(--bg) 40%, transparent);
		background: none;
		color: var(--bg);
		font: inherit;
		font-weight: 700;
	}
	.bulk select {
		height: 36px;
		max-width: 160px;
		padding: 0 10px;
		border-radius: 18px;
		border: 1px solid color-mix(in srgb, var(--bg) 40%, transparent);
		background: var(--ink);
		color: var(--bg);
		font: inherit;
	}
	.bulk input {
		width: 120px;
		font-weight: 500;
	}
	.bulk input::placeholder {
		color: color-mix(in srgb, var(--bg) 60%, transparent);
	}
	.bulk .tag {
		display: flex;
		gap: 6px;
	}
	.bulk .danger {
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
	}
	.bulk .clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		padding: 0;
	}
	.bulk button:disabled {
		opacity: 0.5;
	}
</style>
