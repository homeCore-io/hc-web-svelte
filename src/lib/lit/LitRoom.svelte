<!--
	A room in the Lit look (docs/design/12-lit-look.md): a header that glows
	as the room is lit, with the room in chips; what needs someone; lights you
	drag to dim; a panel of switches; doors and locks as what they are; scenes
	as swatches; everything else drawn as it is today; and what's rarely
	touched folded away. The page's own arrangement still applies: what is
	hidden stays hidden, and a card keeps the name the page gave it.
-->
<script lang="ts">
	import { applyPage, withOwn, type Card, type Page } from '#lib/page.js';
	import { cardFor, isOpen, type CardView } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { scenes as homeScenes } from '#lib/scenes.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { openDevice } from '#lib/popup.js';
	import { page as here } from '$app/state';
	import { roomBox } from '#lib/roomBox.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { DEVICE_BUILT_IN, ROOM_BUILT_IN, deviceKind } from '#lib/options.js';
	import { ref } from '#lib/layers.js';
	import KindView from '#lib/components/KindView.svelte';
	import { kindOf } from '#lib/kinds.js';
	import LitLamp from './LitLamp.svelte';
	import LitReading from './LitReading.svelte';
	import LitScene from './LitScene.svelte';
	import LitSwitch from './LitSwitch.svelte';
	import { litRoom, type Lamp, type SceneDisc } from './room.js';

	let { doc, room }: { doc: Page; room: string } = $props();

	const key = $derived(doc.id);
	const mine = $derived(personal.changes(key));
	const shown = $derived(
		applyPage(withOwn(doc, view.changes(key), mine), view.changes(key), mine, { arranging: false })
	);
	const cards = $derived(
		shown.sections.flatMap((s) => (s.hidden ? [] : s.groups.flatMap((g) => g.shown)))
	);
	const names = $derived(
		Object.fromEntries(
			shown.sections.flatMap((s) =>
				s.groups.flatMap((g) =>
					g.shown.flatMap((c) => {
						const n = g.name(c.ref);
						return n === undefined ? [] : [[c.ref, n]];
					})
				)
			)
		)
	);
	const views = $derived(
		Object.fromEntries(
			cards.flatMap((c): [string, CardView][] =>
				c.kind === 'device'
					? [
							[
								c.ref,
								withPending(
									// With its settings here, so a symbol chosen for it (a garage door) counts.
									cardFor(
										c.device,
										clock.now,
										kindOptions.of(key, deviceKind(c.device), c.ref, DEVICE_BUILT_IN)
									),
									commands.pending[c.device.device_id]
								)
							]
						]
					: []
			)
		)
	);
	// homeCore's scenes, by id, so a house scene says what it does.
	const sceneStates = $derived(
		Object.fromEntries(homeScenes.list.map((s) => [s.id, s.states as Record<string, unknown>]))
	);
	const lit = $derived(litRoom(cards, views, names, sceneStates, devices.byId));

	// The room's readings, as its box on Home says them.
	const box = $derived(
		roomBox(
			cards.flatMap((c) => (c.kind === 'device' ? [c.device] : [])),
			Object.values(views),
			devices.byId,
			kindOptions.of('home', 'room', ref.room(room), ROOM_BUILT_IN)
		)
	);
	const lightsOn = $derived(
		[
			...lit.lights.flatMap((l) => ('members' in l ? l.members : [l])),
			...lit.switches.lights
		].filter((l) => l.on).length
	);

	const glow = $derived(
		lit.glow.length === 0
			? 'var(--lit-base)'
			: lit.glow
					.map(
						(g) =>
							`radial-gradient(ellipse 38% 95% at ${g.at.toFixed(0)}% 112%, rgba(${g.rgb}, ${(0.5 * g.level) / 100}), transparent 70%)`
					)
					.join(', ') + ', var(--lit-base)'
	);

	const may = $derived(session.mayUse);
	async function fix(f: { device: string; want: Record<string, unknown> }) {
		const d = devices.byId[f.device];
		if (d)
			void commands.set(f.device, views[`device:${f.device}`]?.kind ?? '', f.want, d.attributes);
	}
	function lightsOff() {
		for (const l of lit.switches.lights)
			if (l.on)
				void commands.set(
					l.card.device.device_id,
					l.view.kind,
					{ [l.attr]: false },
					l.card.device.attributes
				);
	}
	async function lock(c: Card, v: CardView) {
		if (c.kind !== 'device' || v.control?.kind !== 'lock') return;
		const locked = v.control.locked;
		if (locked && !(await goAhead(c.device.device_id, v.kind, `Unlock ${v.name}?`))) return;
		void commands.set(c.device.device_id, v.kind, { locked: !locked }, c.device.attributes);
	}
	function run(s: SceneDisc) {
		if (s.card.kind === 'scene') void homeScenes.run(s.card.id);
		else if (s.card.kind === 'device') void commands.act(s.card.device.device_id, 'activate');
	}
	// Drawn as an overhead door: its kind, the Garage door symbol, or a name that says so.
	const OVERHEAD = /^(garage|garage_door)$/;
	const OVERHEAD_NAME = /\b(garage door|overhead|oh ?\d+)\b/i;
	const details = (c: Card) => c.kind === 'device' && openDevice(c.device.device_id, here.url);
