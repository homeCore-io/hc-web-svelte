<!--
	A room's Lights tab in the console (the FamilyRoom, Office and LivingRoom
	boards): columns side by side, one per lighting system's group. A Hue room
	or zone has an "All" fader and one per lamp, with its scenes as small chips
	under it; another brand's lights are a column each; then the room's
	switches, its keypads and the scenes that belong to no group.

	A lamp's pill picks it as the scenes' target. With none picked, a scene
	chip shows the scene in the whole group. The bridge has no scenes for a
	single lamp yet, so with a lamp picked the chips say so and wait.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import { colourOf } from '#lib/lit/room.js';
	import Fader from './Fader.svelte';
	import Switch from './Switch.svelte';
	import Keypad from './Keypad.svelte';
	import {
		dims,
		levelOf,
		levelWant,
		SCENES_MIN,
		shortName,
		type LightColumn,
		type LightsTab
	} from './room.js';
	import type { FaderStyle, SwitchStyle } from './style.js';

	let {
		tab,
		room,
		fader,
		sw,
		may,
		dock = false
	}: {
		tab: LightsTab;
		/** The room's name, left off the front of its lights'. */
		room: string;
		fader: FaderStyle;
		sw: SwitchStyle;
		may: boolean;
		/** Whether the room's audio bar sits under the tab. */
		dock?: boolean;
	} = $props();

	const nameOf = (d: CoreDevice) => shortName(d.name_override ?? d.name, room);
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const level = (d: CoreDevice) => levelOf(d, want(d));
	const isOn = (d: CoreDevice) => ({ ...d.attributes, ...want(d) }).on === true;
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const colour = (d: CoreDevice) => (isOn(d) ? `rgb(${colourOf(d)})` : undefined);

	// A crowded room: narrower pills, so the columns fit across.
	const tight = $derived(tab.tight);

	// ---- the faders' height: what the window leaves them, from 200 down to 110 ----
	const TALLEST = 200;
	const SHORTEST = 110;
	let viewH = $state(900);
	let desk = $state<HTMLElement>();
	let height = $state(TALLEST);
	/** Below the desk: the panel's edge, and the room's audio bar when it has one. */
	const below = $derived((viewH <= 820 ? 30 : 36) + (dock ? 78 : 0));
	$effect(() => {
		void [viewH, tab, allScenes, picked, height];
		if (!desk) return;
		const top = desk.getBoundingClientRect().top + window.scrollY;
		const cols = [...desk.children] as HTMLElement[];
		// Each row of columns, and what its tallest column needs besides its faders.
		const rows = new Map<number, number>();
		const faderRows = new Set<number>();
		for (const c of cols) {
			const faders = c.querySelector('.faders') !== null;
			if (faders) faderRows.add(c.offsetTop);
			const need = c.offsetHeight - (faders ? height : 0);
			rows.set(c.offsetTop, Math.max(rows.get(c.offsetTop) ?? 0, need));
		}
		if (faderRows.size === 0) return;
		const gaps = (rows.size - 1) * 22;
		const fixed = [...rows.values()].reduce((n, v) => n + v, 0);
		const left = viewH - top - below - gaps - fixed;
		const next = Math.max(SHORTEST, Math.min(TALLEST, Math.floor(left / faderRows.size)));
		if (next !== height) height = next;
	});

	// ---- a group's scenes: two lines of chips, and the rest behind "All" ----
	let allScenes = $state<Record<string, boolean>>({});
	let clipped = $state<Record<string, boolean>>({});
	function clips(node: HTMLElement, key: string) {
		const check = () => {
			const over = node.scrollHeight > node.clientHeight + 1;
			if (over !== !!clipped[key]) clipped = { ...clipped, [key]: over };
		};
		const seen = new ResizeObserver(check);
		seen.observe(node);
		check();
		return { destroy: () => seen.disconnect() };
	}

	function setLevel(d: CoreDevice, v: number) {
		void commands.set(d.device_id, 'light', levelWant(v), d.attributes);
	}
	function setOn(d: CoreDevice, on: boolean) {
		void commands.set(d.device_id, 'switch', { on }, d.attributes);
	}

	/** The column's "All": its group's own level, else the brightest of its lamps. */
	const allLevel = (c: LightColumn) =>
		c.group ? level(c.group) : Math.max(0, ...c.lights.map(level));
	function setAll(c: LightColumn, v: number) {
		if (c.group) return setLevel(c.group, v);
		for (const l of c.lights) setLevel(l, v);
	}

	// ---- picking a lamp as the scenes' target, per column ----
	let picked = $state<Record<string, string | undefined>>({});
	const pick = (c: LightColumn, id: string | undefined) =>
		(picked = { ...picked, [c.key]: picked[c.key] === id ? undefined : id });
	const pickedIn = (c: LightColumn) => c.lights.find((l) => l.device_id === picked[c.key]);

	const activeIn = (c: LightColumn) => c.scenes.find((s) => s.attributes.active === true);
	const paletteOf = (s: CoreDevice) => {
		const p = Array.isArray(s.attributes.palette)
			? (s.attributes.palette as unknown[]).filter((x) => typeof x === 'string')
			: [];
		return p.length > 1
			? `linear-gradient(135deg, ${p.slice(0, 4).join(', ')})`
			: ((p[0] as string | undefined) ?? 'radial-gradient(circle at 35% 30%, #fff3e0, #f7b979)');
	};
	const show = (s: CoreDevice) => void commands.act(s.device_id, 'activate');
	const noteOf = (c: LightColumn) =>
		[c.group, ...c.lights].map((d) => d && commands.notes[d.device_id]).find((n) => !!n);
