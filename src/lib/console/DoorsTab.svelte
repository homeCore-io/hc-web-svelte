<!--
	A room's Doors tab in the console (the Garage and LivingRoom boards):
	each overhead door drawn big, open or shut as its sensor says, with a
	button that moves it; then the room's other doors and its locks
	(doors.ts). Cameras and sirens have a tab of their own (CamerasTab). A
	switch or timer the household put here sits with them as it would with
	the switches (SwitchSet).
	Without an overhead door, doors and locks are drawn big themselves.

	Opening a door and unlocking a lock ask first; shutting and locking don't.
	Sized to the window (`fit`), so it doesn't scroll.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { cardFor, isOpen, kindOf } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';
	import Col from './Col.svelte';
	import Row from './Row.svelte';
	import { fit } from './fit.js';
	import SwitchSet from './SwitchSet.svelte';
	import { setTitle } from './switches.js';
	import { doorsTab, pressFor, type BigDoor } from './doors.js';
	import { brandOf, shortName } from './room.js';

	let { list, room, may }: { list: CoreDevice[]; room: string; may: boolean } = $props();

	const tab = $derived(doorsTab(list, room));
	const nameOf = (d: CoreDevice) =>
		shortName((d.name_override ?? d.name).replace(/\s+sensor$/i, ''), room);
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const waiting = (d: CoreDevice) => commands.pending[d.device_id] !== undefined;
	const card = (d: CoreDevice) => cardFor(d, clock.now);
	const isOpenNow = (d: CoreDevice) => isOpen(card(d));
	const locked = (d: CoreDevice) =>
		({ ...d.attributes, ...commands.pending[d.device_id]?.want }).locked === true;
	const from = (d: CoreDevice) => brandOf(d.plugin_id);

	// With no overhead door, the first few doors and locks are drawn big too.
	const BIG = 4;
	const drawn = $derived(tab.big.length > 0 ? [] : [...tab.doors, ...tab.locks].slice(0, BIG));
	const listed = $derived([...tab.doors, ...tab.locks].filter((d) => !drawn.includes(d)));

	// ---- moving a door ----
	async function move(door: BigDoor) {
		const o = door.opener;
		if (!o || !may) return;
		const shut = door.sensor ? !isOpenNow(door.sensor) : undefined;
		const p = pressFor(o, shut === undefined ? undefined : !shut);
		if (!p) return open(o);
		if (shut !== false) {
			const yes = await ask({
				title: `Open ${door.name}?`,
				body: shut === undefined ? 'Its sensor doesn’t say where it is now.' : undefined,
				go: 'Open',
				stay: 'Not now'
			});
			if (!yes) return;
		}
		if (p.kind === 'action') void commands.act(o.device_id, p.id, p.params);
		else void commands.set(o.device_id, 'cover', p.want, o.attributes);
	}
	async function pressOpener(o: CoreDevice) {
		if (!may) return;
		const p = pressFor(o, undefined);
		if (!p) return open(o);
		const yes = await ask({
			title: `Press ${o.name_override ?? o.name}?`,
			body: 'It may open a door. Nothing here says which way it will go.',
			go: 'Press',
			stay: 'Not now'
		});
		if (!yes) return;
		if (p.kind === 'action') void commands.act(o.device_id, p.id, p.params);
		else void commands.set(o.device_id, 'switch', p.want, o.attributes);
	}

	// ---- locks ----
	async function flipLock(d: CoreDevice) {
		if (!may || !d.available) return;
		if (locked(d)) {
			const yes = await ask({ title: `Unlock ${nameOf(d)}?`, go: 'Unlock', stay: 'Not now' });
			if (!yes) return;
			return void commands.set(d.device_id, 'lock', { locked: false }, d.attributes);
		}
		void commands.set(d.device_id, 'lock', { locked: true }, d.attributes);
	}
	const canLock = (d: CoreDevice) => card(d).control?.kind === 'lock';

	const stateOf = (d: CoreDevice) => (d.available ? card(d).stateLine : 'Offline');
	const dotOf = (d: CoreDevice): 'quiet' | 'busy' | 'alert' =>
		!d.available || card(d).tone === 'alert' ? 'alert' : card(d).tone === 'on' ? 'busy' : 'quiet';
</script>

