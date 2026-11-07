<!--
	The look editor (13 §11, E1 to E3): a look's choices in tabs on one side,
	and on the other a live preview of a room, Home or a display at rest,
	drawn with the house's own devices. Settings › Look opens it for the
	house's looks; Me for a person's own. "What changed" lists how it differs
	from the look it was made from, with a way back.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { byRoom } from '#lib/summary.js';
	import { ref } from '#lib/layers.js';
	import { PALETTES } from '#lib/layers.js';
	import { theme } from '#lib/theme.svelte.js';
	import type { Card, Layout } from '#lib/page.js';
	import { homeDocument } from '#lib/homeDoc.js';
	import { STYLES } from '#lib/styles.js';
	import {
		DRAWINGS,
		FAMILIES,
		LIT,
		MAKEABLE,
		PARTS_OF,
		TAKES,
		madeId,
		drawingOf,
		findLook,
		hasCode,
		readLook,
		type Family,
		type Look,
		type MadeDrawing,
		type Place,
		type PluginRef,
		type Rule,
		type Take
	} from '#lib/looks/model.js';
	import { changesFrom } from '#lib/looks/diff.js';
	import { litRoom } from '#lib/lit/room.js';
	import { moved, reorder } from '#lib/reorder.js';
	import { pluginUis, type LookSlot } from '#lib/pluginUi/uis.svelte.js';
	import { riveDrawings } from '#lib/rive/source.js';
	import { offeredOptions, optionValues, withOption } from '#lib/drawingOptions.js';
	import { extensions } from '#lib/extensions.svelte.js';
	import LookPreview from './LookPreview.svelte';
	import DrawingSample from './DrawingSample.svelte';
	import DrawingEditor from './DrawingEditor.svelte';

	let {
		initial,
		all,
		palette,
		admin,
		save,
		back
	}: {
		initial: Look;
		/** Every look there is, for the one it was made from. */
		all: readonly Look[];
		/** The theme on screen, put back when the editor closes. */
		palette: string;
		/** Whether this person may write code (§6.4, S4). */
		admin: boolean;
		/** Keep the look; a reason if it can't be kept. */
		save: (l: Look) => Promise<string | null>;
		back: () => void;
	} = $props();

	// A copy to change, taken once as it opens.
	let draft = $state<Look>(untrack(() => structuredClone($state.snapshot(initial) as Look)));
	const base = $derived(findLook(all, draft.from));
	const changes = $derived(changesFrom(draft, base));
	let showChanges = $state(false);
	let said = $state('');
	let trouble = $state('');

	const TABS = [
		['drawings', 'Drawings'],
		['feel', 'Feel'],
		['colors', 'Colors'],
		['frame', 'Frame'],
		['rooms', 'Rooms'],
		['home', 'Home'],
		['displays', 'Displays'],
		['reaches', 'Reaches']
	] as const;
	type Tab = (typeof TABS)[number][0];
	let tab = $state<Tab>('drawings');

	// ---- the preview: the busiest room by default ----
	const inRooms = $derived(byRoom(devices.byId, rooms.list));
	const roomsBySize = $derived(
		[...rooms.list].sort(
			(a, b) => (inRooms.get(b.id)?.length ?? 0) - (inRooms.get(a.id)?.length ?? 0)
		)
	);
	// Until one is picked, the busiest, as the house loads.
	let picked = $state('');
	const room = $derived(picked || roomsBySize[0]?.id || '');
	let shownAs = $state<'room' | 'home' | 'display'>('room');
	$effect(() => {
		if (tab === 'home') shownAs = 'home';
		else if (tab === 'displays') shownAs = 'display';
		else if (shownAs !== 'room' && tab !== 'colors' && tab !== 'feel' && tab !== 'drawings')
			shownAs = 'room';
	});

	// The theme shows as it's picked; the one on screen comes back after.
	$effect(() => {
		theme.paint(draft.theme ?? palette);
	});
	$effect(() => () => theme.paint(palette));

	// ---- drawings: each drawn with one of the house's own things ----
	const samples = $derived.by(() => {
		const cards: (Card & { kind: 'device' })[] = Object.values(devices.byId).map((d) => ({
			ref: ref.device(d.device_id),
			kind: 'device',
			device: d,
			scene: cardFor(d, clock.now).kind === 'scene'
		}));
		const views = Object.fromEntries(cards.map((c) => [c.ref, cardFor(c.device, clock.now)]));
		const lit = litRoom(cards, views);
		const three = (cs: Card[]) => cs.slice(0, 3);
		return {
			lights: three(lit.lights.flatMap((l) => ('members' in l ? [] : [l.card]))),
			switches: three(lit.switches.lights.map((l) => l.card)),
			scenes: three(lit.scenes.map((s) => s.card)),
			doors: three(lit.doors),
			readings: three(lit.readings.map((r) => r.card)),
			watching: three(lit.watch.map((w) => w.card)),
			// Players, playing ones first: the artwork drawing shows only while playing (G3).
			media: three(
				cards
					.filter((c) => ['media_player', 'tv'].includes(views[c.ref]!.kind))
					.sort((a, b) => Number(!!views[b.ref]!.nowPlaying) - Number(!!views[a.ref]!.nowPlaying))
			),
			climate: three(cards.filter((c) => views[c.ref]!.kind === 'thermostat'))
		} satisfies Record<Family, Card[]>;
	});
	const FAMILY_NAMES: Record<Family, string> = {
		lights: 'Lights',
		switches: 'Switches',
		scenes: 'Scenes',
		doors: 'Doors and locks',
		readings: 'Readings',
		watching: 'Watching',
		media: 'Players',
		climate: 'Thermostats'
	};
	const layoutFor = (f: Family): Layout | undefined =>
		f === 'watching' ? 'lines' : f === 'scenes' ? 'swatches' : undefined;
	// Plugins' drawings and pieces (13 §12), labelled with their plugin.
	pluginUis.ensure();
	const fromPlugin = (s: LookSlot) =>
		`${s.slot.label ?? s.slot.element} · ${s.pluginId.replace(/^plugin\./, '')}`;
	const optionsFor = (f: Family): { id: string; name: string; made?: MadeDrawing }[] => [
		...DRAWINGS[f],
		...draft.made.filter((m) => m.family === f).map((m) => ({ id: m.id, name: m.name, made: m })),
		...pluginUis
			.looks('look.drawing', f)
			.filter((s) => !s.slot.rive)
			.map((s) => ({ id: s.id, name: fromPlugin(s) })),
		// Drawings made in Rive, from UI extensions and plugins alike.
		...riveDrawings(f).map((d) => ({ id: d.id, name: d.name })),
		// And extensions' code drawings, for any family.
		...extensions
			.drawing(f)
			.filter((e) => e.element.kind === 'code')
			.map((e) => ({ id: e.id, name: `${e.element.label} · ${e.extension.name}` }))
	];
	const headers = $derived(pluginUis.looks('look.piece', 'header'));
	const rests = $derived(pluginUis.looks('look.piece', 'rest'));
	const withDrawing = (f: Family, id: string): Look => ({
		...draft,
		drawings: { ...draft.drawings, [f]: id }
	});
	function choose(f: Family, id: string) {
		draft.drawings = { ...draft.drawings, [f]: id };
	}

	// A drawing being made or changed (§6.4).
	let making = $state<MadeDrawing | null>(null);
	function makeFor(f: Family) {
		const from = drawingOf(draft, f) === 'lit' ? 'lit' : 'classic';
		making = {
			id: '',
			name: `My ${FAMILY_NAMES[f].toLowerCase()}`,
			family: f,
			from,
			parts: structuredClone(PARTS_OF[from]!),
			expr: {}
		};
	}
	function keepDrawing(m: MadeDrawing) {
		const id = m.id || madeId(m.name, draft.made);
		const kept = { ...m, id };
		draft.made = draft.made.some((x) => x.id === id)
			? draft.made.map((x) => (x.id === id ? kept : x))
			: [...draft.made, kept];
		draft.drawings = { ...draft.drawings, [m.family]: id };
		making = null;
		said = `${kept.name} draws ${FAMILY_NAMES[m.family].toLowerCase()} in this look.`;
	}
	function dropDrawing(m: MadeDrawing) {
		draft.made = draft.made.filter((x) => x.id !== m.id);
		if (draft.drawings[m.family] === m.id)
			draft.drawings = { ...draft.drawings, [m.family]: m.from };
		said = `${m.name} removed.`;
	}

	// ---- feel ----
	const DENSITY = [
		['roomy', 'Roomy'],
		['standard', 'Standard'],
		['compact', 'Compact']
	] as const;
	const CORNERS = [
		['square', 'Square'],
		['soft', 'Soft'],
		['round', 'Round']
	] as const;
	const MOTION = [
		['still', 'Still'],
		['gentle', 'Gentle'],
		['lively', 'Lively']
	] as const;

	// ---- rooms ----
	const LAYOUT_NAMES: Partial<Record<Layout, string>> = {
		grid: 'Grid',
		row: 'Row',
		list: 'List',
		panel: 'Panel',
		swatches: 'Swatches',
		lines: 'Lines',
		fold: 'Folded',
		chips: 'Chips',
		joined: 'Joined into one card'
	};
	const PLACES: [Place, string][] = [
		['band', 'Across the top'],
		['main', 'Main column'],
		['side', 'Side column']
	];
	const rules = $derived(draft.grouping.room ?? []);
	const takenAll = $derived(new Set(rules.flatMap((r) => r.takes)));
	const untaken = $derived((Object.keys(TAKES) as Take[]).filter((t) => !takenAll.has(t)));
	const setRules = (next: Rule[]) => (draft.grouping = { ...draft.grouping, room: next });
	const editRule = (i: number, patch: Partial<Rule>) =>
		setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
	function moveRule(i: number, by: number) {
		const j = i + by;
		if (j < 0 || j >= rules.length) return;
		const next = [...rules];
		[next[i], next[j]] = [next[j]!, next[i]!];
		setRules(next);
	}
	function addRule(t: Take) {
		let id: string = t.replace('.', '-');
		for (let n = 2; rules.some((r) => r.id === id); n++) id = `${t.replace('.', '-')}-${n}`;
		setRules([...rules, { id, title: TAKES[t], takes: [t], layout: 'grid', place: 'main' }]);
	}

	// ---- home ----
	const homeSections = $derived(
		homeDocument()
			.sections.filter((s) => !s.fixed)
			.map((s) => ({ id: s.id, title: s.title }))
	);
	const home = $derived(
		draft.grouping.home ?? {
			order: homeSections.map((s) => s.id),
			hidden: [],
			layout: 'list' as const
		}
	);
	const homeRows = $derived([
		...home.order.flatMap((id) => homeSections.filter((s) => s.id === id)),
		...homeSections.filter((s) => !home.order.includes(s.id))
	]);
	const setHome = (patch: Partial<typeof home>) =>
		(draft.grouping = {
			...draft.grouping,
			home: { ...home, order: homeRows.map((s) => s.id), ...patch }
		});
	function moveHome(i: number, by: number) {
		const ids = homeRows.map((s) => s.id);
		const j = i + by;
		if (j < 0 || j >= ids.length) return;
		[ids[i], ids[j]] = [ids[j]!, ids[i]!];
		setHome({ order: ids });
	}

	// ---- keeping it ----
	function backToBase() {
		draft = {
			...structuredClone($state.snapshot(base) as Look),
			id: draft.id,
			name: draft.name,
			from: base.id,
			...(draft.sub ? { sub: draft.sub } : {})
		};
		showChanges = false;
		said = `Back to ${base.name}’s choices.`;
	}
	let saving = $state(false);
	async function keep() {
		trouble = said = '';
		const read = readLook($state.snapshot(draft), all);
		if (typeof read === 'string') return (trouble = read);
		if (hasCode(read) && !admin && JSON.stringify(read.made) !== JSON.stringify(initial.made))
			return (trouble = 'Only an admin can save a drawing with code.');
		saving = true;
		const why = await save(read);
		saving = false;
		if (why) trouble = why;
		else said = `${read.name} saved.`;
	}