</script>

<svelte:window bind:innerHeight={viewH} />

<div class="desk" bind:this={desk}>
	{#each tab.columns as c (c.key)}
		{@const chosen = pickedIn(c)}
		{@const scenic = c.scenes.length > 0}
		<section
			class="col"
			class:scenic
			style:--scenes={`${SCENES_MIN}px`}
			aria-label={`${c.brand}: ${c.title}`}
		>
			<div class="ch">
				<span class="tag" data-brand={c.brand.toLowerCase()}>{c.brand}</span>
				{#if c.group}
					<button type="button" class="ttl" onclick={() => open(c.group!)}>{c.title}</button>
				{:else}<span class="ttl">{c.title}</span>{/if}
				{#if c.lights.length > 1}<span class="cn">{c.lights.length} lights</span>{/if}
				{#if noteOf(c)}<span class="warn" role="status">{noteOf(c)}</span>{/if}
			</div>
			<div class="faders">
				{#if c.group || c.lights.length > 1}
					<Fader
						label={`All ${c.lights.length}`}
						value={allLevel(c)}
						style={fader}
						{height}
						{tight}
						disabled={!may}
						waiting={c.group ? waiting(c.group) : c.lights.some(waiting)}
						selected={scenic && !chosen}
						onpick={scenic ? () => (picked = { ...picked, [c.key]: undefined }) : undefined}
						onopen={!scenic && c.group ? () => open(c.group!) : undefined}
						oncommit={(v) => setAll(c, v)}
					/>
				{/if}
				{#each c.lights as l (l.device_id)}
					{#if dims(l)}
						<Fader
							label={nameOf(l)}
							value={level(l)}
							style={fader}
							{height}
							{tight}
							color={colour(l)}
							disabled={!may || !l.available}
							waiting={waiting(l)}
							selected={chosen?.device_id === l.device_id}
							onpick={scenic ? () => pick(c, l.device_id) : undefined}
							onopen={scenic ? undefined : () => open(l)}
							oncommit={(v) => setLevel(l, v)}
						/>
					{:else}
						<div class="plain">
							<Switch
								label={nameOf(l)}
								on={isOn(l)}
								style={sw}
								named={false}
								disabled={!may || !l.available}
								waiting={waiting(l)}
								onchange={(v) => setOn(l, v)}
							/>
							<button type="button" class="pname" onclick={() => open(l)}>{nameOf(l)}</button>
						</div>
					{/if}
				{/each}
			</div>
			{#if scenic}
				{@const active = activeIn(c)}
				<div class="scn" role="group" aria-label={`Scenes for ${c.title}`}>
					<p class="cap">
						{#if chosen}
							Only {nameOf(chosen)} · scenes for one light aren’t available yet
							<button type="button" class="more" onclick={() => open(chosen)}>Details</button>
						{:else}
							{c.group || c.lights.length > 1 ? 'The group’s scenes' : 'Scenes'} · {active
								? `${nameOf(active)} is on`
								: 'none on'}
						{/if}
						{#if clipped[c.key] || allScenes[c.key]}
							<button
								type="button"
								class="more all"
								aria-expanded={!!allScenes[c.key]}
								onclick={() => (allScenes = { ...allScenes, [c.key]: !allScenes[c.key] })}
								>{allScenes[c.key] ? 'Fewer' : `All ${c.scenes.length}`}</button
							>
						{/if}
					</p>
					<div class="chips" class:open={allScenes[c.key]} use:clips={c.key}>
						{#each c.scenes as s (s.device_id)}
							<button
								type="button"
								class="chip"
								class:on={!chosen && s.attributes.active === true}
								disabled={!may || !!chosen || !s.available}
								title={chosen
									? `Scenes for one light aren’t available yet. Pick All to show ${nameOf(s)} in ${c.title}.`
									: `Show ${nameOf(s)} in ${c.title}`}
								onclick={() => show(s)}
								><i style:background={paletteOf(s)} aria-hidden="true"></i>{nameOf(s)}</button
							>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/each}

	{#if tab.switches.length > 0}
		<section class="col sws" aria-label="Switches">
			<div class="ch"><span class="ttl">Switches</span></div>
			<div class="rows">
				{#each tab.switches as s (s.device_id)}
					{#if sw === 'keypad'}
						<Switch
							label={nameOf(s)}
							on={isOn(s)}
							style={sw}
							disabled={!may || !s.available}
							waiting={waiting(s)}
							onchange={(v) => setOn(s, v)}
						/>
					{:else}
						<div class="srow">
							<button type="button" class="sname" onclick={() => open(s)}>{nameOf(s)}</button>
							<Switch
								label={nameOf(s)}
								on={isOn(s)}
								style={sw}
								named={false}
								disabled={!may || !s.available}
								waiting={waiting(s)}
								onchange={(v) => setOn(s, v)}
							/>
						</div>
					{/if}
					{#if commands.notes[s.device_id]}<span class="warn" role="status"
							>{commands.notes[s.device_id]}</span
						>{/if}
				{/each}
			</div>
		</section>
	{/if}

	{#each tab.keypads as k (k.device_id)}
		<section class="col" aria-label={`${nameOf(k)} keypad`}>
			<div class="ch">
				<span class="tag" data-brand={(k.plugin_id ?? '').split('.').pop()}
					>{(k.plugin_id ?? '').split('.').pop()}</span
				>
				<span class="ttl">{nameOf(k)}</span>
				<span class="cn">keypad</span>
			</div>
			<Keypad device={k} {may} />
		</section>
	{/each}

	{#if tab.scenes.length > 0}
		<section class="col" aria-label="Scenes">
			<div class="ch"><span class="ttl">Scenes</span></div>
			<div class="scn">
				{#each tab.scenes as s (s.device_id)}
					<button
						type="button"
						class="chip"
						disabled={!may || !s.available}
						title={`Show ${nameOf(s)}`}
						onclick={() => show(s)}
						><i style:background={paletteOf(s)} aria-hidden="true"></i>{nameOf(s)}</button
					>
				{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 0 20px;
		border-left: 1px solid var(--con-edge-strong);
		flex: none;
		min-width: 0;
	}
	.col:first-child {
		border-left: 0;
	}
	/* A group with scenes is as wide as its faders, and its chips wrap to that. */
	.col.scenic {
		width: min-content;
	}
	.col.scenic .scn {
		min-width: var(--scenes);
		max-width: none;
	}
	.sws {
		flex: 1 1 220px;
		max-width: 340px;
	}
	.ch {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		font-size: 12.5px;
		font-weight: 700;
	}
	.ttl {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	button.ttl {
		cursor: pointer;
	}
	button.ttl:hover {
		text-decoration: underline;
	}
	.cn {
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.warn {
		font-size: 11.5px;
		font-weight: 500;
		color: var(--alert);
	}
	.tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 7px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
	}
	.tag[data-brand='hue'] {
		background: rgba(127, 184, 255, 0.18);
		color: #a9cdff;
	}
	.tag[data-brand='lutron'] {
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
	}
	:global(:root[data-theme='light']) .tag[data-brand='hue'] {
		color: #1f5fae;
	}
	:global(:root[data-theme='light']) .tag[data-brand='lutron'] {
		color: #8a5a10;
	}
	.faders {
		display: flex;
		gap: 12px;
		align-items: flex-end;
	}
	.plain {
		width: 104px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}
	.pname,
	.sname,
	.more {
		border: 0;
		padding: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.pname {
		font-size: 11.5px;
		font-weight: 600;
		text-align: center;
	}
	.pname:hover,
	.sname:hover,
	.more:hover {
		text-decoration: underline;
	}
	.scn {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		max-width: 360px;
	}
	/* Two lines of chips (26 high, 5 apart) until "All" opens the rest. */
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		max-height: 57px;
		overflow: hidden;
	}
	.chips.open {
		max-height: none;
	}
	.cap {
		display: flex;
		gap: 10px;
		width: 100%;
		margin: 0 0 2px;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.more {
		color: var(--ink);
	}
	.more.all {
		margin-left: auto;
		font-weight: 600;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 9px 0 4px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: color-mix(in srgb, var(--ink) 82%, transparent);
		font-size: 11.5px;
		font-weight: 500;
		cursor: pointer;
	}
	.chip:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--ink);
	}
	.chip:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.chip i {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		flex: none;
	}
	.chip.on {
		background: color-mix(in srgb, var(--ink) 16%, transparent);
		color: var(--ink);
		box-shadow: inset 0 0 0 1.5px var(--ink);
	}
	.chip:focus-visible,
	.pname:focus-visible,
	.sname:focus-visible,
	.ttl:focus-visible,
	.more:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.srow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 5px 0;
		border-top: 1px solid var(--con-edge);
	}
	.srow:first-child {
		border-top: 0;
	}
	.sname {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
