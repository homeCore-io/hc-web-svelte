<!--
	Time rules for alerts (C9): "the garage door open after 22:00", "the front
	door unlocked for 30 minutes". homeCore checks them whether or not any
	screen is open, and raises and clears the alert (M6, H4). The built-in
	ones — wet, smoke, offline, jammed, low battery — need no rule.

	One form adds a rule or changes one (tap its row): several devices that
	share the state, and a name of your own or one made from what it watches.

	From homeCore 0.1.81 a rule can watch a reading go over or under a line
	and tell a notification channel, and what's been ignored (from Alerts)
	is listed here to show again.

	Under each rule, each of homeCore's own kinds and each plugin's kind of
	alert, "When it happens:" names the automations it starts — worked out
	by homeCore from their triggers, so ones made by hand are there too — and
	"+ Do something…" makes another. Deleting a rule that starts some asks
	what becomes of them.
-->
<script lang="ts">
	import { alertKinds, pluginName } from '#lib/alertKinds.svelte.js';
	$effect(() => alertKinds.ensure());
	import { readingText, shownUnit } from '#lib/units.js';
	import { onMount, tick } from 'svelte';
	import { onReturn } from '#lib/refresh.js';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		describeIgnore,
		describeRule,
		devicesFor,
		levelChoices,
		levelLabel,
		fromLevel,
		toLevel,
		ranOut,
		ruleName,
		sameState,
		stateChoices,
		type AlertIgnore,
		type AlertRule,
		type StateChoice
	} from '#lib/alerts.js';
	import {
		alertIgnores,
		alertRules,
		createAlertRule,
		deleteAlertRule,
		saveAlertRule,
		unignore
	} from '#lib/admin.js';
	import { core } from '#lib/core.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { loadConfig } from '#lib/config.js';
	import { channelsOf } from '#lib/notify.js';
	import { alertLinks } from '#lib/alertLinks.svelte.js';
	import { houseNames } from '#lib/alertNames.svelte.js';
	import {
		OWN,
		OWN_KINDS,
		bySource,
		kindSource,
		linkName,
		pluginKey,
		pluginSource,
		ruleSource,
		scopesForKind,
		scopesForPluginKind,
		scopesForRule,
		type AutomationAlerts,
		type Scope,
		type Start
	} from '#lib/alertStarts.js';
	import { alertRuleStarts, deleteAlertRuleWith, type RuleStarts } from '#lib/admin.js';
	import DoSomething from '#lib/components/DoSomething.svelte';

	let rules = $state<AlertRule[] | null>(null);
	let ignores = $state<AlertIgnore[] | null>(null);
	let trouble = $state<string | null>(null);
	const reload = async () => {
		[rules, ignores] = await Promise.all([alertRules(), alertIgnores()]);
	};
	// Levels and channels are homeCore 0.1.81's; channel names are in its
	// settings, which only an admin reads.
	const newer = $derived(core.since('0.1.81'));
	let channels = $state<string[]>([]);
	onMount(() => {
		void reload();
		void alertLinks.load();
		const stop = onReturn(() => {
			void alertLinks.load();
			return reload();
		});
		if (session.isAdmin)
			void loadConfig().then((got) => {
				if (typeof got !== 'string') channels = channelsOf(got.config.parsed).map((c) => c.name);
			});
		return stop;
	});

	const all = $derived(
		Object.values(devices.byId)
			.filter((d) => stateChoices(d).length > 0 || (newer && levelChoices(d).length > 0))
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const label = (d: (typeof all)[number]) =>
		`${displayName(d)} — ${roomOf(d, rooms.list)?.name ?? 'no room'}`;
	const nameOf = (id: string) => (devices.byId[id] ? displayName(devices.byId[id]) : id);

	/** A rule's state, in the device's words. */
	function stateOf(r: AlertRule): string {
		if (r.state_label) return r.state_label;
		if (r.op === 'above' || r.op === 'below') return `${r.attribute} ${r.op} ${String(r.value)}`;
		if (r.op === 'ne') return `${r.attribute} isn’t ${String(r.value)}`;
		const d = devices.byId[r.device_ids[0] ?? ''];
		const c = d && stateChoices(d).find((c) => sameState(c, r));
		return c?.label ?? `${r.attribute} is ${String(r.value)}`;
	}
	const devicesOf = (r: AlertRule) => r.device_ids.map(nameOf).join(', ');

	// ---- the form: a new rule, or one being changed ----
	let editing = $state<AlertRule | null>(null);
	let name = $state('');
	let ids = $state<string[]>(['']);
	let stateKey = $state('');
	let after = $state('');
	let until = $state('');
	let forMinutes = $state<number | null>(null);
	let critical = $state(false);
	let level = $state<number | null>(null);
	let notify = $state('');
	let saving = $state(false);
	let form = $state<HTMLElement | undefined>(undefined);

	const keyOf = (c: Pick<StateChoice, 'attribute' | 'value'> & { op?: string }) =>
		c.op === 'above' || c.op === 'below'
			? `${c.attribute}~${c.op}`
			: `${c.attribute}=${JSON.stringify(c.value)}`;
	const first = $derived(devices.byId[ids[0] ?? '']);
	// The first device's states — and, when changing a rule, its own state even
	// if the device no longer reports it, so a save never quietly changes it.
	const choices = $derived.by(() => {
		const out = first ? [...stateChoices(first), ...(newer ? levelChoices(first) : [])] : [];
		const r = editing;
		if (r && !out.some((c) => sameState(c, r)))
			out.push({
				attribute: r.attribute,
				value: r.value,
				label: stateOf(r),
				...(r.op === 'above' || r.op === 'below' ? { op: r.op } : {})
			});
		return out;
	});
	const chosen = $derived(choices.find((c) => keyOf(c) === stateKey));
	// More devices: those with the same state that aren't in the rule yet.
	const others = $derived(
		chosen ? devicesFor(all, chosen).filter((d) => !ids.includes(d.device_id)) : []
	);
	/** The chosen state in words: a level's with its number. */
	const stateWords = $derived(
		!chosen ? '' : chosen.op ? (level === null ? '' : levelLabel(chosen, level)) : chosen.label
	);
	const said = $derived(
		stateWords
			? describeRule(
					{ after: after || null, until: until || null, for_minutes: forMinutes },
					stateWords
				)
			: ''
	);
	const picked = $derived(ids.filter((id) => id !== ''));
	const autoName = $derived(said ? ruleName(picked.map(nameOf), said) : '');

	function reset() {
		editing = null;
		name = '';
		ids = [''];
		stateKey = '';
		after = until = '';
		forMinutes = null;
		critical = false;
		level = null;
		notify = '';
	}
	async function change(r: AlertRule) {
		editing = r;
		ids = r.device_ids.length ? [...r.device_ids] : [''];
		stateKey = keyOf(r);
		after = r.after ?? '';
		until = r.until ?? '';
		forMinutes = r.for_minutes ?? null;
		critical = r.severity === 'critical';
		// The line in the person's units: a rule kept at 30 °C is changed as 86 °F.
		const unit = devices.byId[r.device_ids[0] ?? '']?.schema?.attributes?.[r.attribute]?.unit;
		level = r.op === 'above' || r.op === 'below' ? fromLevel({ unit }, Number(r.value)) : null;
		notify = r.notify ?? '';
		// A name its maker typed stays theirs; one the app made follows the rule.
		const made = [
			ruleName(r.device_ids.map(nameOf), describeRule(r, stateOf(r))),
			`${nameOf(r.device_ids[0] ?? '')}: ${describeRule(r, stateOf(r))}`
		];
		name = made.includes(r.name) ? '' : r.name;
		trouble = null;
		await tick();
		form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	function firstDevice(id: string) {
		// Another device with the same state keeps the rule; otherwise choose the state again.
		const keep = chosen !== undefined && devicesFor(all, chosen).some((d) => d.device_id === id);
		ids = keep ? [id, ...ids.slice(1).filter((x) => x !== id)] : [id];
		if (!keep) stateKey = '';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!chosen || picked.length === 0 || (chosen.op && level === null)) return;
		saving = true;
		const body = {
			name: name.trim() || autoName,
			enabled: editing?.enabled ?? true,
			device_ids: picked,
			attribute: chosen.attribute,
			value: chosen.op && level !== null ? toLevel(chosen, level) : chosen.value,
			// Only a level says how it compares: an older homeCore never sees `op`.
			...(chosen.op ? { op: chosen.op } : {}),
			...(newer ? { notify: notify || null } : {}),
			state_label: stateWords,
			after: after || null,
			until: until || null,
			for_minutes: forMinutes || null,
			severity: critical ? ('critical' as const) : ('warning' as const)
		};
		trouble = editing ? await saveAlertRule({ ...editing, ...body }) : await createAlertRule(body);
		saving = false;
		if (trouble === null) {
			reset();
			await reload();
		}
	}

	async function toggle(r: AlertRule) {
		trouble = await saveAlertRule({ ...r, enabled: !r.enabled });
		await reload();
	}
	async function show(i: AlertIgnore) {
		trouble = await unignore(i.id);
		await reload();
	}
	const ruleNameOf = (id: string) => rules?.find((r) => r.id === id)?.name;
	const day = (iso: string) =>
		new Date(iso).toLocaleString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});

	// ---- what each alert starts ----
	const names = $derived(houseNames(rules ?? []));
	const starts = $derived(bySource(alertLinks.list));
	const startsOf = (key: string) => starts.get(key) ?? [];
	const automationHref = (x: AutomationAlerts) =>
		`/settings/automations/${encodeURIComponent(x.id)}`;
	let doing = $state<{
		title: string;
		scopes: Scope[];
		tie: Start['tie'];
		href: string;
	} | null>(null);

	// ---- deleting a rule that starts automations ----
	let deleting = $state<{ rule: AlertRule; list: (RuleStarts & { also: string })[] } | null>(null);
	let deleteDialog = $state<HTMLDialogElement>();
	let done = $state<{ title: string; text: string } | null>(null);
	$effect(() => {
		if (deleting && deleteDialog && !deleteDialog.open) deleteDialog.showModal();
	});
	/** What else starts an automation besides this rule: "also starts on “Power cut”". */
	function alsoOf(id: string, ruleId: string): string {
		const x = alertLinks.byId(id);
		if (!x) return 'it has another trigger';
		const others = x.links
			.filter((l) => l.filter.rule_id !== ruleId)
			.map((l) => linkName(l, names));
		if (x.other_triggers > 0) others.push('something else');
		return others.length ? `also starts on ${[...new Set(others)].join(', or ')}` : '';
	}

	async function remove(r: AlertRule) {
		const list = await alertRuleStarts(r.id);
		if (list && list.length) {
			done = null;
			deleting = {
				rule: r,
				list: list.map((x) => ({ ...x, also: x.keeps_running ? alsoOf(x.id, r.id) : '' }))
			};
			return;
		}
		if (!(await ask({ title: `Delete “${r.name}”?`, go: 'Delete', danger: true }))) return;
		trouble = await deleteAlertRule(r.id);
		if (editing?.id === r.id) reset();
		await reload();
	}

	async function deleteWith(mode: 'delete' | 'disable') {
		if (!deleting) return;
		const { rule, list } = deleting;
		const got = await deleteAlertRuleWith(rule.id, mode);
		deleteDialog?.close();
		deleting = null;
		if (typeof got === 'string') {
			trouble = got;
			return;
		}
		const q = (xs: { name: string }[]) => xs.map((x) => `“${x.name}”`).join(', ');
		const stays = got.kept
			.map((k) => {
				const also = list.find((x) => x.id === k.id)?.also ?? '';
				return `“${k.name}” stays: it ${also || 'has another trigger'}, so only its “${rule.name}” trigger was removed.`;
			})
			.join(' ');
		done =
			mode === 'delete'
				? {
						title: got.deleted.length
							? `Deleted the rule and ${q(got.deleted)}`
							: 'Deleted the rule',
						text: stays
					}
				: {
						title: got.disabled.length
							? 'Deleted the rule; kept its automations, turned off'
							: 'Deleted the rule',
						text: [
							got.disabled.length
								? 'They keep their steps, so a new trigger brings them back.'
								: '',
							stays
						]
							.filter(Boolean)
							.join(' ')
					};
		if (editing?.id === rule.id) reset();
		await Promise.all([reload(), alertLinks.load()]);
	}
