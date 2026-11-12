<!--
	A person's own settings, from their avatar on the console (the
	HomeConsole board): their look, their temperature unit, how the
	console's faders and switches are drawn (shown live, as they choose),
	whether its sidebar is open, the rest on Me, and signing out. Only
	theirs, on every screen they sign in to; except which room this screen
	opens on, which is the screen's own (opensOn.ts).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import Palette from '@lucide/svelte/icons/palette';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import SlidersVertical from '@lucide/svelte/icons/sliders-vertical';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import UserRound from '@lucide/svelte/icons/user-round';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { session } from '#lib/me.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { houseUnits } from '#lib/houseUnits.svelte.js';
	import { homeRoomOrder, lookOf, looksOf, ref } from '#lib/layers.js';
	import { units, type TemperatureUnit } from '#lib/units.js';
	import { roleName } from '#lib/people.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import Fader from './Fader.svelte';
	import Switch from './Switch.svelte';
	import { opensOn, setOpensOn } from './opensOn.js';
	import {
		FADER_STYLES,
		SWITCH_STYLES,
		faderStyle,
		sidebarOf,
		switchStyle,
		withConsole,
		type ConsolePrefs
	} from './style.js';

	let { close }: { close: () => void } = $props();

	// ---- look: their own, else the house's ----
	const looks = $derived(looksOf(personal.doc, household.doc));
	const myLook = $derived(looks.find((l) => l.id === personal.doc.look)?.id ?? '');
	const houseLook = $derived(lookOf(undefined, household.doc));
	function setLook(id: string) {
		void personal.change((d) => {
			const { look: _drop, ...rest } = d;
			return id === '' ? rest : { ...rest, look: id };
		});
	}

	// ---- temperature: theirs, over the household's ----
	const temperature = $derived(units().temperature);
	const TEMPERATURES: { value: TemperatureUnit; label: string }[] = [
		{ value: 'F', label: '°F' },
		{ value: 'C', label: '°C' }
	];

	// ---- the console's own: controls and sidebar ----
	const fader = $derived(faderStyle(personal.doc.console, household.doc.console));
	const sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	const sidebar = $derived(sidebarOf(personal.doc.console));
	const choose = (patch: Partial<Record<keyof ConsolePrefs, string | undefined>>) =>
		void personal.change((d) => withConsole(d, patch));
	// The sample: one light and one switch, to see the choice as it's made.
	let level = $state(70);
	let on = $state(true);

	// ---- which room this screen opens on: the screen's, not the person's ----
	const order = $derived(
		homeRoomOrder(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown
	);
	let opens = $state(opensOn() ?? '');
	function openOn(id: string) {
		opens = id;
		setOpensOn(id || undefined);
	}

	async function signOut() {
		close();
		await session.signOut();
		void goto('/login');
	}
</script>

{#snippet seg(
	label: string,
	options: readonly { id: string; name: string }[],
	current: string,
	pick: (id: string) => void
)}
	<div class="seg" style:--n={options.length} role="radiogroup" aria-label={label}>
		{#each options as o (o.id)}
			<button role="radio" aria-checked={current === o.id} onclick={() => pick(o.id)}
				>{o.name}</button
			>
		{/each}
	</div>
{/snippet}

<div class="mh">
	<Avatar name={session.me?.username ?? ''} photo={personal.doc.photo} size={30} />
	<span class="who"
		><b>{session.me?.username}</b><small
			>{session.me ? `${roleName(session.me.role)}. ` : ''}Only you, on every screen you sign in to.</small
		></span
	>
</div>

<div class="row">
	<span class="mic"><Palette size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<label class="mt" for="console-look">Look<small>Console, Lit, Classic or your own</small></label>
	<select id="console-look" value={myLook} onchange={(e) => setLook(e.currentTarget.value)}>
		<option value="">Same as the house ({houseLook.name})</option>
		{#each looks as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
	</select>
</div>

<div class="row">
	<span class="mic"><Thermometer size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<span class="mt"
		>Temperature<small
			>{personal.doc.units?.temperature === undefined && houseUnits.temperature
				? 'The household’s, until you pick'
				: 'Yours, over the household’s'}</small
		></span
	>
	{@render seg(
		'Temperature',
		TEMPERATURES.map((t) => ({ id: t.value, name: t.label })),
		temperature,
		(id) => void personal.setUnits({ temperature: id as TemperatureUnit })
	)}
</div>

<div class="block">
	<div class="row bare">
		<span class="mic"><SlidersVertical size={15} strokeWidth={1.9} aria-hidden="true" /></span>
		<span class="mt">Faders and switches<small>How the console draws them for you</small></span>
	</div>
	{@render seg('Faders', FADER_STYLES, fader, (id) => choose({ fader: id }))}
	{@render seg('Switches', SWITCH_STYLES, sw, (id) => choose({ switch: id }))}
	<div class="sample">
		<Fader
			label="Sample light"
			value={level}
			style={fader}
			height={110}
			tight
			oncommit={(v) => (level = v)}
		/>
		<div class="sw">
			<Switch label="Sample switch" style={sw} {on} onchange={(v) => (on = v)} />
		</div>
	</div>
</div>

<div class="row">
	<span class="mic"><PanelLeft size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<span class="mt">Sidebar<small>Open, or folded to icons</small></span>
	{@render seg(
		'Sidebar',
		[
			{ id: 'open', name: 'Open' },
			{ id: 'folded', name: 'Folded' }
		],
		sidebar,
		(id) => choose({ sidebar: id === 'folded' ? 'folded' : undefined })
	)}
</div>

<div class="row">
	<span class="mic"><DoorOpen size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<label class="mt" for="console-opens"
		>This screen opens on<small>Just this screen, for a wall panel</small></label
	>
	<select id="console-opens" value={opens} onchange={(e) => openOn(e.currentTarget.value)}>
		<option value="">Home</option>
		{#each order as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
	</select>
</div>

<a class="row link" href="/me" onclick={close}>
	<span class="mic"><UserRound size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<span class="mt">Everything else about you<small>Picture, theme, PIN, password</small></span>
</a>
<button class="row link out" onclick={signOut}>
	<span class="mic"><LogOut size={15} strokeWidth={1.9} aria-hidden="true" /></span>
	<span class="mt">Sign out</span>
</button>

<style>
	.mh {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px 10px;
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
		font-size: 13px;
	}
	.who small {
		color: var(--ink-muted);
		font-size: 11px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 4px 10px;
		border-radius: 10px;
		color: var(--ink);
		font: 600 13px var(--font);
	}
	.row.bare {
		padding: 0;
	}
	.mt {
		flex: 1;
		min-width: 0;
	}
	.mt small {
		display: block;
		color: var(--ink-muted);
		font-weight: 500;
		font-size: 11px;
	}
	.mic {
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: 8px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink-muted);
	}
	select {
		max-width: 140px;
		height: 30px;
		padding: 0 8px;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
		font: 600 12px var(--font);
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 6px 10px 10px;
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		flex: none;
		padding: 3px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.row .seg {
		width: 110px;
	}
	.seg button {
		height: 30px;
		min-width: 0;
		padding: 0 4px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink-muted);
		font: 600 12px var(--font);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seg button[aria-checked='true'] {
		background: linear-gradient(140deg, var(--fill), var(--accent));
		color: var(--accent-ink);
	}
	.sample {
		display: flex;
		align-items: flex-end;
		gap: 18px;
		padding: 10px 6px 2px;
	}
	.sample .sw {
		flex: 1;
		min-width: 0;
		padding-bottom: 6px;
	}
	.link {
		width: 100%;
		border: 0;
		background: transparent;
		text-align: left;
		text-decoration: none;
	}
	.link:hover,
	.link:focus-visible {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.out {
		margin-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--ink) 7%, transparent);
		border-radius: 0 0 10px 10px;
	}
</style>
