<!--
	Everywhere › Security (the Everywhere board): what needs attention first,
	a lock unlocked, a door open, something else watched active, or any one
	offline, each as a pill with what to do about it; then every room's locks,
	doors and watched devices as its header shows them, green when locked,
	closed or at rest and red when not. A lock's pill locks it at once, or
	asks before unlocking; a door's, or an offline one's, opens the room's
	Doors tab; a watched one's opens the device. Each pill's "⋯" takes it out
	of security, for someone who may change devices. "Lock everything" asks
	first; on a phone (`phone`) it comes after what needs attention. Leak
	sensors are in Water, not here.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Eye from '@lucide/svelte/icons/eye';
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import { kindOf } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { openDevice } from '#lib/popup.js';
	import { patchDevice } from '#lib/deviceAdmin.js';
	import { focusFirst, moveInMenu } from '#lib/menuKeys.js';
	import EvHead from './EvHead.svelte';
	import { doorName } from './doors.js';
	import { apart } from './apart.js';
	import { issuesOf, secRows, type Place, type SecItem } from './everywhere.js';

	let { places, phone = false }: { places: Place[]; phone?: boolean } = $props();

	const rows = $derived(secRows(places, commands.pending));
	const issues = $derived(issuesOf(rows));
	const may = $derived(session.mayUse);
	const mayEdit = $derived(session.can('devices:write'));
	const items = $derived(rows.flatMap((r) => r.items));
	const locks = $derived(items.filter((i) => i.kind === 'lock'));
	const doors = $derived(items.filter((i) => i.kind === 'door'));
	const unlocked = $derived(locks.filter((i) => i.device.available && !i.ok));
	const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
	const short = (d: CoreDevice, p: Place) => doorName(nameOf(d), p.room ? p.name : '');
	// Two doors in one room shown with one name say which is which.
	const named = (r: { items: { device: CoreDevice }[]; place: Place }) => {
		const m = apart(
			r.items.map((i) => i.device),
			(d) => short(d, r.place)
		);
		return (d: CoreDevice) =>
			short(d, r.place) + (m.has(d.device_id) ? ` (${m.get(d.device_id)})` : '');
	};

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

	// ---- a pill's "⋯": one open at a time ----
	let menu = $state<string | null>(null);
	// The ⋯ button that opened the menu: focus goes back to it as the menu closes.
	let opener: HTMLElement | null = null;
	let note = $state<string | null>(null);
	function shut(refocus: boolean) {
		menu = null;
		if (refocus && opener?.isConnected) opener.focus();
		opener = null;
	}
	function menuKey(e: KeyboardEvent) {
		if (menu === null) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			shut(true);
		} else moveInMenu(e, e.currentTarget as HTMLElement);
	}
	// Tabbing out of the menu, or anywhere else, closes it.
	function menuLeave(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (menu !== null && !(e.currentTarget as HTMLElement).contains(to)) shut(false);
	}
	/** Takes it out of security for everyone; homeCore's event then drops its pill. */
	async function leaveOut(d: CoreDevice) {
		shut(true);
		note = null;
		const err = await patchDevice(d.device_id, { security: false });
		if (err) note = `${nameOf(d)} stays in security: ${err}`;
	}

	function doorsOf(p: Place) {
		if (p.room) void goto(`/rooms/${p.room.id}?tab=doors`);
	}
	async function lock(d: CoreDevice, to: boolean) {
		if (!may || !d.available) return openDevice(d.device_id, page.url);
		if (!to && !(await goAhead(d.device_id, kindOf(d), `Unlock ${nameOf(d)}?`))) return;
		void commands.set(d.device_id, kindOf(d), { locked: to }, d.attributes);
	}
	/**
	 * "Garage: OH1 Door open"; a watched one, "Outdoor: Driveway Motion ·
	 * Motion"; offline, as its room's pill says it: "Laundry Room Lock: Offline".
	 */
	const issueWord = (i: SecItem, p: Place) =>
		!i.device.available
			? `${p.room ? `${p.name} ` : ''}${short(i.device, p)}: Offline`
			: i.kind === 'watch'
				? `${p.name}: ${short(i.device, p)} · ${i.word}`
				: `${p.name}: ${short(i.device, p)} ${i.word.toLowerCase()}`;
	/** An offline lock's or door's pill above opens its room's Doors tab; the rest act as their room's pills. */
	const fix = (i: SecItem, p: Place) =>
		!i.device.available && i.kind !== 'watch' && p.room ? doorsOf(p) : use(i, p);
	function use(i: SecItem, p: Place) {
		if (!i.device.available) return openDevice(i.device.device_id, page.url);
		if (i.kind === 'lock') return lock(i.device, !i.ok);
		if (i.kind === 'door' && p.room) return doorsOf(p);
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

<svelte:window
	onclick={(e) => {
		if (menu && !(e.target as Element).closest?.('.more')) menu = null;
	}}
/>
<EvHead
	title="Security"
	{summary}
	glow={issues.length > 0 ? 'var(--alert)' : 'var(--good, #4fe0a0)'}
>
	{#if !phone}
		<button type="button" class="hbtn" disabled={!may || unlocked.length === 0} onclick={lockAll}
			>Lock everything</button
		>
	{/if}
</EvHead>

<section class="evlist" aria-label="Security in every room">
	{#if note}<p class="trouble" role="alert">{note}</p>{/if}
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
	{#if phone && locks.length > 0}
		<button type="button" class="wideact" disabled={!may || unlocked.length === 0} onclick={lockAll}
			>Lock everything</button
		>
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
					<span class="sp">
						<button
							type="button"
							class="spill"
							class:ok={i.ok}
							class:bad={!i.ok}
							class:dotted={mayEdit}
							aria-busy={commands.pending[i.device.device_id] ? true : undefined}
							title={!i.device.available
								? `${nameOf(i.device)} is offline`
								: i.kind === 'lock'
									? `${i.ok ? 'Unlock' : 'Lock'} ${nameOf(i.device)}`
									: i.kind === 'watch'
										? `Open ${nameOf(i.device)}`
										: 'See the room’s doors'}
							onclick={() => use(i, r.place)}
						>
							{#if i.kind === 'watch'}<Eye size={13} strokeWidth={2.2} aria-hidden="true" />
							{:else if i.kind === 'lock'}
								{#if i.ok}<LockIcon
										size={13}
										strokeWidth={2.2}
										aria-hidden="true"
									/>{:else}<LockOpen size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
							{:else if i.ok}<DoorClosed
									size={13}
									strokeWidth={2.2}
									aria-hidden="true"
								/>{:else}<DoorOpen size={13} strokeWidth={2.2} aria-hidden="true" />{/if}
							{named(r)(i.device)}: {commands.notes[i.device.device_id] ?? i.word}
						</button>
						{#if mayEdit}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<span class="more" onkeydown={menuKey} onfocusout={menuLeave}>
								<button
									type="button"
									class="spill dots"
									class:ok={i.ok}
									class:bad={!i.ok}
									aria-label={`More for ${nameOf(i.device)}`}
									aria-haspopup="menu"
									aria-expanded={menu === i.device.device_id}
									onclick={(e) => {
										if (menu === i.device.device_id) return shut(false);
										opener = e.currentTarget;
										menu = i.device.device_id;
									}}>⋯</button
								>
								{#if menu === i.device.device_id}
									<div class="menu" role="menu" tabindex="-1" use:focusFirst>
										<button type="button" role="menuitem" onclick={() => leaveOut(i.device)}
											>Not for security</button
										>
									</div>
								{/if}
							</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	{/each}
</section>

<style>
	/* A pill and its "⋯", joined. */
	.sp {
		display: inline-flex;
	}
	.spill.dotted {
		border-radius: 999px 0 0 999px;
		padding-right: 8px;
	}
	.more {
		position: relative;
		display: inline-flex;
	}
	.spill.dots {
		padding: 0 9px 0 7px;
		border-radius: 0 999px 999px 0;
		border-left: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		font-size: 14px;
		line-height: 1;
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 180px;
		padding: 4px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
	}
	.menu button {
		height: 36px;
		padding: 0 10px;
		border: none;
		border-radius: 8px;
		text-align: left;
		background: none;
		color: var(--ink);
		font: 500 13px var(--font);
		cursor: pointer;
	}
	.menu button:hover,
	.menu button:focus-visible {
		background: var(--surface-2);
	}
	.trouble {
		margin: 0 0 10px;
		color: var(--alert);
		font-size: 13px;
	}
</style>
