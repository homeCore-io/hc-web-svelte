<!--
	The WLED plugin's controllers (hc-wled): each with its room, the address
	the plugin reaches it at (changed here), whether changes arrive pushed or
	polled, its hardware and firmware; finding more on the network, adding one
	by address, removing one; and what spans controllers — copying presets,
	backing them all up, updating firmware one at a time.

	The plugin reads its controllers when it starts, so a change to the list
	restarts it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { displayName } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { deviceHref } from '#lib/popup.js';
	import { lifecycle, runAction } from '#lib/pluginAdmin.js';
	import { isWled, WLED } from '#lib/wled.js';

	const list = $derived(
		Object.values(devices.byId)
			.filter((d) => isWled(d))
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const admin = $derived(session.isAdmin);
	let note = $state('');
	let busy = $state(false);

	async function restartPlugin(said: string) {
		note = `${said} Restarting the WLED plugin to take it…`;
		const r = await lifecycle(WLED, 'restart');
		note = r.ok ? `${said} The plugin has restarted.` : r.error;
	}
	async function reply(
		action: string,
		params: Record<string, unknown>
	): Promise<Record<string, unknown> | null> {
		const r = await runAction(WLED, action, params);
		if (!r.ok) {
			note = r.error;
			return null;
		}
		return r.data.kind === 'reply' ? r.data.reply : {};
	}

	// ---- one controller ----
	let editing = $state<string | null>(null);
	let address = $state('');
	async function saveAddress(d: CoreDevice) {
		if (!address.trim()) return;
		if (await reply('update_device', { device_id: d.device_id, host: address.trim() })) {
			editing = null;
			await restartPlugin(`${displayName(d)} is at ${address.trim()} now.`);
		}
	}
	async function remove(d: CoreDevice) {
		if (
			!(await ask({
				title: `Stop looking after ${displayName(d)}? It leaves homeCore, and automations that use it stop working.`,
				go: 'Remove',
				stay: 'Keep it'
			}))
		)
			return;
		if (await reply('remove_device', { device_id: d.device_id }))
			await restartPlugin(`${displayName(d)} is removed.`);
	}
	async function restart(d: CoreDevice) {
		if (
			!(await ask({
				title: `Restart ${displayName(d)}? Its lights go out for a few seconds.`,
				go: 'Restart',
				stay: 'Not now'
			}))
		)
			return;
		void commands.act(d.device_id, 'restart');
	}

	// ---- finding more ----
	type Found = { name?: string; ip?: string; vid?: number; source?: string };
	let found = $state<Found[] | null>(null);
	let dismissed = $state<Set<string>>(new Set());
	const known = (ip?: string) =>
		!!ip && list.some((d) => d.attributes.address === ip || d.attributes.ip === ip);
	async function discover() {
		busy = true;
		note = 'Looking on the network…';
		const r = await reply('discover_devices', {});
		busy = false;
		if (!r) return;
		found = Array.isArray(r.discovered) ? (r.discovered as Found[]) : [];
		const fresh = found.filter((f) => !known(f.ip)).length;
		note = fresh ? '' : 'Nothing new on the network.';
	}
	let newHost = $state('');
	async function add(host: string, name?: string) {
		busy = true;
		const r = await reply('add_device', { host, ...(name ? { name } : {}) });
		busy = false;
		if (r) {
			newHost = '';
			await restartPlugin(`${String(r.name ?? host)} is added.`);
		}
	}

	// ---- across controllers ----
	let copyFrom = $state('');
	let copyTo = $state('');
	async function copy() {
		const from = list.find((d) => d.device_id === copyFrom);
		const to = list.find((d) => d.device_id === copyTo);
		if (!from || !to || from === to) return;
		if (
			!(await ask({
				title: `Replace ${displayName(to)}'s presets with ${displayName(from)}'s?`,
				go: 'Copy',
				stay: 'Not now'
			}))
		)
			return;
		const r = await reply('copy_presets', {
			from_device_id: from.device_id,
			to_device_id: to.device_id
		});
		if (r) note = `Copied ${String(r.copied ?? '')} presets to ${displayName(to)}.`;
	}
	async function backupAll() {
		busy = true;
		const out: Record<string, unknown> = {};
		for (const d of list) {
			note = `Backing up ${displayName(d)}…`;
			const r = await reply('backup', { device_id: d.device_id });
			if (r) out[d.device_id] = r.backup;
		}
		busy = false;
		const a = document.createElement('a');
		a.href = URL.createObjectURL(
			new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
		);
		a.download = `wled-backups-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
		note = `Backed up ${Object.keys(out).length} controller${Object.keys(out).length === 1 ? '' : 's'} — and kept with the plugin too.`;
	}
	const waiting = $derived(list.filter((d) => d.attributes.firmware_update_available === true));
	/** One at a time, and stop at the first that doesn't come back. */
	async function updateAll() {
		if (
			!(await ask({
				title: `Update ${waiting.length} controller${waiting.length === 1 ? '' : 's'}, one at a time? Each goes dark for about a minute; each is backed up first.`,
				go: 'Update',
				stay: 'Not now'
			}))
		)
			return;
		busy = true;
		for (const d of [...waiting]) {
			const v = String(d.attributes.firmware_latest ?? '');
			note = `Updating ${displayName(d)} to ${v}…`;
			await commands.act(d.device_id, 'install_firmware', { version: v });
			const started = Date.now();
			// The install's own status says when it's done.
			let status = 'installing';
			while (Date.now() - started < 300_000) {
				await new Promise((r) => setTimeout(r, 3000));
				status = String(devices.byId[d.device_id]?.attributes.firmware_status ?? '');
				if (Date.now() - started > 8000 && status !== 'installing') break;
			}
			if (status !== 'up_to_date' && status !== 'available') {
				note = `${displayName(d)} didn't come back on ${v} — stopped there.`;
				busy = false;
				return;
			}
		}
		busy = false;
		note = 'Every controller is updated.';
	}
	const signal = (d: CoreDevice) =>
		typeof d.attributes.wifi_signal_pct === 'number' ? `${d.attributes.wifi_signal_pct}%` : '—';
