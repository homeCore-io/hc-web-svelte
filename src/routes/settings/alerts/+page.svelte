<!--
	Time rules for alerts (C9): "the garage door open after 22:00", "the front
	door unlocked for 30 minutes". homeCore checks them whether or not any
	screen is open, and raises and clears the alert (M6, H4). The built-in
	ones — wet, smoke, offline, jammed, low battery — need no rule.

	One form adds a rule or changes one (tap its row): several devices that
	share the state, and a name of your own or one made from what it watches.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		describeRule,
		devicesFor,
		ruleName,
		sameState,
		stateChoices,
		type AlertRule,
		type StateChoice
	} from '#lib/alerts.js';
	import { alertRules, createAlertRule, deleteAlertRule, saveAlertRule } from '#lib/admin.js';

	let rules = $state<AlertRule[] | null>(null);
	let trouble = $state<string | null>(null);
	const reload = async () => {
		rules = await alertRules();
	};
	onMount(reload);

	const all = $derived(
		Object.values(devices.byId)
			.filter((d) => stateChoices(d).length > 0)
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const label = (d: (typeof all)[number]) =>
		`${displayName(d)} — ${roomOf(d, rooms.list)?.name ?? 'no room'}`;
	const nameOf = (id: string) => (devices.byId[id] ? displayName(devices.byId[id]) : id);

	/** A rule's state, in the device's words. */
	function stateOf(r: AlertRule): string {
		if (r.state_label) return r.state_label;
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
	let saving = $state(false);
	let form = $state<HTMLElement | undefined>(undefined);

	const keyOf = (c: Pick<StateChoice, 'attribute' | 'value'>) =>
		`${c.attribute}=${JSON.stringify(c.value)}`;
	const first = $derived(devices.byId[ids[0] ?? '']);
	// The first device's states — and, when changing a rule, its own state even
	// if the device no longer reports it, so a save never quietly changes it.
	const choices = $derived.by(() => {
		const out = first ? stateChoices(first) : [];
		const r = editing;
		if (r && !out.some((c) => sameState(c, r)))
			out.push({ attribute: r.attribute, value: r.value, label: stateOf(r) });
		return out;
	});
	const chosen = $derived(choices.find((c) => keyOf(c) === stateKey));
	// More devices: those with the same state that aren't in the rule yet.
	const others = $derived(
		chosen ? devicesFor(all, chosen).filter((d) => !ids.includes(d.device_id)) : []
	);
	const said = $derived(
		chosen
			? describeRule(
					{ after: after || null, until: until || null, for_minutes: forMinutes },
					chosen.label
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
	}
	async function change(r: AlertRule) {
		editing = r;
		ids = r.device_ids.length ? [...r.device_ids] : [''];
		stateKey = keyOf(r);
		after = r.after ?? '';
		until = r.until ?? '';
		forMinutes = r.for_minutes ?? null;
		critical = r.severity === 'critical';
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
		if (!chosen || picked.length === 0) return;
		saving = true;
		const body = {
			name: name.trim() || autoName,
			enabled: editing?.enabled ?? true,
			device_ids: picked,
			attribute: chosen.attribute,
			value: chosen.value,
			state_label: chosen.label,
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
	async function remove(r: AlertRule) {
		if (!(await ask({ title: `Delete “${r.name}”?`, go: 'Delete', danger: true }))) return;
		trouble = await deleteAlertRule(r.id);
		if (editing?.id === r.id) reset();
		await reload();
	}
</script>

{#if !session.can('automations:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<p class="quiet">
			Something wet, smoke, a device offline, a lock jammed or a battery low is always an alert.
			Rules add the ones that depend on the time — a door open at night, a lock left open.
		</p>

		{#if rules === null}
			<p class="quiet">This homeCore doesn't check alert rules yet — it needs v0.1.76 or later.</p>
		{:else}
			<section>
				<h2 class="section-label">Rules</h2>
				{#if rules.length === 0}<p class="quiet">None yet.</p>{/if}
				<ul>
					{#each rules as r (r.id)}
						<li class:off={!r.enabled} class:now={editing?.id === r.id}>
							<button type="button" class="text" onclick={() => change(r)}>
								<span class="name">{r.name}</span>
								<span class="what"
									>{devicesOf(r)} · {describeRule(r, stateOf(r))}{r.severity === 'critical'
										? ' · urgent'
										: ''}</span
								>
							</button>
							<button class="pill" aria-pressed={r.enabled} onclick={() => toggle(r)}
								>{r.enabled ? 'On' : 'Off'}</button
							>
							<button class="bin" aria-label={`Delete ${r.name}`} onclick={() => remove(r)}
								><Trash size={16} /></button
							>
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
						<button type="submit" class="add" disabled={!chosen || picked.length === 0 || saving}
							>{saving ? 'Saving…' : editing ? 'Save' : 'Add rule'}</button
						>
						{#if editing}<button type="button" class="ghost" onclick={reset}>Cancel</button>{/if}
					</div>
				</form>
			</section>
		{/if}
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	</div>
{/if}

<style>
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
