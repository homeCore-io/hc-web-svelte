<!--
	Time rules for alerts (C9): "the garage door open after 22:00", "the front
	door unlocked for 30 minutes". homeCore checks them whether or not any
	screen is open, and raises and clears the alert (M6, H4). The built-in
	ones — wet, smoke, offline, jammed, low battery — need no rule.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { session } from '#lib/me.svelte.js';
	import { describeRule, stateChoices, type AlertRule } from '#lib/alerts.js';
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

	/** A rule's state, in the device's words. */
	function stateOf(r: AlertRule): string {
		if (r.state_label) return r.state_label;
		const d = devices.byId[r.device_ids[0] ?? ''];
		const c = d && stateChoices(d).find((c) => c.attribute === r.attribute && c.value === r.value);
		return c?.label ?? `${r.attribute} is ${String(r.value)}`;
	}
	const devicesOf = (r: AlertRule) =>
		r.device_ids.map((id) => (devices.byId[id] ? displayName(devices.byId[id]) : id)).join(', ');

	// ---- a new rule ----
	let device = $state('');
	let choice = $state(-1);
	let after = $state('');
	let until = $state('');
	let forMinutes = $state<number | null>(null);
	let critical = $state(false);
	const picked = $derived(devices.byId[device]);
	const choices = $derived(picked ? stateChoices(picked) : []);
	const chosen = $derived(choices[choice]);
	const preview = $derived(
		chosen
			? describeRule(
					{ after: after || null, until: until || null, for_minutes: forMinutes },
					chosen.label
				)
			: ''
	);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		if (!chosen) return;
		const d = devices.byId[device]!;
		trouble = await createAlertRule({
			name: `${displayName(d)}: ${preview}`,
			enabled: true,
			device_ids: [device],
			attribute: chosen.attribute,
			value: chosen.value,
			state_label: chosen.label,
			after: after || null,
			until: until || null,
			for_minutes: forMinutes || null,
			severity: critical ? 'critical' : 'warning'
		});
		if (trouble === null) {
			device = '';
			choice = -1;
			after = until = '';
			forMinutes = null;
			critical = false;
			await reload();
		}
	}

	async function toggle(r: AlertRule) {
		trouble = await saveAlertRule({ ...r, enabled: !r.enabled });
		await reload();
	}
	async function remove(r: AlertRule) {
		if (!confirm(`Delete “${r.name}”?`)) return;
		trouble = await deleteAlertRule(r.id);
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
						<li class:off={!r.enabled}>
							<span class="text">
								<span class="name">{devicesOf(r)}</span>
								<span class="what"
									>{describeRule(r, stateOf(r))}{r.severity === 'critical' ? ' · urgent' : ''}</span
								>
							</span>
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

			<section>
				<h2 class="section-label">New rule</h2>
				<form onsubmit={add}>
					<label>
						<span>When</span>
						<select bind:value={device} onchange={() => (choice = -1)}>
							<option value="" disabled>Choose a device…</option>
							{#each all as d (d.device_id)}<option value={d.device_id}>{label(d)}</option>{/each}
						</select>
					</label>
					<label>
						<span>is</span>
						<select bind:value={choice} disabled={choices.length === 0}>
							<option value={-1} disabled>Choose a state…</option>
							{#each choices as c, i (i)}<option value={i}>{c.label}</option>{/each}
						</select>
					</label>
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
					{#if preview}<p class="preview">Alert when it is {preview.toLowerCase()}.</p>{/if}
					<button type="submit" class="add" disabled={!chosen}>Add rule</button>
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
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
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
		align-self: flex-start;
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