</script>

<div class="lit">
	<header class="hero" style:background={glow}>
		<div class="numbers">
			{#if box.temperature}<span class="big">{box.temperature}</span>{/if}
			{#if box.humidity}<span class="small">{box.humidity} humidity</span>{/if}
		</div>
		<div class="chips">
			<span class="chip"
				><span class="dot" class:warm={lightsOn > 0}></span>{lightsOn === 0
					? 'Lights off'
					: `${lightsOn} light${lightsOn === 1 ? '' : 's'} on`}</span
			>
			{#each lit.problems as p (p.key)}
				{#if p.fix && may}
					<button class="chip bad" onclick={() => fix(p.fix!)}
						><span class="dot bad"></span>{p.title} · {p.fix.label}</button
					>
				{:else}
					<span class="chip bad"><span class="dot bad"></span>{p.title}</span>
				{/if}
			{/each}
		</div>
	</header>

	{#if lit.problems.length}
		<section class="needs" aria-label="Needs you">
			{#each lit.problems as p (p.key)}
				<div class="need">
					<span class="words"
						><b>{p.title}</b>{#if p.detail}<small>{p.detail}</small>{/if}</span
					>
					{#if p.fix && may}<button class="go" onclick={() => fix(p.fix!)}>{p.fix.label}</button
						>{/if}
				</div>
			{/each}
		</section>
	{/if}

	{#if lit.doors.length}
		<section class="doors" aria-label="Doors and locks">
			{#each lit.doors as c (c.ref)}
				{@const v = views[c.ref]}
				{#if v}
					{@const open = isOpen(v)}
					{@const overhead =
						OVERHEAD.test(v.kind) ||
						v.icon.startsWith('garage') ||
						OVERHEAD_NAME.test(names[c.ref] ?? v.name)}
					{@const isLock = v.control?.kind === 'lock'}
					{@const locked = v.control?.kind === 'lock' && v.control.locked}
					<div class="door" class:bad={open || (isLock && !locked)}>
						<button
							class="pic"
							aria-label={`${names[c.ref] ?? v.name}: details`}
							onclick={() => details(c)}
						>
							{#if isLock}
								<svg
									width="46"
									height="56"
									viewBox="0 0 24 28"
									fill="none"
									stroke-width="1.8"
									stroke-linecap="round"
									aria-hidden="true"
									class:ok={locked}
									><rect x="4" y="12" width="16" height="13" rx="3"></rect><path
										d={locked ? 'M8 12V8a4 4 0 0 1 8 0v4' : 'M8 12V8a4 4 0 0 1 7.5-2'}
									></path></svg
								>
							{:else if overhead}
								<!-- An overhead door: its panels, rolled up when it's open. -->
								<span class="garage" aria-hidden="true"
									><span class="panels" class:open
										><span></span><span></span><span></span><span></span></span
									></span
								>
							{:else}
								<span class="frame" aria-hidden="true"><span class="leaf" class:open></span></span>
							{/if}
						</button>
						<div class="row">
							<span class="words"><b>{names[c.ref] ?? v.name}</b><small>{v.stateLine}</small></span>
							{#if isLock && may}
								<button class="pill" class:go={!locked} onclick={() => lock(c, v)}
									>{locked ? 'Unlock' : 'Lock'}</button
								>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</section>
	{/if}

	<div class="cols">
		<div class="col">
			{#if lit.lights.length}
				<section aria-label="Lights">
					<h2 class="label">Lights <small>Drag across a light to dim it</small></h2>
					<div class="lamps">
						{#each lit.lights as l ('members' in l ? `g:${l.name}` : l.card.ref)}<LitLamp
								lamp={l}
							/>{/each}
					</div>
				</section>
			{/if}

			{#if lit.switches.lights.length || lit.switches.power.length}
				<section aria-label="Switches">
					<h2 class="label">
						Switches
						{#if lit.switches.lights.some((l) => l.on) && may}<button
								class="pill"
								onclick={lightsOff}>Lights off</button
							>{/if}
					</h2>
					<div class="panel">
						{#each [{ title: 'Lights', items: lit.switches.lights, power: false }, { title: 'Power and water', items: lit.switches.power, power: true }] as bank (bank.title)}
							{#if bank.items.length}
								<div class="bank">
									<span class="bank-title">{bank.title}</span>
									<div class="rockers">
										{#each bank.items as l (l.card.ref)}
											<LitSwitch {l} power={bank.power} />
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{/if}

			{#if lit.scenes.length}
				<section aria-label="Scenes">
					<h2 class="label">Scenes</h2>
					<div class="scenes">
						{#each lit.scenes as s (s.card.ref)}
							<LitScene {s} run={() => run(s)} />
						{/each}
					</div>
				</section>
			{/if}
		</div>

		<div class="col">
			{#each lit.readings as r (r.card.ref)}<LitReading {r} />{/each}
			{#if lit.watch.length}
				<section aria-label="Watching">
					<h2 class="label">Watching</h2>
					<div class="watch">
						{#each lit.watch as w (w.card.ref)}
							<button class="watch-row" onclick={() => details(w.card)}>
								<span class="wdot {w.tone}" aria-hidden="true"></span>
								<span class="wname">{w.name}</span>
								<small>{w.state}</small>
							</button>
						{/each}
					</div>
				</section>
			{/if}
			{#each lit.rest as c (c.ref)}
				<!-- At the size its kind draws it on this page: a player large, with its channels. -->
				<KindView
					card={c}
					form={kindOf(c).form(c, undefined)}
					page={key}
					cardTools={doc.cardTools}
					label={names[c.ref]}
				/>
			{/each}
			{#if lit.more.length}
				<details class="more">
					<summary
						>More in this room <small
							>· {lit.more.length}
							{lit.more.length === 1 ? 'remote or keypad' : 'remotes and keypads'}</small
						></summary
					>
					{#each lit.more as c (c.ref)}
						{@const v = views[c.ref]}
						<button class="more-row" onclick={() => details(c)}>
							<span>{names[c.ref] ?? v?.name}</span><small>{v?.stateLine}</small>
						</button>
					{/each}
				</details>
			{/if}
		</div>
	</div>
</div>

<style>
	.lit {
		--lit-base: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.hero {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 18px;
		min-height: 170px;
		padding: 24px 26px 20px;
		box-sizing: border-box;
		border-radius: 24px;
		border: 1px solid var(--line);
		transition: background 0.8s;
	}
	.numbers {
		display: flex;
		align-items: baseline;
		gap: 14px;
	}
	.big {
		font-family: var(--font-num);
		font-size: 60px;
		line-height: 1;
	}
	.small {
		color: var(--ink-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		color: var(--ink);
		font-size: 14px;
		font-weight: 600;
	}
	.chip.bad {
		border-color: color-mix(in srgb, var(--alert) 45%, transparent);
		background: color-mix(in srgb, var(--alert) 14%, var(--bg));
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--line);
	}
	.dot.warm {
		background: var(--accent);
	}
	.dot.bad {
		background: var(--alert);
	}
	.needs {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.need {
		flex: 1 1 320px;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 12px 12px 16px;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--alert) 45%, transparent);
		background: color-mix(in srgb, var(--alert) 10%, var(--surface));
	}
	.words {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	small {
		color: var(--ink-muted);
		font-size: 12.5px;
		font-weight: 500;
	}
	.go,
	.pill.go {
		height: 40px;
		padding: 0 20px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.pill {
		height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.doors {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}
	.door {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px;
		border-radius: 20px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.door.bad {
		border-color: color-mix(in srgb, var(--alert) 45%, transparent);
	}
	.pic {
		display: grid;
		place-items: end center;
		height: 86px;
		padding: 0;
		border: none;
		border-radius: 12px;
		background: var(--surface-2);
		color: var(--ink);
		overflow: hidden;
	}
	.pic svg {
		stroke: var(--alert);
		margin-bottom: 14px;
	}
	.pic svg.ok {
		stroke: var(--ok, #6fd39a);
	}
	.frame {
		position: relative;
		width: 30%;
		height: 72px;
		border: 2px solid var(--line);
		border-bottom: none;
		border-radius: 4px 4px 0 0;
	}
	.leaf {
		position: absolute;
		inset: 3px 3px 0;
		border-radius: 3px;
		background: var(--line);
		transform-origin: left;
		transition: transform 0.6s;
	}
	.leaf.open {
		background: var(--accent);
		transform: perspective(200px) rotateY(-60deg);
	}
	.garage {
		position: relative;
		width: 70%;
		height: 72px;
		border: 2px solid var(--line);
		border-bottom: none;
		border-radius: 6px 6px 0 0;
	}
	.panels {
		position: absolute;
		inset: 4px 4px auto;
		height: calc(100% - 4px);
		display: flex;
		flex-direction: column;
		gap: 3px;
		transition: height 0.6s;
	}
	.panels.open {
		height: 14px;
	}
	.panels span {
		flex: 1;
		border-radius: 3px;
		background: var(--line);
	}
	.panels.open span {
		background: var(--accent);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		gap: 22px;
		align-items: start;
	}
	@media (max-width: 899px) {
		.cols {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 22px;
		min-width: 0;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.label small {
		letter-spacing: 0;
		text-transform: none;
	}
	.lamps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
		gap: 10px;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 60%, var(--surface));
	}
	.bank {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* The panel's rockers, as many to a row as fit. */
	.rockers {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
		gap: 10px;
	}
	/* Scenes in rows, not a column. */
	.scenes {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 12px;
	}
	.bank-title {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.watch {
		display: flex;
		flex-direction: column;
		padding: 2px 16px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.watch-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 0;
		border: none;
		border-bottom: 1px solid var(--line);
		background: none;
		color: var(--ink);
		text-align: left;
	}
	.watch-row:last-child {
		border-bottom: none;
	}
	.wname {
		flex: 1;
		font-size: 14px;
	}
	.wdot {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: #6fd39a;
	}
	.wdot.on {
		background: var(--accent);
	}
	.wdot.bad {
		background: var(--alert);
	}
	.wdot.quiet {
		background: var(--line);
	}
	.more {
		padding: 12px 16px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.more summary {
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
	}
	.more-row {
		display: flex;
		justify-content: space-between;
		width: 100%;
		padding: 10px 0;
		border: none;
		border-top: 1px solid var(--line);
		background: none;
		color: var(--ink);
		text-align: left;
		font-size: 14px;
	}
</style>
