<!--
	One ecosystem's devices (Devices over MQTT, screen 2): each device it takes
	in, what it reports and what it is. Its ecosystem's suggestions taken all at
	once, a type given to several, or one device opened to say what it is.
	Every change is written to the profile and applies at once.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { agoOf } from '#lib/when.js';
	import TypeSheet from '#lib/components/mqtt/TypeSheet.svelte';
	import EcoTabs from '#lib/components/mqtt/EcoTabs.svelte';
	import { goto } from '$app/navigation';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		ecosystemName,
		loadProfile,
		loadTypes,
		readingsLine,
		setDevices,
		turnOff,
		suggestionChanges,
		typeLabel,
		untypedOf,
		type DeviceChange,
		type DeviceType,
		type ProfileDevice,
		type ProfileStatus
	} from '#lib/mqttDevices.js';

	const name = $derived(page.params.name ?? '');
	const label = $derived(ecosystemName(name));
	$effect(() => heading.show(label, { href: '/settings/mqtt', label: 'Devices over MQTT' }));

	let profile = $state<ProfileStatus | null>(null);
	let devices = $state<ProfileDevice[]>([]);
	let types = $state<DeviceType[]>([]);
	let failed = $state<string | null>(null);
	let note = $state<string | null>(null);
	let busy = $state(false);
	let onlyUntyped = $state(false);
	let query = $state('');
	let picked = $state<Record<string, boolean>>({});
	let bulkType = $state('');
	let open = $state<ProfileDevice | null>(null);

	async function load() {
		const r = await loadProfile(name);
		if (!r.ok) return void (failed = r.error);
		failed = null;
		profile = r.data.profile;
		devices = r.data.devices;
	}
	onMount(() => {
		void load();
		void loadTypes().then((r) => {
			if (r.ok) types = r.data.types;
		});
		const t = setInterval(load, 20_000);
		return () => clearInterval(t);
	});

	const counted = $derived(untypedOf(devices));
	const shown = $derived(
		(onlyUntyped ? counted.untyped : devices).filter((d) => {
			const q = query.trim().toLowerCase();
			return !q || d.name.toLowerCase().includes(q) || d.device_id.toLowerCase().includes(q);
		})
	);
	const chosen = $derived(devices.filter((d) => picked[d.device_id]));
	const allOn = $derived(shown.length > 0 && shown.every((d) => picked[d.device_id]));
	const sortedTypes = $derived([...types].sort((a, b) => a.name.localeCompare(b.name)));

	async function change(changes: DeviceChange[], done: string): Promise<string | null> {
		busy = true;
		const r = await setDevices(name, changes);
		busy = false;
		if (!r.ok) return r.error;
		note = done;
		await load();
		return null;
	}

	async function useSuggestions() {
		const changes = suggestionChanges(devices);
		const n = changes.length;
		const error = await change(
			changes,
			n === 1 ? 'One device now has its type.' : `${n} devices now have their types.`
		);
		if (error) note = error;
	}

	async function setBulk() {
		if (!bulkType) return;
		const changes = chosen.map((d) => ({
			device_id: d.device_id,
			device_type: bulkType,
			name: d.configured?.name ?? null
		}));
		const error = await change(
			changes,
			`${changes.length === 1 ? 'One device is' : `${changes.length} devices are`} now ${typeLabel(bulkType).toLowerCase()}s.`
		);
		if (error) note = error;
		else {
			picked = {};
			bulkType = '';
		}
	}

	async function off() {
		if (!profile) return;
		const yes = await ask({
			title: `Turn ${label} off?`,
			body: `Its devices stay, and stop being updated until it's on again. Its profile is kept as it is, changes and all.`,
			go: 'Turn off'
		});
		if (!yes) return;
		busy = true;
		const r = await turnOff(profile.file);
		busy = false;
		if (!r.ok) return void (note = r.error);
		void goto('/settings/mqtt');
	}

	function toggleAll() {
		const next = { ...picked };
		for (const d of shown) next[d.device_id] = !allOn;
		picked = next;
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Devices over MQTT are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">{failed} <a href="/settings/mqtt">All ecosystems</a></p>
{:else if !profile}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<div class="top">
			<p class="lead">
				{devices.length === 1 ? 'One device' : `${devices.length} devices`}{profile.shipped
					? ' · comes with homeCore'
					: ' · yours'} · <code>{profile.file}</code>
			</p>
			<button type="button" class="off" disabled={busy} onclick={off}>Turn off</button>
		</div>
		<EcoTabs {name} file={profile.file} current="devices" />
		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if counted.suggested.length > 0}
			<div class="suggest" role="status">
				<Sparkles size={22} aria-hidden="true" />
				<div>
					<p class="title">
						{label} says what {counted.suggested.length === 1
							? 'one of them is'
							: `${counted.suggested.length} of them are`}
					</p>
					<p>From the device list it publishes. Check them below, then use them all at once.</p>
				</div>
				<button type="button" class="primary" disabled={busy} onclick={useSuggestions}
					>Use {counted.suggested.length === 1
						? 'the suggestion'
						: `${counted.suggested.length} suggestions`}</button
				>
			</div>
		{/if}

		<div class="tools">
			<div class="chips" role="group" aria-label="Show">
				<button type="button" aria-pressed={!onlyUntyped} onclick={() => (onlyUntyped = false)}
					>All <span class="n">{devices.length}</span></button
				>
				<button type="button" aria-pressed={onlyUntyped} onclick={() => (onlyUntyped = true)}
					>Need a type <span class="n">{counted.untyped.length}</span></button
				>
			</div>
			<label class="search">
				<Search size={18} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					placeholder="Name or ID"
					aria-label="Find a device"
				/>
			</label>
		</div>

		{#if chosen.length > 0}
			<div class="bulk">
				<span class="count">{chosen.length} selected</span>
				<label
					>Type
					<select bind:value={bulkType}>
						<option value="">Choose…</option>
						{#each sortedTypes as t (t.name)}<option value={t.name}>{typeLabel(t.name)}</option
							>{/each}
					</select>
				</label>
				<button type="button" class="set" disabled={!bulkType || busy} onclick={setBulk}
					>Set type</button
				>
				<button
					type="button"
					class="clear"
					aria-label="Clear selection"
					onclick={() => (picked = {})}><X size={18} aria-hidden="true" /></button
				>
			</div>
		{/if}

		{#if devices.length === 0}
			<p class="quiet">No device yet. Each appears the first time it reports on the broker.</p>
		{:else if shown.length === 0}
			<p class="quiet">No device matches.</p>
		{:else if wide.current}
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th scope="col" class="pick"
								><input
									type="checkbox"
									aria-label="Select all shown"
									checked={allOn}
									onchange={toggleAll}
								/></th
							>
							<th scope="col">Device</th>
							<th scope="col">What it reports</th>
							<th scope="col">Type</th>
							<th scope="col">Heard</th>
						</tr>
					</thead>
					<tbody>
						{#each shown as d (d.device_id)}
							<tr class:on={picked[d.device_id]}>
								<td class="pick"
									><input
										type="checkbox"
										aria-label={`Select ${d.name}`}
										checked={!!picked[d.device_id]}
										onchange={() => (picked = { ...picked, [d.device_id]: !picked[d.device_id] })}
									/></td
								>
								<td
									><button type="button" class="name" onclick={() => (open = d)}>{d.name}</button>
									<span class="id">{d.device_id}</span></td
								>
								<td class="muted">{readingsLine(d.readings) || '—'}</td>
								<td>
									{#if d.device_type}<span class="chip good">{typeLabel(d.device_type)}</span
										>{:else if d.suggestion}<span class="chip lit"
											>Suggested: {typeLabel(d.suggestion)}</span
										>{:else}<button type="button" class="chip bad" onclick={() => (open = d)}
											>Needs a type</button
										>{/if}
								</td>
								<td class="muted" class:off={!d.available}
									>{d.available ? agoOf(d.last_seen) : 'Offline'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<ul class="list">
				{#each shown as d (d.device_id)}
					<li>
						<button type="button" onclick={() => (open = d)}>
							<span class="text">
								<span class="name">{d.name}</span>
								<span class="sub"
									>{d.device_type
										? typeLabel(d.device_type)
										: d.suggestion
											? `Suggested: ${typeLabel(d.suggestion)}`
											: 'Needs a type'}</span
								>
							</span>
							<ChevronRight size={18} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<p class="quiet">
			A type gives a device its controls in the app. Changes apply at once and are kept in the
			profile; a name given in the app still wins.
		</p>
	</div>
{/if}

{#if open}
	<TypeSheet
		device={open}
		ecosystem={label}
		{types}
		save={(c) => change([c], `${c.name ?? open?.name ?? 'The device'} saved.`)}
		close={() => (open = null)}
	/>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 1000px;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.top .off {
		min-height: 40px;
		padding: 0 14px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.lead {
		margin: 0;
		color: var(--ink-muted);
	}
	code {
		font-family: var(--font-num);
		font-size: 12px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.suggest {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		padding: 14px 18px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.suggest > div {
		flex: 1 1 320px;
	}
	.suggest p {
		margin: 0;
		font-size: 14px;
	}
	.suggest .title {
		font-weight: 700;
		font-size: 15px;
	}
	.primary {
		min-height: var(--target);
		padding: 0 18px;
		border-radius: 11px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.chips {
		display: flex;
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
	.chips button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 0 1 280px;
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
	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: 8px 10px 8px 18px;
		border-radius: var(--radius);
		background: var(--ink);
		color: var(--bg);
	}
	.bulk .count {
		flex: 1 1 auto;
		font-weight: 700;
	}
	.bulk label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.bulk select {
		min-height: 40px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.bulk .set {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 10px;
		border: none;
		background: var(--fill);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.bulk .clear {
		width: 40px;
		height: 40px;
		border: none;
		background: none;
		color: var(--bg);
	}
	.scroll {
		overflow-x: auto;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	table {
		width: 100%;
		min-width: 760px;
		border-collapse: collapse;
		font-size: 14px;
	}
	th {
		padding: 10px 8px;
		text-align: left;
		font-size: 12px;
		color: var(--ink-muted);
	}
	td {
		padding: 10px 8px;
		border-top: 1px solid var(--line);
		vertical-align: middle;
	}
	.pick {
		width: 32px;
		padding-left: 16px;
	}
	tr.on {
		background: var(--nav-on);
	}
	.name {
		padding: 0;
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
	}
	.name:hover {
		text-decoration: underline;
	}
	.id {
		display: block;
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--ink-muted);
	}
	.off {
		color: var(--alert);
		font-weight: 600;
	}
	.chip {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 999px;
		border: none;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
	}
	.chip.good {
		background: var(--surface-2, var(--bg));
		color: var(--ink);
		border: 1px solid var(--line);
	}
	.chip.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.chip.bad {
		background: var(--alert-bg);
		color: var(--alert);
		cursor: pointer;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 58px;
		padding: 6px var(--space-3) 6px var(--space-4);
		border: none;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.sub {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