</script>

<section class="card wled">
	<div class="head">
		<h2>Controllers</h2>
		{#if admin}
			<div class="tools">
				<button class="primary" disabled={busy} onclick={discover}>Look for controllers</button>
			</div>
		{/if}
	</div>
	<div class="scroll">
		<table>
			<thead>
				<tr
					><th>Name and room</th><th>Address</th><th>State</th><th>LEDs · signal · firmware</th><th
					></th></tr
				>
			</thead>
			<tbody>
				{#each list as d (d.device_id)}
					{@const a = d.attributes}
					<tr>
						<td>
							<a href={deviceHref(d.device_id, page.url)}>{displayName(d)}</a>
							<span class="sub"
								>{roomOf(d, rooms.list)?.name ?? 'Not in a room'} · {d.device_id}</span
							>
						</td>
						<td>
							{#if editing === d.device_id}
								<form class="inline" onsubmit={(e) => (e.preventDefault(), saveAddress(d))}>
									<input bind:value={address} aria-label={`Address of ${displayName(d)}`} />
									<button class="pill">Save</button>
									<button type="button" class="pill" onclick={() => (editing = null)}>Cancel</button
									>
								</form>
							{:else}
								<span class="mono">{a.address ?? a.ip ?? '—'}</span>
								{#if admin}<button
										class="link"
										onclick={() => (
											(editing = d.device_id),
											(address = String(a.address ?? a.ip ?? ''))
										)}>change</button
									>{/if}
							{/if}
						</td>
						<td>
							<span
								class="dot"
								class:ok={d.available && a.connection === 'push'}
								class:warn={d.available && a.connection !== 'push'}
								class:bad={!d.available}
							></span>
							{!d.available ? 'Not answering' : a.connection === 'push' ? 'Live' : 'Polling'}
						</td>
						<td class="mono">
							{a.led_count ?? '—'} · {signal(d)} · {d.sw_version ??
								'—'}{a.firmware_update_available === true ? ` → ${a.firmware_latest}` : ''}
						</td>
						<td class="acts">
							<button
								class="pill"
								disabled={!d.available}
								onclick={() => commands.act(d.device_id, 'identify')}>Identify</button
							>
							{#if admin}
								<button class="pill" disabled={!d.available} onclick={() => restart(d)}
									>Restart</button
								>
								<button class="pill danger" onclick={() => remove(d)}>Remove</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if list.length === 0}<p class="sub">No controllers yet.</p>{/if}

	{#if found}
		{#each found.filter((f) => !known(f.ip) && !dismissed.has(f.ip ?? '')) as f (f.ip)}
			<div class="found">
				<span
					>Found on the network, not added: <b>{f.name ?? 'a WLED'}</b>
					<span class="mono">{f.ip}</span></span
				>
				<button class="pill" disabled={busy} onclick={() => f.ip && add(f.ip, f.name)}
					>Add it</button
				>
				<button class="pill" onclick={() => (dismissed = new Set([...dismissed, f.ip ?? '']))}
					>Not this one</button
				>
			</div>
		{/each}
	{/if}

	{#if admin}
		<form class="inline" onsubmit={(e) => (e.preventDefault(), add(newHost.trim()))}>
			<input
				bind:value={newHost}
				placeholder="10.0.10.80 or wled-garage.local"
				aria-label="A controller's address"
			/>
			<button class="pill" disabled={busy || !newHost.trim()}>Add one by address</button>
		</form>
	{/if}
</section>

{#if admin && list.length > 1}
	<section class="card wled">
		<h2>Across controllers</h2>
		<div class="row">
			<span>Copy presets</span>
			<select bind:value={copyFrom} aria-label="From">
				<option value="">from…</option>
				{#each list as d (d.device_id)}<option value={d.device_id}>{displayName(d)}</option>{/each}
			</select>
			<select bind:value={copyTo} aria-label="To">
				<option value="">to…</option>
				{#each list.filter((d) => d.device_id !== copyFrom) as d (d.device_id)}<option
						value={d.device_id}>{displayName(d)}</option
					>{/each}
			</select>
			<button class="pill" disabled={!copyFrom || !copyTo || busy} onclick={copy}>Copy</button>
		</div>
		<div class="row">
			<span>Back up every controller's presets and settings</span>
			<button class="pill" disabled={busy} onclick={backupAll}>Back up</button>
		</div>
		<div class="row">
			<span>Firmware: {waiting.length ? `${waiting.length} can be updated` : 'all up to date'}</span
			>
			{#if waiting.length}<button class="pill" disabled={busy} onclick={updateAll}
					>Update all…</button
				>{/if}
		</div>
		<p class="sub">
			Update all goes one controller at a time and stops at the first that doesn't come back.
		</p>
	</section>
{/if}
{#if note}<p class="note" role="status">{note}</p>{/if}

<style>
	.wled {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
		font-size: 14px;
	}
	th {
		text-align: left;
		font-size: 12px;
		color: var(--ink-muted);
		font-weight: 600;
		padding: 6px 8px;
	}
	td {
		padding: 8px;
		border-top: 1px solid var(--card-line);
		vertical-align: middle;
	}
	td a {
		font-weight: 600;
	}
	.sub {
		display: block;
		font-size: 12px;
		color: var(--ink-muted);
		margin: 0;
	}
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
	}
	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 6px;
		background: var(--line);
	}
	.dot.ok {
		background: #2f8f4e;
	}
	.dot.warn {
		background: var(--track-on);
	}
	.dot.bad {
		background: var(--alert);
	}
	.acts {
		white-space: nowrap;
	}
	.inline,
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.row span {
		flex: 1 1 240px;
	}
	input,
	select {
		font: inherit;
		min-height: 38px;
		border-radius: 9px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		padding: 0 10px;
		min-width: 0;
	}
	.inline input {
		flex: 1 1 220px;
	}
	.found {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
		padding: 10px;
		border: 1px dashed var(--track-on);
		border-radius: 11px;
	}
	.found span {
		flex: 1 1 260px;
	}
	.primary {
		font: inherit;
		font-weight: 600;
		min-height: 40px;
		padding: 0 16px;
		border-radius: var(--radius-chip);
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.pill {
		font: inherit;
		font-size: 13px;
		min-height: 34px;
		padding: 0 12px;
		border-radius: var(--radius-chip);
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.pill.danger {
		color: var(--alert);
		border-color: var(--alert-line);
	}
	.link {
		font: inherit;
		font-size: 13px;
		border: none;
		background: none;
		color: var(--accent);
		text-decoration: underline;
		padding: 0 4px;
	}
	.note {
		margin: 0;
		font-size: 14px;
		color: var(--ink-muted);
	}
	button:disabled {
		opacity: 0.55;
	}
</style>