{#snippet lockButton(d: CoreDevice)}
	{#if canLock(d)}
		<button
			type="button"
			class="tbtn"
			class:lit={!locked(d)}
			aria-busy={waiting(d) || undefined}
			disabled={!may || !d.available}
			onclick={() => flipLock(d)}>{locked(d) ? 'Unlock' : 'Lock'}</button
		>
	{/if}
{/snippet}

<div class="desk" use:fit={tab}>
	{#each tab.big as door (door.key)}
		{@const s = door.sensor}
		{@const isUp = s ? isOpenNow(s) : false}
		{@const offline = !!s && !s.available}
		{@const o = door.opener}
		<Col
			title={door.name}
			plugin={o?.plugin_id ?? s?.plugin_id}
			note={commands.notes[o?.device_id ?? ''] ?? (offline ? 'Offline' : isUp ? 'Open' : 'Closed')}
			alert={isUp || offline || !!commands.notes[o?.device_id ?? '']}
			width="calc(150px + 80px * var(--k, 1))"
			onopen={s ? () => open(s) : undefined}
			place={o ?? s}
		>
			<svg class="oh" class:up={isUp} viewBox="0 0 200 150" aria-hidden="true">
				<rect class="frame" x="6" y="6" width="188" height="140" rx="4" />
				<ellipse class="out" cx="100" cy="146" rx="110" ry="40" />
				<svg x="10" y="8" width="180" height="138">
					<g class="slats">
						{#each [0, 1, 2, 3, 4, 5] as i (i)}
							<rect x="0" y={2 + i * 22.6} width="180" height="21" rx="3" />
						{/each}
					</g>
				</svg>
			</svg>
			<button
				type="button"
				class="dbtn"
				class:close={isUp}
				aria-busy={(o && waiting(o)) || undefined}
				disabled={!may || !o || !o.available || offline}
				title={o ? `Uses ${o.name_override ?? o.name}` : 'Nothing here opens this door'}
				onclick={() => move(door)}>{isUp ? 'Close door' : 'Open door'}</button
			>
			<span class="sub"
				>{s ? `${nameOf(s)} sensor · ${from(s)}` : ''}{#if door.also.length > 0}<br />Also opened by {door.also
						.map((a) => a.name_override ?? a.name)
						.join(', ')}{/if}</span
			>
		</Col>
	{/each}

	{#each drawn as d (d.device_id)}
		{#if kindOf(d) === 'lock'}
			{@const shut = locked(d)}
			<Col
				title={nameOf(d)}
				plugin={d.plugin_id}
				note={commands.notes[d.device_id]}
				alert
				width="calc(170px + 70px * var(--k, 1))"
				onopen={() => open(d)}
				place={d}
			>
				<div class="big">
					<svg class="lockv" viewBox="0 0 100 120" aria-hidden="true">
						<path
							class="shackle"
							class:shut
							d={shut ? 'M30 54 V36 A20 20 0 0 1 70 36 V54' : 'M30 54 V36 A20 20 0 0 1 70 36 V26'}
							transform={shut ? undefined : 'translate(0 -10)'}
						/>
						<rect class="body" class:shut x="14" y="50" width="72" height="62" rx="12" />
						<circle cx="50" cy="78" r="8" class="hole" />
						<rect x="47" y="80" width="6" height="16" rx="3" class="hole" />
					</svg>
					<div>
						<b class:bad={!shut || !d.available}
							>{d.available ? (shut ? 'Locked' : 'Unlocked') : 'Offline'}</b
						>
						<small>{from(d)}</small>
					</div>
				</div>
				{@render lockButton(d)}
			</Col>
		{:else}
			{@const ajar = isOpenNow(d)}
			<Col
				title={nameOf(d)}
				plugin={d.plugin_id}
				width="calc(170px + 70px * var(--k, 1))"
				onopen={() => open(d)}
				place={d}
			>
				<div class="big">
					<svg class="doorv" viewBox="0 0 160 150" aria-hidden="true">
						<rect class="frame" x="30" y="10" width="100" height="135" rx="4" />
						<path
							class="leaf"
							class:ajar
							d={ajar ? 'M34 14 L86 26 L86 129 L34 141 Z' : 'M34 14 L126 14 L126 141 L34 141 Z'}
						/>
						<circle cx={ajar ? 78 : 116} cy="82" r="4" class="knob" />
					</svg>
					<div>
						<b class:bad={ajar || !d.available}
							>{d.available ? (ajar ? 'Open' : 'Closed') : 'Offline'}</b
						>
						<small>{stateOf(d) === 'Closed' ? from(d) : stateOf(d)}</small>
					</div>
				</div>
			</Col>
		{/if}
	{/each}

	{#if listed.length > 0 || tab.openers.length > 0}
		<Col title={tab.big.length > 0 || drawn.length > 0 ? 'Other doors' : 'Doors'} grow>
			<div class="list">
				{#each listed as d (d.device_id)}
					{#if canLock(d)}
						<Row
							name={nameOf(d)}
							sub={from(d)}
							dot={!d.available || !locked(d) ? 'busy' : 'quiet'}
							onopen={() => open(d)}
							place={d}
						>
							{@render lockButton(d)}
						</Row>
					{:else}
						<Row
							name={nameOf(d)}
							sub={from(d)}
							dot={!d.available ? 'alert' : isOpenNow(d) ? 'busy' : 'quiet'}
							word={d.available ? (isOpenNow(d) ? 'Open' : 'Closed') : 'Offline'}
							onopen={() => open(d)}
							place={d}
						/>
					{/if}
				{/each}
				{#each tab.openers as o (o.device_id)}
					<Row
						name={o.name_override ?? o.name}
						sub={`${from(o)} · opens a door`}
						onopen={() => open(o)}
						place={o}
					>
						<button
							type="button"
							class="tbtn"
							aria-busy={waiting(o) || undefined}
							disabled={!may || !o.available}
							onclick={() => pressOpener(o)}>Press</button
						>
					</Row>
				{/each}
			</div>
		</Col>
	{/if}

	{#if tab.watch.length > 0}
		<Col title="Security" grow>
			<div class="list">
				{#each tab.watch as d (d.device_id)}
					<Row
						name={nameOf(d)}
						sub={from(d)}
						dot={dotOf(d)}
						word={stateOf(d)}
						onopen={() => open(d)}
						place={d}
					/>
				{/each}
			</div>
			<span class="sub">Their pages have their controls.</span>
		</Col>
	{/if}

	{#if tab.other.length > 0}
		<Col title={setTitle(tab.other)} grow>
			<SwitchSet list={tab.other} {room} {may} />
		</Col>
	{/if}
</div>

<style>
	.desk {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		row-gap: 22px;
	}
	.oh {
		width: 100%;
		height: auto;
		border-radius: 12px;
	}
	.oh .frame {
		fill: #06070a;
		stroke: #2c303b;
		stroke-width: 3;
		transition: stroke 0.3s;
	}
	.oh.up .frame {
		stroke: #ff8a5b;
	}
	.oh .out {
		fill: #7fb8ff;
		opacity: 0;
		transition: opacity 0.6s;
	}
	.oh.up .out {
		opacity: 0.3;
	}
	.slats {
		transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.slats rect {
		fill: #2a2e38;
		stroke: #3a3f4b;
	}
	.oh.up .slats {
		transform: translateY(-118px);
	}
	:global(:root[data-theme='light']) .oh .frame {
		fill: #d9d4ca;
		stroke: #b9b3a7;
	}
	:global(:root[data-theme='light']) .slats rect {
		fill: #f4f1ea;
		stroke: #c9c3b6;
	}
	@media (prefers-reduced-motion: reduce) {
		.slats {
			transition: none;
		}
	}
	.dbtn {
		height: calc(36px + 10px * var(--k, 1));
		border: 0;
		border-radius: 12px;
		font: 700 14px var(--font);
		cursor: pointer;
		color: #1d1006;
		background: linear-gradient(180deg, #ffd28a, #ffb35c);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			0 8px 18px -8px rgba(255, 170, 80, 0.7);
	}
	.dbtn.close {
		color: #fff;
		background: linear-gradient(180deg, #ff7d6b, #e5483a);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.35),
			0 8px 18px -8px rgba(255, 90, 70, 0.8);
	}
	.dbtn:disabled {
		cursor: default;
		opacity: 0.45;
		box-shadow: none;
	}
	.dbtn[aria-busy='true'],
	.tbtn[aria-busy='true'] {
		opacity: 0.65;
	}
	.big + .tbtn {
		align-self: flex-start;
	}
	.tbtn {
		flex: none;
		height: 30px;
		padding: 0 12px;
		border: 0;
		border-radius: 9px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
		font: 600 12.5px var(--font);
		cursor: pointer;
	}
	.tbtn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 14%, transparent);
	}
	.tbtn.lit {
		background: linear-gradient(140deg, #ffc46b, #ff8a5b);
		color: #1d1006;
	}
	.tbtn:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.dbtn:focus-visible,
	.tbtn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.sub {
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--ink-muted);
	}
	.big {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.big b {
		display: block;
		font-size: calc(24px + 8px * var(--k, 1));
		font-weight: 700;
		letter-spacing: -0.02em;
		color: color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink));
	}
	.big b.bad {
		color: #ffb38a;
	}
	:global(:root[data-theme='light']) .big b.bad {
		color: #b4471c;
	}
	.big small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.doorv,
	.lockv {
		flex: none;
		width: calc(56px + 34px * var(--k, 1));
		height: auto;
	}
	.doorv .frame {
		fill: #0b0d12;
		stroke: #2c303b;
		stroke-width: 3;
	}
	.leaf {
		fill: #1d2029;
		stroke: #3a3f4b;
		stroke-width: 2;
		transition: d 0.4s;
	}
	.leaf.ajar {
		fill: #2a2e38;
		stroke: #ff8a5b;
	}
	.knob {
		fill: #c7cdd8;
	}
	.shackle {
		fill: none;
		stroke: #ffb38a;
		stroke-width: 10;
		stroke-linecap: round;
	}
	.shackle.shut {
		stroke: #9ff0c9;
	}
	.body {
		fill: #ff8a5b;
	}
	.body.shut {
		fill: #4fe0a0;
	}
	.hole {
		fill: #07080b;
	}
	:global(:root[data-theme='light']) .doorv .frame {
		fill: #d9d4ca;
	}
	:global(:root[data-theme='light']) .leaf {
		fill: #f4f1ea;
		stroke: #b9b3a7;
	}
	.list {
		display: flex;
		flex-direction: column;
		min-width: 220px;
	}
</style>
