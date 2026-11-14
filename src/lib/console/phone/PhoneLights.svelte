<!--
	A room's Lights tab on the phone (the PhonePlan board), from the
	console's (room.ts, lamps.ts): each lighting group in the room's order,
	its faders sized to fit across, "All" and then each lamp, in the person's
	fader style; its scenes as chips under them, shown in the whole group;
	then the room's switches as rows, its keypads and the scenes that belong
	to no group. A fader's name opens the lamp's glass sheet (LampSheet),
	where a scene can be shown in that lamp alone.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import Fader from '../Fader.svelte';
	import Switch from '../Switch.svelte';
	import SwitchSet from '../SwitchSet.svelte';
	import Keypad from '../Keypad.svelte';
	import Moved from '../Moved.svelte';
	import Place from '../Place.svelte';
	import { flips } from '../switches.js';
	import { isTimer } from '../timer.js';
	import { dims, shortName, type LightColumn, type LightsTab } from '../room.js';
	import type { FaderStyle, SwitchStyle } from '../style.js';
	import { blocksOf } from '../layout.js';
	import { namesApart } from '../apart.js';
	import { lampSceneNote, onLabel, swatchOf } from '../hueScenes.js';
	import {
		activeIn,
		allLevel,
		colour,
		isOn,
		level,
		noteOf,
		setAll,
		setLevel,
		setOn,
		show,
		waiting
	} from '../lamps.js';
	import LampSheet from './LampSheet.svelte';
	import { fadersAcross } from './phone.js';

	let {
		tab,
		room,
		fader,
		sw,
		may,
		order
	}: {
		tab: LightsTab;
		room: string;
		fader: FaderStyle;
		sw: SwitchStyle;
		may: boolean;
		/** The columns' order, as the room's layout has it (layout.ts). */
		order?: string[];
	} = $props();

	const blocks = $derived(blocksOf(tab, order));
	// Two with one name ("Outlet - Living Room AC" twice) say which is which.
	const nameOf = $derived(
		namesApart([...tab.columns.flatMap((c) => c.lights), ...tab.switches, ...tab.keypads], (d) =>
			shortName(d.name_override ?? d.name, room)
		)
	);
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const flipped = $derived(tab.switches.filter((d) => flips(d) && !isTimer(d)));
	const unflipped = $derived(tab.switches.filter((d) => !flipped.includes(d)));

	// The faders sit across the width the tab has.
	let width = $state(358);
	const across = (c: LightColumn) =>
		fadersAcross(c.lights.filter(dims).length + (c.group || c.lights.length > 1 ? 1 : 0), width);

	// A group's scenes: the first few, and the rest behind "All".
	const SCENES_SHOWN = 8;
	let allScenes = $state<Record<string, boolean>>({});

	// ---- the glass sheet: a lamp's, or the group's "All" ----
	let sheet = $state<{ key: string; lamp?: string } | null>(null);
	const sheetCol = $derived(sheet ? tab.columns.find((c) => c.key === sheet!.key) : undefined);
	const sheetLamp = $derived(sheetCol?.lights.find((l) => l.device_id === sheet?.lamp));
</script>

