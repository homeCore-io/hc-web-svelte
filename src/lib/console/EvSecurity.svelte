<!--
	Everywhere › Security (the Everywhere board): what needs attention first,
	a lock unlocked, a door open, or either one offline, each as a pill with
	what to do about it; then every room's locks and doors as its header
	shows them, green when locked or closed and red when not. A lock's pill
	locks it at once, or asks before unlocking; a door's, or an offline
	one's, opens the room's Doors tab. "Lock everything" asks first. Leak
	sensors are in Water, not here.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import { kindOf } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { openDevice } from '#lib/popup.js';
	import EvHead from './EvHead.svelte';
	import { doorName } from './doors.js';
	import { issuesOf, secRows, type Place, type SecItem } from './everywhere.js';

	let { places }: { places: Place[] } = $props();

	const rows = $derived(secRows(places, commands.pending));
	const issues = $derived(issuesOf(rows));
	const may = $derived(session.mayUse);
	const items = $derived(rows.flatMap((r) => r.items));
	const locks = $derived(items.filter((i) => i.kind === 'lock'));
	const doors = $derived(items.filter((i) => i.kind === 'door'));
	const unlocked = $derived(locks.filter((i) => i.device.available && !i.ok));
	const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
	const short = (d: CoreDevice, p: Place) => doorName(nameOf(d), p.room ? p.name : '');

	const summary = $derived(
		[
			issues.length === 0
				? 'All secure'
				: issues.length === 1
					? '1 needs attention'
					: `${issues.length} need attention`,
			...(locks.length > 0
				? [`${locks.filter((i) => i.ok).length} of ${locks.length} locked`]
				: []),
			...(doors.length > 0
				? [`${doors.filter((i) => i.ok).length} of ${doors.length} doors closed`]
				: [])
		].join(' · ')
	);

	function doorsOf(p: Place) {
		if (p.room) void goto(`/rooms/${p.room.id}?tab=doors`);
	}
	async function lock(d: CoreDevice, to: boolean) {
		if (!may || !d.available) return openDevice(d.device_id, page.url);
		if (!to && !(await goAhead(d.device_id, kindOf(d), `Unlock ${nameOf(d)}?`))) return;
		void commands.set(d.device_id, kindOf(d), { locked: to }, d.attributes);
	}
	/** "Garage: OH1 Door open"; offline, as its room's pill says it: "Laundry Room Lock: Offline". */
	const issueWord = (i: SecItem, p: Place) =>
		i.device.available
			? `${p.name}: ${short(i.device, p)} ${i.word.toLowerCase()}`
			: `${p.room ? `${p.name} ` : ''}${short(i.device, p)}: Offline`;
	/** An offline one's pill above opens its room's Doors tab; the rest act as their room's pills. */
	const fix = (i: SecItem, p: Place) => (!i.device.available && p.room ? doorsOf(p) : use(i, p));
	function use(i: SecItem, p: Place) {
		if (!i.device.available) return openDevice(i.device.device_id, page.url);
		if (i.kind === 'lock') return lock(i.device, !i.ok);
		if (p.room) return doorsOf(p);
		openDevice(i.device.device_id, page.url);
	}
	async function lockAll() {
		if (unlocked.length === 0) return;
		const yes = await ask({
			title: 'Lock everything?',
			body:
				unlocked.length === 1
					? `${nameOf(unlocked[0]!.device)} locks.`
					: `All ${unlocked.length} unlocked locks lock.`,
			go: 'Lock',
			stay: 'Not now'
		});
		if (!yes) return;
		for (const i of unlocked)
			void commands.set(
				i.device.device_id,
				kindOf(i.device),
				{ locked: true },
				i.device.attributes
			);
	}
</script>

<EvHead
	title="Security"
	{summary}
	glow={issues.length > 0 ? 'var(--alert)' : 'var(--good, #4fe0a0)'}
>
	<button type="button" class="hbtn" disabled={!may || unlocked.length === 0} onclick={lockAll}
		>Lock everything</button
	>
</EvHead>

<section class="evlist" aria-label="Security in every room">
	{#if issues.length > 0}
		<div class="issues" role="group" aria-label="Needs attention">
			{#each issues as { place, item } (item.device.device_id)}
				<button
					type="button"
					class="ipill"
					disabled={item.kind === 'lock' && item.device.available && !may}
					onclick={() => fix(item, place)}
					><i aria-hidden="true"></i>{issueWord(item, place)}<b
						>{item.kind === 'lock' && item.device.available ? 'Lock it' : 'Show'}</b
					></button
				>
			{/each}
		</div>
	{/if}
	{#if rows.length === 0}
		<p class="quiet">No locks or door sensors in the house yet.</p>
	{/if}
	{#each rows as r (r.place.key)}
		<div class="evrow">
			{#if r.place.room}
				<a class="evname" href={`/rooms/${r.place.room.id}?tab=doors`}><b>{r.place.name}</b></a>
			{:else}
				<div class="evname"><b>{r.place.name}</b></div>
			{/if}
			<div class="pills">
				{#each r.items as i (i.device.device_id)}
					<button
						type="button"
						class="spill"
						class:ok={i.ok}
						class:bad={!i.ok}
						aria-busy={commands.pending[i.device.device_id] ? true : undefined}
						title={!i.device.available
							? `${nameOf(i.device)} is offline`
							: i.kind === 'lock'
								? `${i.ok ? 'Unlock' : 'Lock'} ${nameOf(i.device)}`
								: 'See the room’s doors'}
						onclick={() => use(i, r.place)}
					>
						{#if i.kind === 'lock'}
							{#if i.ok}<LockIcon size={13} strokeWidth={2.2} aria-hidden="true" />{:else}<LockOpen
									size={13}
									strokeWidth={2.2}
									aria-hidden="true"
								/>{/if}
						{:else if i.ok}<DoorClosed
								size={13}
								strokeWidth={2.2}
								aria-hidden="true"
							/>{:else}<DoorOpen size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
						{short(i.device, r.place)}: {commands.notes[i.device.device_id] ?? i.word}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</section>