</script>

{#snippet strip(
	linked: AutomationAlerts[],
	start: { title: string; scopes: Scope[]; tie: Start['tie']; href: string } | null,
	waiting: string
)}
	{#if linked.length || start}
		<div class="strip">
			<span class="what">When it happens:</span>
			{#each linked as x (x.id)}
				<a class="chip" class:muted={!x.enabled || !!waiting} href={automationHref(x)}>{x.name}</a>
			{/each}
			{#if waiting && linked.length}<span class="waiting">{waiting}</span>{/if}
			{#if start}
				<button type="button" class="do" onclick={() => (doing = start)}>+ Do something…</button>
			{/if}
		</div>
	{/if}
{/snippet}

{#if doing}
	<DoSomething
		title={doing.title}
		scopes={doing.scopes}
		tie={doing.tie}
		href={doing.href}
		onclose={() => (doing = null)}
	/>
{/if}

{#if deleting}
	<dialog
		class="ask"
		bind:this={deleteDialog}
		aria-labelledby="del-title"
		oncancel={(e) => {
			e.preventDefault();
			deleteDialog?.close();
		}}
		onclose={() => (deleting = null)}
	>
		<div class="ask-body">
			<h2 id="del-title">Delete “{deleting.rule.name}”?</h2>
			<p>
				It starts {deleting.list.length === 1
					? 'an automation'
					: `${deleting.list.length} automations`}. Without the rule {deleting.list.length === 1
					? 'it'
					: 'they'} can never run.
			</p>
			<ul class="starts">
				{#each deleting.list as x (x.id)}
					<li>
						<span>{x.name}</span>{#if x.also}<small>{x.also}</small>{/if}
					</li>
				{/each}
			</ul>
			{#if deleting.list.some((x) => x.keeps_running)}
				<p class="quiet">
					An automation with another trigger keeps running on that one; only its “{deleting.rule
						.name}” trigger goes.
				</p>
			{/if}
			<div class="choices">
				<button type="button" class="danger" onclick={() => deleteWith('delete')}
					>Delete the rule and its automations</button
				>
				<button type="button" class="ghost" onclick={() => deleteWith('disable')}
					>Delete the rule, keep the automations turned off</button
				>
				<button type="button" class="cancel" onclick={() => deleteDialog?.close()}>Cancel</button>
			</div>
		</div>
	</dialog>
{/if}

{#if !session.can('automations:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<p class="quiet">
			Something wet, smoke, a device offline, a lock jammed or a battery low is always an alert.
			Rules add the ones that depend on the time or a reading — a door open at night, a lock left
			open{newer ? `, a freezer warmer than ${readingText(-10, '°C').replace('-', '−')}` : ''}.
		</p>

		{#if rules === null}
			<p class="quiet">This homeCore doesn't check alert rules yet — it needs v0.1.76 or later.</p>
		{:else}
			<section>
				<h2 class="section-label">Your rules</h2>
				{#if done}
					<div class="done" role="status">
						<strong>{done.title}</strong>
						{#if done.text}<span>{done.text}</span>{/if}
						<button type="button" class="ghost" onclick={() => (done = null)}>OK</button>
					</div>
				{/if}
				{#if rules.length === 0}<p class="quiet">None yet.</p>{/if}
				<ul>
					{#each rules as r (r.id)}
						{@const linked = startsOf(ruleSource(r.id))}
						<li
							id={`rule-${r.id}`}
							class="has-strip"
							class:off={!r.enabled}
							class:now={editing?.id === r.id}
						>
							<div class="line">
								<button type="button" class="text" onclick={() => change(r)}>
									<span class="name">{r.name}</span>
									<span class="what"
										>{devicesOf(r)} · {describeRule(r, stateOf(r))}{r.severity === 'critical'
											? ' · urgent'
											: ''}{r.notify
											? ` · tells ${r.notify === 'all' ? 'every channel' : r.notify}`
											: ''}</span
									>
								</button>
								<button class="pill" aria-pressed={r.enabled} onclick={() => toggle(r)}
									>{r.enabled ? 'On' : 'Off'}</button
								>
								<button class="bin" aria-label={`Delete ${r.name}`} onclick={() => remove(r)}
									><Trash size={16} /></button
								>
							</div>
							{#if alertLinks.known}
								{@render strip(
									linked,
									r.enabled
										? {
												title: r.name,
												scopes: scopesForRule(r, names),
												tie: 'rule',
												href: `/settings/alerts#rule-${r.id}`
											}
										: null,
									r.enabled ? '' : 'waiting while the rule is off'
								)}
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			<section bind:this={form}>
				<h2 class="section-label">{editing ? 'Change the rule' : 'New rule'}</h2>
				<form onsubmit={submit}>
					<label>
						<span>When</span>
						<select value={ids[0]} onchange={(e) => firstDevice(e.currentTarget.value)}>
							<option value="" disabled>Choose a device…</option>
							{#if ids[0] && !devices.byId[ids[0]]}<option value={ids[0]}>{ids[0]} (gone)</option
								>{/if}
							{#each all as d (d.device_id)}<option value={d.device_id}>{label(d)}</option>{/each}
						</select>
					</label>
					{#each ids.slice(1) as id, i (id)}
						<div class="row">
							<span class="lead">or</span>
							<span class="also">{nameOf(id)}</span>
							<button
								type="button"
								class="bin"
								aria-label={`Not ${nameOf(id)}`}
								onclick={() => (ids = ids.filter((_, j) => j !== i + 1))}
								><Trash size={16} /></button
							>
						</div>
					{/each}
					<label>
						<span>is</span>
						<select bind:value={stateKey} disabled={choices.length === 0}>
							<option value="" disabled>Choose a state…</option>
							{#each choices as c (keyOf(c))}<option value={keyOf(c)}>{c.label}</option>{/each}
						</select>
					</label>
					{#if chosen?.op}
						<label>
							<span>{chosen.op === 'above' ? 'over' : 'under'}</span>
							<input
								type="number"
								step="any"
								bind:value={level}
								placeholder={shownUnit(chosen.unit) ?? 'a number'}
								aria-label="The line"
							/>
						</label>
					{/if}
					{#if chosen && others.length}
						<label>
							<span></span>
							<select
								value=""
								aria-label="Another device"
								onchange={(e) => {
									ids = [...ids, e.currentTarget.value];
									e.currentTarget.value = '';
								}}
							>
								<option value="" disabled
									>+ Another device that can be {chosen.label.toLowerCase()}…</option
								>
								{#each others as d (d.device_id)}<option value={d.device_id}>{label(d)}</option
									>{/each}
							</select>
						</label>
					{/if}
					<div class="times">
						<label><span>after</span><input type="time" bind:value={after} /></label>
						<label><span>until</span><input type="time" bind:value={until} /></label>
						<label
							><span>for at least</span><input
								type="number"
								min="1"
								max="1440"
								placeholder="min"
								bind:value={forMinutes}
							/></label
						>
					</div>
					<label class="check"
						><input type="checkbox" bind:checked={critical} /> Urgent — show it first, in red</label
					>
					{#if newer}
						<label>
							<span>Tell</span>
							<select bind:value={notify}>
								<option value="">No one — just show it</option>
								<option value="all">Every channel</option>
								{#each channels as c (c)}<option value={c}>{c}</option>{/each}
								{#if notify && notify !== 'all' && !channels.includes(notify)}<option value={notify}
										>{notify}</option
									>{/if}
							</select>
						</label>
					{/if}
					<label>
						<span>Name</span>
						<input
							type="text"
							bind:value={name}
							placeholder={autoName || 'Made from what it watches'}
						/>
					</label>
					{#if said}<p class="preview">
							Alert when {picked.length > 1 ? 'any of them is' : 'it is'}
							{said.toLowerCase()}.
						</p>{/if}
					<div class="acts">
						<button
							type="submit"
							class="add"
							disabled={!chosen || picked.length === 0 || saving || (!!chosen.op && level === null)}
							>{saving ? 'Saving…' : editing ? 'Save' : 'Add rule'}</button
						>
						{#if editing}<button type="button" class="ghost" onclick={reset}>Cancel</button>{/if}
					</div>
				</form>
			</section>

			{#if alertLinks.known}
				<section>
					<h2 class="section-label">homeCore’s own</h2>
					<ul class="own">
						{#each OWN_KINDS as k (k)}
							{@const linked = startsOf(kindSource(k))}
							<li id={`kind-${k}`} class="own-row">
								<span class="name own-name">{OWN[k].label}</span>
								{#each linked as x (x.id)}
									<a class="chip" class:muted={!x.enabled} href={automationHref(x)}>{x.name}</a>
								{/each}
								{#if linked.length === 0}<span class="what">Starts nothing</span>{/if}
								<button
									type="button"
									class="do"
									onclick={() =>
										(doing = {
											title: `${OWN[k].label} — homeCore’s own`,
											scopes: scopesForKind(k, names),
											tie: 'own',
											href: `/settings/alerts#kind-${k}`
										})}>+ Do something…</button
								>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if alertKinds.list.length}
				<section>
					<h2 class="section-label">Alerts from plugins</h2>
					<p class="quiet">
						What each plugin can raise, and what the house does with it: shown as an alert, and sent
						somewhere. A plugin never raises one as critical.
					</p>
					<ul>
						{#each alertKinds.list as k (k.plugin_id + k.topic)}
							{@const linked = startsOf(pluginSource(k.plugin_id, k.topic))}
							<li class="kind-row has-strip" id={pluginKey(k.plugin_id, k.topic)}>
								<div class="line">
									<span class="text static">
										<span class="name">{pluginName(k.plugin_id)} · {k.label}</span>
										<span class="what"
											>{k.severity === 'info'
												? 'Information'
												: k.severity === 'error'
													? 'Error'
													: 'Warning'}{k.description ? ` — ${k.description}` : ''}</span
										>
									</span>
									<label class="mini">
										<span>Show it</span>
										<select
											value={k.enabled ? 'on' : 'off'}
											disabled={!session.can('automations:write')}
											onchange={async (e) =>
												(trouble =
													(await alertKinds.put(k.plugin_id, k.topic, {
														enabled: e.currentTarget.value === 'on',
														notify: k.notify ?? null
													})) ?? '')}
										>
											<option value="on">As an alert</option>
											<option value="off">Off</option>
										</select>
									</label>
									<label class="mini">
										<span>Also send to</span>
										<select
											value={k.notify ?? ''}
											disabled={!session.can('automations:write')}
											onchange={async (e) =>
												(trouble =
													(await alertKinds.put(k.plugin_id, k.topic, {
														enabled: k.enabled,
														notify: e.currentTarget.value || null
													})) ?? '')}
										>
											<option value="">No channel</option>
											<option value="all">Every channel</option>
											{#each channels as c (c)}<option value={c}>{c}</option>{/each}
											{#if k.notify && k.notify !== 'all' && !channels.includes(k.notify)}<option
													value={k.notify}>{k.notify}</option
												>{/if}
										</select>
									</label>
								</div>
								{#if alertLinks.known}
									{@render strip(
										linked,
										k.enabled
											? {
													title: `${pluginName(k.plugin_id)} · ${k.label}`,
													scopes: scopesForPluginKind(k.plugin_id, k.topic, names),
													tie: 'plugin',
													href: `/settings/alerts#${pluginKey(k.plugin_id, k.topic)}`
												}
											: null,
										k.enabled ? '' : 'waiting while it is off'
									)}
								{/if}
							</li>
						{/each}
					</ul>
					{#if alertLinks.known}
						<p class="quiet">
							Automations made by hand that start from an alert are found and shown too. Ones that
							watch a device directly aren’t listed.
						</p>
					{/if}
				</section>
			{/if}

			{#if ignores !== null}
				<section>
					<h2 class="section-label">Ignored</h2>
					{#if ignores.length === 0}
						<p class="quiet">
							Nothing. On Alerts, “Ignore…” stops showing an alert — just that one, every one like
							it, or a device’s — for good or a while.
						</p>
					{/if}
					<ul>
						{#each ignores as i (i.id)}
							{@const out = ranOut(i, clock.now)}
							<li class:off={out}>
								<span class="text static">
									<span class="name"
										>{describeIgnore(i, nameOf, ruleNameOf, day, (p, t) =>
											alertKinds.label(p, t)
										)}{out ? ' — ran out' : ''}</span
									>
									<span class="what"
										>{[i.note, i.by ? `by ${i.by}` : '', i.created_at ? day(i.created_at) : '']
											.filter(Boolean)
											.join(' · ')}</span
									>
								</span>
								<button class="pill" onclick={() => show(i)}>{out ? 'Remove' : 'Show again'}</button
								>
							</li>
						{/each}
					</ul>
				</section>
				<p class="quiet">
					Where wet, smoke, jammed and offline alerts are sent is in
					<a href="/settings/configuration">Configuration › Alerts</a>; low batteries in its Battery
					alerts.
				</p>
			{/if}
		{/if}
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	</div>
{/if}

<style>
	.kind-row .line {
		flex-wrap: wrap;
		gap: 10px;
	}
	li.has-strip {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
		padding: 0;
	}
	li.has-strip .line {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 6px 8px 12px;
	}
	li.off.has-strip .strip {
		opacity: 1;
	}
	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-top: 1px solid var(--card-line);
		background: color-mix(in srgb, var(--surface-2) 35%, var(--surface));
		border-radius: 0 0 12px 12px;
	}
	.chip {
		font-size: 13px;
		text-decoration: none;
		color: var(--accent);
		background: var(--surface);
		border: 1px solid var(--card-line);
		border-radius: 999px;
		padding: 5px 10px;
	}
	.chip.muted {
		color: var(--ink-muted);
	}
	.waiting {
		font-size: 13px;
		color: var(--lit-ink);
	}
	.do {
		min-height: 32px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px dashed var(--line);
		background: transparent;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}
	ul.own {
		gap: 0;
		border-radius: 12px;
		border: 1px solid var(--card-line);
		background: var(--surface);
		overflow: hidden;
	}
	li.own-row {
		flex-wrap: wrap;
		min-height: 52px;
		padding: 8px 14px;
		border: none;
		border-radius: 0;
		border-top: 1px solid var(--card-line);
	}
	li.own-row:first-child {
		border-top: none;
	}
	.own-name {
		width: 150px;
	}
	li.own-row .do {
		margin-left: auto;
	}
	.done {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: var(--space-3) var(--space-4);
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.done span {
		font-size: 14px;
		color: var(--ink-muted);
	}
	.done .ghost {
		align-self: flex-start;
	}
	dialog.ask {
		width: min(480px, calc(100vw - 32px));
		margin: auto;
		padding: 0;
		border: 1px solid var(--card-line);
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	dialog.ask::backdrop {
		background: var(--scrim);
	}
	.ask-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: var(--space-5);
	}
	.ask-body h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
	}
	.ask-body p {
		margin: 0;
		font-size: 15px;
		color: var(--ink-muted);
	}
	.ask-body p.quiet {
		font-size: 13px;
	}
	ul.starts {
		gap: 0;
		border-radius: 12px;
		border: 1px solid var(--card-line);
		background: var(--surface);
	}
	ul.starts li {
		justify-content: space-between;
		min-height: 44px;
		padding: 0 14px;
		border: none;
		border-radius: 0;
		border-top: 1px solid var(--card-line);
		background: none;
		font-size: 15px;
	}
	ul.starts li:first-child {
		border-top: none;
	}
	ul.starts small {
		font-size: 12px;
		color: var(--ink-muted);
		text-align: right;
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.choices button {
		min-height: 44px;
		border-radius: 11px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.choices .danger {
		border: none;
		background: var(--alert);
		color: var(--alert-ink);
	}
	.choices .ghost {
		height: auto;
		font-weight: 400;
		color: var(--ink);
	}
	.choices .cancel {
		border: none;
		background: transparent;
		color: var(--ink-muted);
		font-weight: 400;
	}
	.mini {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.mini select {
		font: inherit;
		font-size: 14px;
		font-weight: 400;
		min-height: 38px;
		border-radius: 9px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		padding: 0 8px;
	}
	.stack {
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-2);
	}
	section,
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 6px 8px 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	li.off .text {
		opacity: 0.5;
	}
	li.now {
		border-color: var(--accent);
	}
	.text {
		cursor: pointer;
	}
	.text.static {
		cursor: default;
	}
	.text.static .name {
		text-decoration: none;
	}
	.text:hover .name,
	.text:focus-visible .name {
		text-decoration: underline;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lead {
		min-width: 3.5em;
		color: var(--ink-muted);
	}
	.also {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}
	input[type='text'] {
		flex: 1;
		min-width: 0;
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
	.acts {
		display: flex;
		gap: 8px;
	}
	.ghost {
		height: var(--target);
		padding: 0 18px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
	}
	.name {
		font-weight: 600;
	}
	.what {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.pill {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		font-weight: 600;
	}
	.pill[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.bin {
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-muted);
	}
	label {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	label > span {
		min-width: 3.5em;
		color: var(--ink-muted);
	}
	select,
	input[type='time'],
	input[type='number'] {
		flex: 1;
		min-width: 0;
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
	.times {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.times label {
		flex: 1 1 150px;
	}
	.check {
		gap: 8px;
	}
	.preview {
		margin: 0;
		font-weight: 600;
	}
	.add {
		height: var(--target);
		padding: 0 18px;
		border-radius: 22px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
	}
	.add:disabled {
		opacity: 0.5;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
	}
</style>