<div class="plights" bind:clientWidth={width}>
	{#each blocks as b (b.key)}
		{#if b.kind === 'column'}
			{@const c = tab.columns[b.index]!}
			{@const scenic = c.scenes.length > 0}
			{@const active = activeIn(c)}
			{@const n = across(c)}
			<section class="grp" aria-label={`${c.brand}: ${c.title}`}>
				<div class="gh">
					<span class="tag" data-brand={c.brand.toLowerCase()}>{c.brand}</span>
					<span class="ttl">{c.title}</span>
					{#if c.lights.length > 1}<span class="cn">{c.lights.length} lights</span>{/if}
					{#if noteOf(c)}<span class="warn" role="status">{noteOf(c)}</span>{/if}
					{#if c.group}<span class="pl"><Place d={c.group} /></span>{/if}
				</div>
				<div class="faders" style:--n={n}>
					{#if c.group || c.lights.length > 1}
						<Fader
							label={`All ${c.lights.length}`}
							value={allLevel(c)}
							style={fader}
							height={148}
							fit
							disabled={!may}
							waiting={c.group ? waiting(c.group) : c.lights.some(waiting)}
							onopen={() => (sheet = { key: c.key })}
							oncommit={(v) => setAll(c, v)}
						/>
					{/if}
					{#each c.lights.filter(dims) as l (l.device_id)}
						<Fader
							label={nameOf(l)}
							value={level(l)}
							style={fader}
							height={148}
							fit
							color={colour(l)}
							disabled={!may || !l.available}
							waiting={waiting(l)}
							sub={scenic ? lampSceneNote(l, c.group) : undefined}
							onopen={() => (sheet = { key: c.key, lamp: l.device_id })}
							oncommit={(v) => setLevel(l, v)}
						/>
					{/each}
				</div>
				{#each c.lights.filter((l) => !dims(l)) as l (l.device_id)}
					<div class="srow">
						<button type="button" class="sname" onclick={() => open(l)}>{nameOf(l)}</button>
						<Switch
							label={nameOf(l)}
							on={isOn(l)}
							style={sw}
							named={false}
							disabled={!may || !l.available}
							waiting={waiting(l)}
							onchange={(v) => setOn(l, v)}
						/>
						<Place d={l} tag={false} />
					</div>
				{/each}
				{#if scenic}
					{@const many = c.scenes.length > SCENES_SHOWN && !allScenes[c.key]}
					<p class="cap">
						{c.group || c.lights.length > 1 ? 'The group’s scenes' : 'Scenes'} · {onLabel(
							c.group,
							active && nameOf(active)
						)}
					</p>
					<div class="scn" role="group" aria-label={`Scenes for ${c.title}`}>
						{#each many ? c.scenes.slice(0, SCENES_SHOWN) : c.scenes as s (s.device_id)}
							<button
								type="button"
								class="chip"
								class:on={active?.device_id === s.device_id}
								aria-pressed={active?.device_id === s.device_id}
								disabled={!may || !s.available}
								onclick={() => show(s)}
								><i style:background={swatchOf(s)} aria-hidden="true"></i>{nameOf(s)}</button
							>
						{/each}
						{#if c.scenes.length > SCENES_SHOWN}
							<button
								type="button"
								class="chip more"
								aria-expanded={!!allScenes[c.key]}
								onclick={() => (allScenes = { ...allScenes, [c.key]: !allScenes[c.key] })}
								>{allScenes[c.key] ? 'Fewer' : `All ${c.scenes.length}`}</button
							>
						{/if}
					</div>
				{/if}
			</section>
		{:else if b.kind === 'switches'}
			<section class="grp" aria-label="Switches">
				<h3 class="sh">Switches</h3>
				{#each flipped as s (s.device_id)}
					<div class="srow">
						<button type="button" class="sname" onclick={() => open(s)}
							>{nameOf(s)}<Moved d={s} /></button
						>
						<Switch
							label={nameOf(s)}
							on={isOn(s)}
							style={sw}
							named={false}
							disabled={!may || !s.available}
							waiting={waiting(s)}
							onchange={(v) => setOn(s, v)}
						/>
						<Place d={s} tag={false} />
					</div>
					{#if commands.notes[s.device_id]}<span class="warn" role="status"
							>{commands.notes[s.device_id]}</span
						>{/if}
				{/each}
				{#if unflipped.length > 0}<SwitchSet
						list={unflipped}
						{room}
						{may}
						look="rows"
						named={nameOf}
					/>{/if}
			</section>
		{:else if b.kind === 'keypad'}
			{@const k = tab.keypads[b.index]!}
			<section class="grp" aria-label={`${nameOf(k)} keypad`}>
				<div class="gh">
					<span class="tag" data-brand={(k.plugin_id ?? '').split('.').pop()}
						>{(k.plugin_id ?? '').split('.').pop()}</span
					>
					<span class="ttl">{nameOf(k)}</span>
					<span class="cn">keypad</span>
					<span class="pl"><Place d={k} tag={false} /></span>
				</div>
				<div class="kw"><Keypad device={k} {may} /></div>
			</section>
		{:else}
			<section class="grp" aria-label="Scenes">
				<h3 class="sh">Scenes</h3>
				<div class="scn">
					{#each tab.scenes as s (s.device_id)}
						<button
							type="button"
							class="chip"
							disabled={!may || !s.available}
							onclick={() => show(s)}
							><i style:background={swatchOf(s)} aria-hidden="true"></i>{nameOf(s)}</button
						>
					{/each}
				</div>
			</section>
		{/if}
	{/each}
</div>

{#if sheet && sheetCol && (sheet.lamp === undefined || sheetLamp)}
	<LampSheet col={sheetCol} lamp={sheetLamp} {room} {may} onclose={() => (sheet = null)} />
{/if}

<style>
	.plights {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}
	.grp {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
	}
	.gh {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
		font-size: 13px;
		font-weight: 700;
	}
	.ttl {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cn {
		flex: none;
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 500;
	}
	.pl {
		flex: none;
		display: flex;
		margin-left: auto;
	}
	.warn {
		font-size: 12px;
		font-weight: 500;
		color: var(--alert);
	}
	.tag {
		flex: none;
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 6px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
	}
	.tag[data-brand='hue'] {
		background: rgba(127, 184, 255, 0.15);
		color: #a9cdff;
	}
	.tag[data-brand='lutron'] {
		background: rgba(255, 196, 107, 0.15);
		color: #ffd48a;
	}
	:global(:root[data-theme='light']) .tag[data-brand='hue'] {
		color: #1f5fae;
	}
	:global(:root[data-theme='light']) .tag[data-brand='lutron'] {
		color: #8a5a10;
	}
	/* As many across as fit, the rest wrapping in rows as even as they can be. */
	.faders {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 14px 8px;
		align-items: end;
		justify-items: center;
	}
	.faders > :global(*) {
		width: 100%;
	}
	.cap {
		margin: 4px 0 -2px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.scn {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		min-height: 44px;
		padding: 0 13px 0 7px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
		font: 600 12.5px var(--font);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip i {
		flex: none;
		width: 26px;
		height: 26px;
		border-radius: 50%;
	}
	.chip.on {
		box-shadow: inset 0 0 0 1.5px var(--ink);
		color: var(--ink);
	}
	.chip.more {
		padding: 0 14px;
		color: var(--ink);
	}
	.chip:disabled {
		opacity: 0.5;
	}
	.sh {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.srow {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 54px;
		border-bottom: 1px solid var(--con-edge);
	}
	.sname {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 6px;
		border: 0;
		padding: 0;
		background: none;
		color: inherit;
		font: 600 14px var(--font);
		text-align: left;
	}
	/* A device's "⋯", a finger wide. */
	.plights :global(.place .dots) {
		min-width: 44px;
		min-height: 44px;
	}
	.kw {
		align-self: center;
		max-width: 100%;
		overflow: hidden;
	}
</style>