</script>

{#if making}
	<DrawingEditor
		start={making}
		look={draft}
		samples={samples[making.family]}
		{admin}
		keep={keepDrawing}
		cancel={() => (making = null)}
	/>
{:else}
	<div class="editor">
		<div class="bar">
			<button class="plain" onclick={back}>‹ Looks</button>
			<input class="name" aria-label="The look's name" bind:value={draft.name} maxlength="60" />
			<span class="from">made from {base.name}</span>
			<button
				class="changes"
				aria-expanded={showChanges}
				onclick={() => (showChanges = !showChanges)}
				>{changes.length
					? `What changed from ${base.name} (${changes.length})`
					: `Same as ${base.name}`}</button
			>
			<span class="grow"></span>
			<label class="pick"
				>Preview
				<select bind:value={shownAs}>
					<option value="room">A room</option>
					<option value="home">Home</option>
					<option value="display">A display at rest</option>
				</select>
			</label>
			{#if shownAs === 'room'}
				<select
					aria-label="Which room"
					value={room}
					onchange={(e) => (picked = e.currentTarget.value)}
				>
					{#each roomsBySize as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
				</select>
			{/if}
			<button class="primary" disabled={saving} onclick={keep}>Save</button>
		</div>

		{#if showChanges}
			<div class="changed">
				<b>What changed from {base.name}</b>
				{#each changes as c (c)}<span>· {c}</span>{/each}
				{#if !changes.length}<span class="quiet">Nothing yet. It draws as {base.name} does.</span
					>{/if}
				<button class="plain" onclick={backToBase}>Back to {base.name}’s</button>
			</div>
		{/if}
		{#if said}<p class="said" role="status">{said}</p>{/if}
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}

		<div class="split">
			<div class="choices">
				<div class="tabs" role="tablist" aria-label="Choices">
					{#each TABS as [id, label] (id)}
						<button role="tab" aria-selected={tab === id} onclick={() => (tab = id)}>{label}</button
						>
					{/each}
				</div>

				<div class="panel" role="tabpanel">
					{#if tab === 'drawings'}
						<p class="quiet">
							How each kind of thing is drawn, shown with one of the house's own. A card given its
							own drawing on a page keeps it.
						</p>
						{#each FAMILIES as f (f)}
							{@const sample = samples[f][0]}
							<div class="family">
								<span class="label">{FAMILY_NAMES[f]}</span>
								{#if sample}
									<div class="options">
										{#each optionsFor(f) as o (o.id)}
											<div class="option-wrap">
												<button
													class="option"
													aria-pressed={drawingOf(draft, f) === o.id}
													onclick={() => choose(f, o.id)}
												>
													<DrawingSample
														look={withDrawing(f, o.id)}
														card={sample}
														layout={layoutFor(f)}
													/>
													<span>{o.name}</span>
												</button>
												{#if o.made}
													{@const made = o.made}
													<span class="made-tools">
														<button
															class="plain small"
															onclick={() =>
																(making = structuredClone($state.snapshot(made) as MadeDrawing))}
															>Change</button
														>
														<button class="plain small" onclick={() => dropDrawing(made)}
															>Remove</button
														>
													</span>
												{/if}
											</div>
										{/each}
									</div>
									{@const offered = offeredOptions(drawingOf(draft, f))}
									{#if offered.length}
										<div class="drawing-options">
											{#each offered as o (o.id)}
												<label
													><input
														type="checkbox"
														id={`opt-${f}-${o.id}`}
														checked={optionValues(draft, drawingOf(draft, f))[o.id]}
														onchange={(e) =>
															(draft = withOption(
																draft,
																drawingOf(draft, f),
																o.id,
																e.currentTarget.checked
															))}
													/>
													{o.label}</label
												>
											{/each}
										</div>
									{/if}
									{#if MAKEABLE.includes(f)}
										<button class="make" onclick={() => makeFor(f)}>Make a drawing…</button>
									{/if}
								{:else}
									<span class="quiet">The house has none of these yet.</span>
								{/if}
							</div>
						{/each}
					{:else if tab === 'feel'}
						<fieldset>
							<legend>Spacing</legend>
							<div class="seg">
								{#each DENSITY as [id, name] (id)}
									<button
										aria-pressed={draft.feel.density === id}
										onclick={() => (draft.feel.density = id)}>{name}</button
									>
								{/each}
							</div>
						</fieldset>
						<fieldset>
							<legend>Corners</legend>
							<div class="seg">
								{#each CORNERS as [id, name] (id)}
									<button
										aria-pressed={draft.feel.corners === id}
										onclick={() => (draft.feel.corners = id)}>{name}</button
									>
								{/each}
							</div>
						</fieldset>
						<label class="range"
							><span>Type size <b>{Math.round(draft.feel.type * 100)}%</b></span>
							<input type="range" min="0.9" max="1.15" step="0.05" bind:value={draft.feel.type} />
						</label>
						<fieldset>
							<legend>Motion</legend>
							<div class="seg">
								{#each MOTION as [id, name] (id)}
									<button
										aria-pressed={draft.feel.motion === id}
										onclick={() => (draft.feel.motion = id)}>{name}</button
									>
								{/each}
							</div>
						</fieldset>
						<p class="quiet">Reduced motion on a device always wins over the look.</p>
					{:else if tab === 'colors'}
						<fieldset>
							<legend>A theme of its own</legend>
							<div class="seg wrap">
								<button
									aria-pressed={draft.theme === undefined}
									onclick={() => (draft.theme = undefined)}>None</button
								>
								{#each PALETTES as p (p.id)}
									<button aria-pressed={draft.theme === p.id} onclick={() => (draft.theme = p.id)}
										><span class="swatch" style:background={p.swatch}></span>{p.name}</button
									>
								{/each}
							</div>
						</fieldset>
						<p class="quiet">
							Used where neither the person nor the house chose a theme. It shows here as you pick.
						</p>
						<label class="check"
							><input type="checkbox" bind:checked={draft.ownColors} /> Lights in their own colors
						</label>
						<p class="quiet">
							A colored bulb shows its color in its card and the room's glow. Off, everything that's
							on is the theme's color.
						</p>
					{:else if tab === 'frame'}
						<fieldset>
							<legend>A room's header</legend>
							<div class="seg">
								<button
									aria-pressed={draft.frame.header === 'glow'}
									onclick={() => (draft.frame.header = 'glow')}>Glowing, with its name</button
								>
								<button
									aria-pressed={draft.frame.header === 'plain'}
									onclick={() => (draft.frame.header = 'plain')}>Plain title</button
								>
								{#each headers as h (h.id)}
									<button
										aria-pressed={draft.frame.header === h.id}
										onclick={() => (draft.frame.header = h.id as PluginRef)}>{fromPlugin(h)}</button
									>
								{/each}
							</div>
						</fieldset>
						<label class="check"
							><input type="checkbox" bind:checked={draft.frame.chips} /> Status chips in the header</label
						>
						<label class="check"
							><input type="checkbox" bind:checked={draft.frame.needs} /> What needs someone, first</label
						>
						<label class="check"
							><input type="checkbox" bind:checked={draft.frame.more} /> Fold what's rarely used under
							"More"</label
						>
						<label class="check"
							><input type="checkbox" bind:checked={draft.frame.sheet} /> Open a room over Home, rather
							than as its page</label
						>
						{#if !draft.grouping.room}
							<p class="quiet">
								These are for rooms grouped by sections of the look's own (the Rooms tab).
							</p>
						{/if}
					{:else if tab === 'rooms'}
						{#if !draft.grouping.room}
							<p class="quiet">
								Rooms are grouped as Classic groups them: things to use, scenes, readings, the rest.
							</p>
							<button
								class="make"
								onclick={() =>
									setRules(structuredClone($state.snapshot(LIT.grouping.room!)) as Rule[])}
								>Group rooms by sections of this look's own</button
							>
						{:else}
							<p class="quiet">
								Each section takes what it names, and a thing goes to the first that takes it. What
								none takes goes to "Also here". This is every room; arranging one room stays with
								that room.
							</p>
							<div class="list" use:reorder={{ move: (a, b) => setRules(moved(rules, a, b)) }}>
								{#each rules as r, i (r.id)}
									<div class="rule" data-item>
										<div class="rule-top">
											<span class="grip" data-grip aria-hidden="true" title="Drag to reorder"
												>⋮⋮</span
											>
											<input
												aria-label="Section name"
												value={r.title}
												oninput={(e) => editRule(i, { title: e.currentTarget.value })}
											/>
											<button
												class="icon"
												aria-label="Earlier"
												disabled={i === 0}
												onclick={() => moveRule(i, -1)}>↑</button
											>
											<button
												class="icon"
												aria-label="Later"
												disabled={i === rules.length - 1}
												onclick={() => moveRule(i, 1)}>↓</button
											>
											<button
												class="icon"
												aria-label={`Remove ${r.title}`}
												onclick={() => setRules(rules.filter((_, k) => k !== i))}>✕</button
											>
										</div>
										<div class="takes">
											<span class="quiet">Takes</span>
											{#each r.takes as t (t)}
												<span class="take"
													>{TAKES[t]}<button
														aria-label={`Stop taking ${TAKES[t]}`}
														onclick={() => editRule(i, { takes: r.takes.filter((x) => x !== t) })}
														>×</button
													></span
												>
											{/each}
											{#if untaken.length}
												<select
													aria-label="Also takes"
													value=""
													onchange={(e) => {
														const t = e.currentTarget.value as Take;
														if (t) editRule(i, { takes: [...r.takes, t] });
														e.currentTarget.value = '';
													}}
												>
													<option value="">+ also…</option>
													{#each untaken as t (t)}<option value={t}>{TAKES[t]}</option>{/each}
												</select>
											{/if}
										</div>
										<div class="takes">
											<select
												aria-label="Layout"
												value={r.layout}
												onchange={(e) => editRule(i, { layout: e.currentTarget.value as Layout })}
											>
												{#each Object.entries(LAYOUT_NAMES) as [id, name] (id)}<option value={id}
														>{name}</option
													>{/each}
											</select>
											<select
												aria-label="Where"
												value={r.place}
												onchange={(e) => editRule(i, { place: e.currentTarget.value as Place })}
											>
												{#each PLACES as [id, name] (id)}<option value={id}>{name}</option>{/each}
											</select>
											<label class="check small"
												><input
													type="checkbox"
													checked={!r.headless}
													onchange={(e) => editRule(i, { headless: !e.currentTarget.checked })}
												/> Heading</label
											>
											<!-- 13 §13.2: its devices and scenes start in one stack, from this many. -->
											<label class="check small"
												><input
													type="checkbox"
													checked={r.stack !== undefined}
													onchange={(e) =>
														editRule(i, { stack: e.currentTarget.checked ? 5 : undefined })}
												/> In a stack from</label
											>
											{#if r.stack !== undefined}
												<input
													class="count"
													type="number"
													min="2"
													max="50"
													aria-label={`${r.title}: in a stack from this many things`}
													value={r.stack}
													onchange={(e) =>
														editRule(i, {
															stack: Math.min(50, Math.max(2, Number(e.currentTarget.value) || 5))
														})}
												/>
												<span class="quiet">things</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
							<div class="row">
								{#if untaken.length}
									<select
										class="make"
										value=""
										onchange={(e) => {
											const t = e.currentTarget.value as Take;
											if (t) addRule(t);
											e.currentTarget.value = '';
										}}
									>
										<option value="">+ Add a section that takes…</option>
										{#each untaken as t (t)}<option value={t}>{TAKES[t]}</option>{/each}
									</select>
								{/if}
								<button
									class="plain"
									onclick={() => (draft.grouping = { ...draft.grouping, room: undefined })}
									>Back to Classic's sections</button
								>
							</div>
						{/if}
					{:else if tab === 'home'}
						<p class="quiet">
							The order Home's sections start in, and its layout. Anyone can still arrange their own
							Home.
						</p>
						<div
							class="list"
							use:reorder={{
								move: (a, b) =>
									setHome({
										order: moved(
											homeRows.map((x) => x.id),
											a,
											b
										)
									})
							}}
						>
							{#each homeRows as s, i (s.id)}
								<div class="home-row" data-item class:off={home.hidden.includes(s.id)}>
									<span class="grip" data-grip aria-hidden="true" title="Drag to reorder">⋮⋮</span>
									<span class="grow">{s.title}</span>
									<button
										class="plain small"
										onclick={() =>
											setHome({
												hidden: home.hidden.includes(s.id)
													? home.hidden.filter((x) => x !== s.id)
													: [...home.hidden, s.id]
											})}>{home.hidden.includes(s.id) ? 'Starts hidden' : 'Shown'}</button
									>
									<button
										class="icon"
										aria-label="Earlier"
										disabled={i === 0}
										onclick={() => moveHome(i, -1)}>↑</button
									>
									<button
										class="icon"
										aria-label="Later"
										disabled={i === homeRows.length - 1}
										onclick={() => moveHome(i, 1)}>↓</button
									>
								</div>
							{/each}
						</div>
						<fieldset>
							<legend>Home layout</legend>
							<div class="seg wrap">
								{#each STYLES.filter((s) => s.id !== 'side') as s (s.id)}
									<button
										aria-pressed={home.layout === s.id}
										onclick={() => setHome({ layout: s.id as 'list' | 'field' | 'tiles' })}
										>{s.name}</button
									>
								{/each}
							</div>
						</fieldset>
						{#if draft.grouping.home}
							<button
								class="plain"
								onclick={() => (draft.grouping = { ...draft.grouping, home: undefined })}
								>As Home comes</button
							>
						{/if}
					{:else if tab === 'displays'}
						<label class="check"
							><input type="checkbox" bind:checked={draft.frame.rest.on} /> Settle into a rest view when
							untouched</label
						>
						<label class="pick" class:off={!draft.frame.rest.on}
							>After
							<select bind:value={draft.frame.rest.after} disabled={!draft.frame.rest.on}>
								<option value={30}>30 seconds</option>
								<option value={60}>a minute</option>
								<option value={120}>2 minutes</option>
								<option value={300}>5 minutes</option>
								<option value={600}>10 minutes</option>
							</select>
						</label>
						{#if rests.length}
							<label class="pick" class:off={!draft.frame.rest.on}
								>Rest view
								<select
									value={draft.frame.rest.piece ?? ''}
									disabled={!draft.frame.rest.on}
									onchange={(e) => {
										const v = e.currentTarget.value;
										const { piece: _drop, ...rest } = draft.frame.rest;
										draft.frame.rest = v ? { ...rest, piece: v as PluginRef } : rest;
									}}
								>
									<option value="">Lit's: the time, the weather, what's on</option>
									{#each rests as r (r.id)}<option value={r.id}>{fromPlugin(r)}</option>{/each}
								</select>
							</label>
						{/if}
						<p class="quiet">
							A display's own night and awake settings stay on Settings › Displays.
						</p>
					{:else}
						<div class="seg column">
							<button
								aria-pressed={draft.reaches === 'household'}
								onclick={() => (draft.reaches = 'household')}
								><b>Household pages and displays</b><small
									>Rooms, Home, the house's pages and displays. Settings keep homeCore's own look.</small
								></button
							>
							<button
								aria-pressed={draft.reaches === 'everywhere'}
								onclick={() => (draft.reaches = 'everywhere')}
								><b>Every screen, settings too</b><small
									>Its feel and theme reach Settings, Me and the admin screens as well.</small
								></button
							>
						</div>
					{/if}
				</div>
			</div>

			<div class="preview-side">
				<span class="label">Live preview · this house's own devices</span>
				<LookPreview {draft} show={shownAs} {room} />
			</div>
		</div>
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.name {
		width: 180px;
		font-weight: 700;
	}
	.from {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.changes {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--lit-card-line);
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
		font-weight: 600;
	}
	.grow {
		flex: 1;
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.off {
		opacity: 0.5;
	}
	.changed {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 16px;
		border-radius: 14px;
		border: 1px dashed var(--lit-card-line);
		font-size: 14px;
	}
	.changed button {
		align-self: flex-start;
		margin-top: 6px;
	}
	.said,
	.trouble {
		margin: 0;
		font-size: 14px;
	}
	.said {
		color: var(--ink-muted);
	}
	.trouble {
		color: var(--alert);
	}
	.split {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: flex-start;
	}
	.choices {
		flex: 1 1 360px;
		max-width: 480px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.preview-side {
		flex: 999 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.tabs button,
	.seg button {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.tabs button[aria-selected='true'],
	.seg button[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.drawing-options {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		font-size: 13px;
	}
	.drawing-options label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.family {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.option-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.option {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		border-radius: 14px;
		border: 2px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		text-align: left;
		font-size: 13px;
		min-width: 0;
		overflow: hidden;
	}
	.option[aria-pressed='true'] {
		border-color: var(--accent);
	}
	.made-tools {
		display: flex;
		gap: 6px;
	}
	.make {
		align-self: flex-start;
		padding: 8px 14px;
		border-radius: 10px;
		border: 1px dashed var(--lit-card-line);
		background: var(--surface);
		color: var(--lit-ink);
		font-size: 13px;
		font-weight: 600;
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	legend {
		font-size: 14px;
		margin-bottom: 6px;
	}
	.seg {
		display: flex;
		gap: 6px;
	}
	.seg.wrap {
		flex-wrap: wrap;
	}
	.seg.column {
		flex-direction: column;
	}
	.seg.column button {
		display: flex;
		flex-direction: column;
		gap: 3px;
		align-items: flex-start;
		border-radius: 12px;
		padding: 12px;
		text-align: left;
	}
	.seg.column small {
		font-weight: 400;
		color: var(--ink-muted);
	}
	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: 6px;
		border-radius: 999px;
		vertical-align: -1px;
	}
	.range {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
	}
	.range input {
		accent-color: var(--accent);
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 14px;
	}
	.check.small {
		font-size: 12.5px;
	}
	.count {
		width: 64px;
		min-height: 36px;
	}
	.rule {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--bg);
	}
	.rule-top {
		display: flex;
		gap: 6px;
	}
	.rule-top input {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}
	.takes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		font-size: 12.5px;
	}
	.take {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px 2px 10px;
		border-radius: 999px;
		background: var(--surface-2);
	}
	.take button {
		border: none;
		background: transparent;
		color: var(--ink-muted);
	}
	.icon {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-muted);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.grip {
		align-self: center;
		padding: 4px 2px;
		color: var(--ink-muted);
		letter-spacing: -2px;
		font-weight: 700;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}
	:global(.lifted) {
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
		outline: 1px solid var(--accent);
	}
	.home-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		font-size: 14px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.small {
		font-size: 12px;
	}

	/* On a phone, the preview is above, and the choices scroll under it (13 §11). */
	@media (max-width: 899px) {
		.preview-side {
			order: -1;
			position: sticky;
			top: var(--header-h, 64px);
			z-index: 2;
			max-height: 42dvh;
			overflow: auto;
			padding-bottom: 6px;
			background: var(--bg);
		}
		.choices {
			max-width: none;
		}
	}
</style>
