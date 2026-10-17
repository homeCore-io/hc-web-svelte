<!--
	One device, for an admin (A1): its name and room, its name in rules, what
	it reports and its history, where it is used, and deleting it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { roomOf } from '#lib/summary.js';
	import { kindLabel, pluginLabel, seenText } from '#lib/inventory.js';
	import { chartable, readingsOf, usesOf } from '#lib/deviceView.js';
	import { loadRules, type RuleRef } from '#lib/uses.js';
	import { alertRules as loadAlertRules } from '#lib/admin.js';
	import type { AlertRule } from '#lib/alerts.js';
	import { deleteDevices, patchDevice } from '#lib/deviceAdmin.js';
	import Chart from '#lib/components/Chart.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';

	const id = $derived(page.params.id ?? '');
	const device = $derived(devices.byId[id]);
	const card = $derived(device ? cardFor(device, clock.now) : null);
	const room = $derived(device ? roomOf(device, rooms.list) : undefined);
	const name = $derived(device ? displayName(device) : id);
	const fromPlugin = $derived(!!device && !device.plugin_id?.startsWith('core.'));

	$effect(() => heading.show(name, { href: '/settings/devices', label: 'Devices' }));

	let rules = $state<RuleRef[]>([]);
	let alertRules = $state<AlertRule[]>([]);
	onMount(async () => {
		rules = (await loadRules()) ?? [];
		alertRules = (await loadAlertRules()) ?? [];
	});
	const uses = $derived(device ? usesOf(device, rules, scenes.list, alertRules) : null);

	// ---- name and room, saved together ----
	let draftName = $state<string | null>(null);
	let draftRoom = $state<string | null>(null);
	const roomId = $derived(draftRoom ?? room?.id ?? '');
	const changed = $derived(
		(draftName !== null && draftName.trim() !== name) ||
			(draftRoom !== null && draftRoom !== (room?.id ?? ''))
	);
	let saving = $state(false);
	let trouble = $state<string | null>(null);
	async function save() {
		const body: Record<string, unknown> = {};
		if (draftName !== null && draftName.trim() !== name) body.name = draftName.trim() || null;
		if (draftRoom !== null) body.area = rooms.list.find((r) => r.id === draftRoom)?.name ?? null;
		saving = true;
		trouble = await patchDevice(id, body);
		saving = false;
		if (!trouble) draftName = draftRoom = null;
	}
	const discard = () => (draftName = draftRoom = null);

	// ---- name in rules ----
	let renamingRules = $state(false);
	let canonical = $state('');
	async function saveCanonical() {
		const using = uses?.rules ?? [];
		if (using.length > 0) {
			const yes = await ask({
				title: `Change its name in rules to “${canonical}”?`,
				body: `${using.length === 1 ? 'One rule names' : `${using.length} rules name`} it as “${device?.canonical_name}”. They won’t find it under the new name until they’re changed.`,
				lost: using.slice(0, 6).map((r) => r.name),
				go: 'Change it',
				danger: true
			});
			if (!yes) return;
		}
		trouble = await patchDevice(id, { canonical_name: canonical.trim() });
		if (!trouble) renamingRules = false;
	}

	// ---- how it shows: its kind, and its buttons' names ----
	const KINDS = [
		'light',
		'switch',
		'outlet',
		'fan',
		'lock',
		'speaker',
		'tv',
		'contact_sensor',
		'door',
		'window',
		'garage',
		'gate',
		'motion_sensor',
		'occupancy_sensor',
		'temperature_sensor',
		'water_sensor',
		'keypad',
		'pico_remote',
		'bridge'
	];
	let hintNote = $state<string | null>(null);
	async function setHint(v: string) {
		hintNote = null;
		const err = await patchDevice(id, { ui_hint: v || null });
		hintNote = err ?? (v ? `Shown as ${kindLabel(v).toLowerCase()}.` : 'Shown as its plugin says.');
	}
	const buttons = $derived.by(() => {
		if (!device) return [];
		const nums = new Set<string>(Object.keys(device.button_names ?? {}));
		const keys = [
			...Object.keys(device.attributes ?? {}),
			...Object.keys(device.schema?.attributes ?? {})
		];
		for (const k of keys) {
			const m = /^button_(\d+)$/.exec(k);
			if (m) nums.add(m[1]!);
		}
		return [...nums].sort((a, b) => Number(a) - Number(b));
	});
	let buttonDraft = $state<Record<string, string>>({});
	let buttonNote = $state<string | null>(null);
	async function saveButtons() {
		buttonNote = null;
		const err = await patchDevice(id, { button_names: buttonDraft });
		if (err) return void (buttonNote = err);
		buttonDraft = {};
		buttonNote = 'Saved.';
	}
	const parent = $derived(
		device?.parent_device_id ? devices.byId[device.parent_device_id] : undefined
	);

	// ---- history ----
	const PERIODS = [
		{ label: '24 h', ms: 24 * 3600_000 },
		{ label: '7 d', ms: 7 * 24 * 3600_000 },
		{ label: '30 d', ms: 30 * 24 * 3600_000 }
	];
	let period = $state(PERIODS[0]!);
	const charts = $derived(device ? chartable(device) : []);

	// ---- delete ----
	async function remove() {
		if (!device) return;
		const using = uses ? uses.rules.length + uses.scenes.length + uses.alertRules.length : 0;
		const yes = await ask({
			title: `Delete ${name}?`,
			lost: [
				'Its name and room in homeCore go; its recorded history stays.',
				...(using > 0 ? ['Rules that name it are turned off until someone changes them.'] : []),
				...(fromPlugin
					? [
							`If ${pluginLabel(device.plugin_id)} still reports it, it comes back as a new device on the next report — remove it there first.`
						]
					: [])
			],
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const done = await deleteDevices([id]);
		if (done.error) return void (trouble = done.error);
		void goto('/settings/devices');
	}
</script>

{#if !session.can('devices:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else if !device}
	<p class="quiet">
		{devices.loaded ? `There is no device “${id}”. It may have been deleted.` : 'Loading…'}
	</p>
{:else}
	<div class="page">
		<p class="sub">
			{#if card?.alarm}<span class="badge"
					>{card.alarm[0]!.toUpperCase() + card.alarm.slice(1)}</span
				>{/if}
			{kindLabel(card?.kind ?? '')} · {pluginLabel(device.plugin_id)} · heard {seenText(
				device,
				clock.now
			)}
			· <a href={`?device=${encodeURIComponent(id)}`}>Open as the household sees it</a>
		</p>
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}

		<div class="grid">
			<section>
				<h2>Identity</h2>
				<div class="rows">
					<label class="row">
						<span class="k">Name</span>
						<input
							value={draftName ?? name}
							oninput={(e) => (draftName = e.currentTarget.value)}
							class:changed={draftName !== null && draftName.trim() !== name}
						/>
					</label>
					{#if device.name_override && device.name_override !== device.name}
						<p class="hint">
							{pluginLabel(device.plugin_id)} calls it “{device.name}”.
							<button type="button" class="link" onclick={() => (draftName = device.name)}
								>Use that</button
							>
						</p>
					{/if}
					<label class="row">
						<span class="k">Room</span>
						<select value={roomId} onchange={(e) => (draftRoom = e.currentTarget.value)}>
							<option value="">No room</option>
							{#each [...rooms.list].sort((a, b) => a.name.localeCompare(b.name)) as r (r.id)}
								<option value={r.id}>{r.name}</option>
							{/each}
						</select>
					</label>
					<div class="row">
						<span class="k">Name in rules</span>
						{#if renamingRules}
							<span class="inline">
								<input class="mono" bind:value={canonical} aria-label="Name in rules" />
								<button type="button" class="small" onclick={() => (renamingRules = false)}
									>Cancel</button
								>
								<button
									type="button"
									class="small go"
									disabled={canonical.trim() === ''}
									onclick={saveCanonical}>Save</button
								>
							</span>
						{:else}
							<span class="inline">
								<code>{device.canonical_name ?? 'not given yet'}</code>
								<button
									type="button"
									class="small"
									onclick={() => {
										canonical = device.canonical_name ?? '';
										renamingRules = true;
									}}>Change…</button
								>
							</span>
						{/if}
					</div>
					<p class="hint">
						Set once, so renaming the device never breaks a rule.
						{uses && uses.rules.length > 0
							? `${uses.rules.length === 1 ? 'One rule uses' : `${uses.rules.length} rules use`} it.`
							: 'No rules use it.'}
					</p>
					<div class="row">
						<span class="k">Id</span>
						<code>{id}</code>
					</div>
				</div>
			</section>

			<section>
				<h2>How it shows</h2>
				<div class="rows">
					<label class="row">
						<span class="k">Shown as</span>
						<select value={device.ui_hint ?? ''} onchange={(e) => setHint(e.currentTarget.value)}>
							<option value=""
								>As {pluginLabel(device.plugin_id)} says{device.device_type
									? ` (${kindLabel(device.device_type).toLowerCase()})`
									: ''}</option
							>
							{#each KINDS as k (k)}<option value={k}>{kindLabel(k)}</option>{/each}
						</select>
					</label>
					{#if hintNote}<p class="hint" role="status">{hintNote}</p>{/if}
					{#if buttons.length}
						<p class="hint">
							Its buttons, by number — a name here wins over what the bridge calls it.
						</p>
						{#each buttons as b (b)}
							<label class="row">
								<span class="k">Button {b}</span>
								<input
									value={buttonDraft[b] ?? device.button_names?.[b] ?? ''}
									placeholder="As the bridge says"
									oninput={(e) => (buttonDraft = { ...buttonDraft, [b]: e.currentTarget.value })}
								/>
							</label>
						{/each}
						{#if Object.keys(buttonDraft).length}
							<button type="button" class="small go" onclick={saveButtons}>Save button names</button
							>
						{/if}
						{#if buttonNote}<p class="hint" role="status">{buttonNote}</p>{/if}
					{/if}
				</div>
			</section>

			{#if device.manufacturer || device.model || device.sw_version || device.parent_device_id}
				<section>
					<h2>Hardware</h2>
					<div class="rows">
						{#if device.manufacturer}<div class="row">
								<span class="k">Made by</span><span>{device.manufacturer}</span>
							</div>{/if}
						{#if device.model}<div class="row">
								<span class="k">Model</span><span>{device.model}</span>
							</div>{/if}
						{#if device.sw_version}<div class="row">
								<span class="k">Firmware</span><code>{device.sw_version}</code>
							</div>{/if}
						{#if device.parent_device_id}
							<div class="row">
								<span class="k">Behind</span>
								{#if parent}<a href={`/settings/devices/${encodeURIComponent(parent.device_id)}`}
										>{displayName(parent)}</a
									>{:else}<code>{device.parent_device_id}</code>{/if}
							</div>
						{/if}
					</div>
				</section>
			{/if}

			<section>
				<h2>What it reports</h2>
				<ul class="readings">
					{#each readingsOf(device) as r (r.attr)}
						<li class:diag={r.diagnostic}>
							<span>{r.label}</span>
							<span class="v">{r.value}</span>
							<code>{r.attr}</code>
						</li>
					{/each}
				</ul>
			</section>

			{#if charts.length > 0}
				<section class="wide">
					<div class="head">
						<h2>History</h2>
						<div class="seg" role="radiogroup" aria-label="Period">
							{#each PERIODS as p (p.label)}
								<button
									type="button"
									role="radio"
									aria-checked={period === p}
									onclick={() => (period = p)}>{p.label}</button
								>
							{/each}
						</div>
					</div>
					<div class="charts">
						{#each charts as c (c.attr)}
							<Chart
								deviceId={id}
								attr={c.attr}
								label={c.label}
								unit={c.unit}
								bool={c.bool}
								current={device.attributes[c.attr]}
								span={period.ms}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<section>
				<h2>Where it’s used</h2>
				{#if uses && uses.rules.length + uses.scenes.length + uses.alertRules.length > 0}
					<ul class="uses">
						{#each uses.rules as r (r.id)}<li>
								<a href={`/settings/automations/${encodeURIComponent(r.id)}`}>{r.name}</a>
								<span class="muted">rule</span>
							</li>{/each}
						{#each uses.scenes as s (s.id)}<li>{s.name} <span class="muted">scene</span></li>{/each}
						{#each uses.alertRules as a (a.id)}<li>
								<a href="/settings/alerts">{a.name}</a> <span class="muted">alert rule</span>
							</li>{/each}
					</ul>
				{:else}
					<p class="quiet">No automations, scenes or alert rules name it.</p>
				{/if}
				{#if card?.alarm}
					<p class="quiet">Its {card.alarm} is a built-in alert, which needs no rule.</p>
				{/if}
			</section>

			<section>
				<h2>Remove</h2>
				<p class="quiet">
					Delete it from homeCore.
					{#if fromPlugin}If {pluginLabel(device.plugin_id)} still reports it, it comes back on the next
						report — remove it there first.{/if}
				</p>
				<button type="button" class="danger" onclick={remove}>Delete…</button>
			</section>
		</div>
	</div>

	{#if changed}
		<SaveBar
			count={(draftName !== null && draftName.trim() !== name ? 1 : 0) +
				(draftRoom !== null && draftRoom !== (room?.id ?? '') ? 1 : 0)}
			summary={[
				draftName !== null && draftName.trim() !== name
					? `Name: ${draftName.trim() || device.name}`
					: '',
				draftRoom !== null
					? `Room: ${rooms.list.find((r) => r.id === draftRoom)?.name ?? 'none'}`
					: ''
			]
				.filter(Boolean)
				.join(' · ')}
			{saving}
			{save}
			{discard}
		/>
	{/if}
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.sub {
		margin: 0;
		color: var(--ink-muted);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.sub a {
		color: var(--accent);
		font-weight: 600;
	}
	.badge {
		padding: 2px 10px;
		border-radius: 11px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 700;
		font-size: 13px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	@media (min-width: 1000px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.wide {
			grid-column: 1 / -1;
		}
	}
	section {
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0 0 4px;
		font-size: 17px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row {
		display: grid;
		grid-template-columns: 120px minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
	}
	.k {
		color: var(--ink-muted);
		font-weight: 600;
		font-size: 14px;
	}
	input,
	select {
		height: 40px;
		box-sizing: border-box;
		min-width: 0;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	input.changed {
		border-color: var(--accent);
	}
	.mono,
	code {
		font-family: var(--font-num);
	}
	code {
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.hint,
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font: inherit;
		font-weight: 600;
	}
	.small {
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
	.small.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.small:disabled {
		opacity: 0.5;
	}
	.readings,
	.uses {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.readings li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 0.8fr);
		gap: var(--space-3);
		align-items: baseline;
		padding: 8px 0;
		border-top: 1px solid var(--line);
	}
	.readings li:first-child {
		border-top: none;
	}
	.readings li.diag {
		color: var(--ink-muted);
	}
	.readings .v {
		font-weight: 600;
		text-align: right;
	}
	.readings code {
		color: var(--ink-muted);
		font-size: 11px;
		text-align: right;
	}
	.uses li {
		padding: 6px 0;
	}
	.uses a {
		color: var(--ink);
		font-weight: 600;
	}
	.muted {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.seg {
		display: inline-flex;
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
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
	}
	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-3);
	}
	.danger {
		align-self: flex-start;
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: 1px solid var(--alert-line);
		background: none;
		color: var(--alert);
		font: inherit;
		font-weight: 700;
	}
	.trouble {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
</style>
