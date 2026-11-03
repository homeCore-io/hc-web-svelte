<!--
	Making a scene (A1): choose devices by room, set each to how it should
	be — or take how they are now — try it, and save. Running it sets each
	device listed; anything not listed is left alone.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { scenes } from '#lib/scenes.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { kindLabel } from '#lib/inventory.js';
	import { kindOf } from '#lib/card.js';
	import {
		asSettings,
		asSteps,
		describeState,
		differ,
		isSteps,
		othersIn,
		sceneable,
		settingsOf,
		shownSettings,
		stateNow,
		stepsOf,
		valueText
	} from '#lib/sceneEdit.js';
	import { commandsOf } from '#lib/ruleEdit.js';
	import { fromShown, shownRange, toShown } from '#lib/units.js';
	import StateEdit from '#lib/components/rules/StateEdit.svelte';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { deviceCall } from '#lib/deviceAdmin.js';

	const id = $derived(page.params.id ?? 'new');
	const isNew = $derived(id === 'new');
	const scene = $derived(isNew ? undefined : scenes.list.find((s) => s.id === id));

	let name = $state('');
	let states = $state<Record<string, Record<string, unknown>>>({});
	let loadedFor = $state<string | null>(null);
	// Load the scene once it's known; don't overwrite edits when it changes.
	$effect(() => {
		const key = isNew ? 'new' : scene?.id;
		if (key === undefined || key === loadedFor) return;
		untrack(() => {
			name = scene?.name ?? '';
			states = $state.snapshot((scene?.states ?? {}) as Record<string, Record<string, unknown>>);
			loadedFor = key;
		});
	});
	const title = $derived(isNew ? 'New scene' : (scene?.name ?? 'Scene'));
	$effect(() => heading.show(title, { href: '/settings/scenes', label: 'Scenes' }));

	// ---- the devices to choose from, by room ----
	let query = $state('');
	const candidates = $derived(
		Object.values(devices.byId)
			.filter(sceneable)
			.map((d) => ({ d, room: roomOf(d, rooms.list), name: displayName(d) }))
	);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const hits = candidates.filter(
			(c) => q === '' || `${c.name} ${c.room?.name ?? ''} ${kindOf(c.d)}`.toLowerCase().includes(q)
		);
		const by = new Map<string, typeof hits>();
		for (const c of hits) {
			const k = c.room?.name ?? 'No room';
			by.set(k, [...(by.get(k) ?? []), c]);
		}
		return [...by]
			.map(([room, list]) => ({ room, list: list.sort((a, b) => a.name.localeCompare(b.name)) }))
			.sort((a, b) =>
				a.room === 'No room' ? 1 : b.room === 'No room' ? -1 : a.room.localeCompare(b.room)
			);
	});
	const chosen = $derived(
		Object.keys(states)
			.map((did) => ({ id: did, d: devices.byId[did] }))
			.sort((a, b) => (a.d ? displayName(a.d) : a.id).localeCompare(b.d ? displayName(b.d) : b.id))
	);

	function toggle(d: CoreDevice) {
		const next = { ...states };
		if (next[d.device_id]) delete next[d.device_id];
		else next[d.device_id] = stateNow(d);
		states = next;
	}
	const put = (did: string, attr: string, value: unknown) => {
		const cur = { ...states[did], [attr]: value };
		// Setting anything but power turns it on; off drops the rest.
		if (attr !== 'on' && 'on' in cur) cur.on = true;
		if (attr === 'on' && value === false)
			for (const k of Object.keys(cur)) if (k !== 'on') delete cur[k];
		states = { ...states, [did]: cur };
	};
	/** Leave a setting as the device has it: the scene stops setting it. */
	function drop(did: string, attr: string) {
		const { [attr]: _, ...rest } = states[did] ?? {};
		states = { ...states, [did]: rest };
	}

	// Devices showing all their settings, not just the first few.
	let more = $state<Record<string, boolean>>({});

	// ---- an entry as steps, sent one after another ----
	const setSteps = (did: string, steps: unknown[]) =>
		(states = { ...states, [did]: { actions: steps } });
	function useSteps(c: { id: string; d?: CoreDevice }, on: boolean) {
		const st = states[c.id] ?? {};
		if (on === isSteps(st)) return;
		states = {
			...states,
			[c.id]: on ? asSteps(st) : c.d ? asSettings(st, c.d) : {}
		};
	}
	function moveStep(did: string, i: number, by: number) {
		const steps = [...stepsOf(states[did] ?? {})];
		const [s] = steps.splice(i, 1);
		steps.splice(i + by, 0, s);
		setSteps(did, steps);
	}

	function takeNow() {
		const next: typeof states = {};
		for (const did of Object.keys(states)) {
			const d = devices.byId[did];
			// Steps are what to do, not how it is: they stay.
			next[did] = d && !isSteps(states[did]!) ? stateNow(d) : states[did]!;
		}
		states = next;
	}

	// ---- try, save, delete ----
	let note = $state<string | null>(null);
	let busy = $state(false);
	async function tryIt() {
		busy = true;
		note = null;
		// As homeCore runs it: an entry's steps one after another.
		send: for (const [did, st] of Object.entries(states))
			for (const cmd of isSteps(st) ? stepsOf(st) : [st]) {
				const err = await deviceCall('PATCH', `/devices/${encodeURIComponent(did)}/state`, cmd);
				if (err) {
					note = err;
					break send;
				}
			}
		busy = false;
		note ??= 'Sent to each device.';
	}
	const dirty = $derived(
		isNew
			? name.trim() !== '' || chosen.length > 0
			: !!scene && (name.trim() !== scene.name || differ(states, scene.states ?? {}))
	);
	async function save() {
		busy = true;
		const body = { name: name.trim(), states: $state.snapshot(states) };
		if (isNew) {
			const res = await fetch('/api/v1/scenes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			}).catch(() => null);
			busy = false;
			if (!res?.ok) return void (note = 'homeCore didn’t save it.');
			const made = (await res.json()) as { id: string };
			loadedFor = made.id;
			void goto(`/settings/scenes/${encodeURIComponent(made.id)}`, { replace: true });
			note = 'Saved.';
			return;
		}
		note = (await deviceCall('PUT', `/scenes/${encodeURIComponent(id)}`, body)) ?? 'Saved.';
		busy = false;
	}
	async function remove() {
		if (!scene) return;
		const yes = await ask({
			title: `Delete ${scene.name}?`,
			body: 'Rules that run it will fail to.',
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const err = await deviceCall('DELETE', `/scenes/${encodeURIComponent(id)}`);
		if (err) return void (note = err);
		void goto('/settings/scenes');
	}
</script>

{#if !session.can('scenes:write')}
	<p class="quiet">Scenes are for people who may change the house.</p>
{:else if !isNew && !scene && loadedFor === null}
	<p class="quiet">{scenes.list.length ? 'There is no such scene.' : 'Loading…'}</p>
{:else}
	<div class="top">
		<input class="name" bind:value={name} placeholder="Movie night" aria-label="Scene name" />
		<button type="button" class="ghost" disabled={chosen.length === 0} onclick={takeNow}
			>Set to how they are now</button
		>
		<button type="button" class="ghost" disabled={chosen.length === 0 || busy} onclick={tryIt}
			>Try it</button
		>
		<button
			type="button"
			class="go"
			disabled={!dirty || name.trim() === '' || chosen.length === 0 || busy}
			onclick={save}>Save scene</button
		>
	</div>
	{#if note}<p class="note" role="status">{note}</p>{/if}

	<div class="cols">
		<section class="pool" aria-label="Add devices">
			<label class="search">
				<Search size={16} aria-hidden="true" />
				<input
					type="search"
					bind:value={query}
					placeholder="Add a device"
					aria-label="Find a device to add"
				/>
			</label>
			{#each shown as g (g.room)}
				<h2>{g.room}</h2>
				{#each g.list as c (c.d.device_id)}
					<label class="pick">
						<input type="checkbox" checked={!!states[c.d.device_id]} onchange={() => toggle(c.d)} />
						<span class="pname">{c.name}</span>
						<span class="kind">{kindLabel(kindOf(c.d))}</span>
					</label>
				{/each}
			{/each}
		</section>

		<section class="sets" aria-label="What the scene sets">
			<p class="quiet">Running it sets each device below; anything not listed is left alone.</p>
			{#if chosen.length === 0}
				<p class="empty">Choose devices on the left.</p>
			{/if}
			{#each chosen as c (c.id)}
				{@const st = states[c.id] ?? {}}
				{@const all = c.d ? settingsOf(c.d, Infinity) : []}
				{@const settings = shownSettings(all, st, !!more[c.id])}
				{@const others = othersIn(st, all)}
				{@const steps = isSteps(st)}
				<div class="dev">
					<div class="dhead">
						<span class="dname">
							<strong>{c.d ? displayName(c.d) : c.id}</strong>
							{#if c.d}<span class="now">now {describeState(stateNow(c.d), all)}</span>{/if}
						</span>
						<button
							type="button"
							class="x"
							aria-label={`Take ${c.d ? displayName(c.d) : c.id} out of the scene`}
							onclick={() => c.d && toggle(c.d)}><X size={16} /></button
						>
					</div>
					{#if c.d && commandsOf(c.d).length}
						<div
							class="seg how"
							role="radiogroup"
							aria-label={`How the scene sets ${displayName(c.d)}`}
						>
							<button
								type="button"
								role="radio"
								aria-checked={!steps}
								onclick={() => useSteps(c, false)}>Set it</button
							>
							<button
								type="button"
								role="radio"
								aria-checked={steps}
								onclick={() => useSteps(c, true)}>Steps, in order</button
							>
						</div>
					{/if}
					{#if !c.d}
						<p class="quiet">This device is gone from homeCore.</p>
					{:else if steps}
						{@const list = stepsOf(st)}
						<p class="quiet">
							Each is sent when the one before has gone — for a speaker to join a group before it
							plays, say.
						</p>
						<ol class="steps">
							{#each list as step, i (i)}
								<li>
									<div class="step">
										<StateEdit
											deviceId={c.id}
											device={c.d}
											value={step}
											label={`Step ${i + 1}`}
											onchange={(v) =>
												setSteps(
													c.id,
													list.map((x, j) => (j === i ? v : x))
												)}
										/>
									</div>
									<div class="order">
										<button
											type="button"
											class="x"
											aria-label={`Move step ${i + 1} up`}
											disabled={i === 0}
											onclick={() => moveStep(c.id, i, -1)}><ChevronUp size={16} /></button
										>
										<button
											type="button"
											class="x"
											aria-label={`Move step ${i + 1} down`}
											disabled={i === list.length - 1}
											onclick={() => moveStep(c.id, i, 1)}><ChevronDown size={16} /></button
										>
										<button
											type="button"
											class="x"
											aria-label={`Remove step ${i + 1}`}
											onclick={() =>
												setSteps(
													c.id,
													list.filter((_, j) => j !== i)
												)}><X size={16} /></button
										>
									</div>
								</li>
							{/each}
						</ol>
						{#if list.length === 0}<p class="empty">No steps yet: it does nothing.</p>{/if}
						<button
							type="button"
							class="ghost add"
							onclick={() => setSteps(c.id, [...list, undefined])}>+ Add a step</button
						>
					{:else}
						<div class="controls">
							{#each settings as s (s.attr)}
								{#if s.kind === 'bool'}
									{#if s.attr !== 'on'}<span class="blabel">{s.label}</span>{/if}
									<div class="seg" role="radiogroup" aria-label={s.label}>
										<button
											type="button"
											role="radio"
											aria-checked={st[s.attr] === true}
											onclick={() => put(c.id, s.attr, true)}>On</button
										>
										<button
											type="button"
											role="radio"
											aria-checked={st[s.attr] === false}
											onclick={() => put(c.id, s.attr, false)}>Off</button
										>
									</div>
								{:else if s.kind === 'range'}
									<!-- In the person's units, kept in the schema's: 70 °F set as 21.111 °C. -->
									{@const r = shownRange(s, s.unit)}
									<label class="range">
										<span>{s.label}</span>
										<input
											type="range"
											min={r.min}
											max={r.max}
											step={r.step}
											value={toShown(Number(st[s.attr] ?? c.d.attributes[s.attr] ?? s.max), s.unit)}
											disabled={st.on === false}
											oninput={(e) =>
												put(c.id, s.attr, fromShown(Number(e.currentTarget.value), s.unit))}
										/>
										<span class="val"
											>{st.on === false || st[s.attr] === undefined
												? '—'
												: valueText(s, st[s.attr])}</span
										>
									</label>
									{#if st[s.attr] !== undefined && st.on !== false}
										<button
											type="button"
											class="link leave"
											aria-label={`Leave ${s.label} as it is`}
											onclick={() => drop(c.id, s.attr)}>Leave</button
										>
									{/if}
								{:else if s.kind === 'enum'}
									<label class="range">
										<span>{s.label}</span>
										<select
											value={String(st[s.attr] ?? '')}
											disabled={st.on === false}
											onchange={(e) =>
												e.currentTarget.value === ''
													? drop(c.id, s.attr)
													: put(c.id, s.attr, e.currentTarget.value)}
										>
											<option value="">Leave as it is</option>
											{#each s.options ?? [] as o (o.value)}<option value={o.value}
													>{o.label}</option
												>{/each}
										</select>
									</label>
								{/if}
							{/each}
						</div>
						{#each others as [attr, v] (attr)}
							<p class="other">
								Also sets <code>{attr}</code> to <code>{JSON.stringify(v)}</code>
								<button type="button" class="link" onclick={() => drop(c.id, attr)}
									>Stop setting it</button
								>
							</p>
						{/each}
						{#if all.length > settings.length || more[c.id]}
							<button
								type="button"
								class="link"
								aria-expanded={!!more[c.id]}
								onclick={() => (more = { ...more, [c.id]: !more[c.id] })}
								>{more[c.id]
									? 'Fewer settings'
									: `More settings (${all.length - settings.length})`}</button
							>
						{/if}
					{/if}
				</div>
			{/each}
			{#if scene}
				<div class="foot">
					<button type="button" class="danger" onclick={remove}>Delete…</button>
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.name {
		flex: 1 1 240px;
		min-width: 0;
		height: 46px;
		padding: 0 12px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 20px;
		font-weight: 700;
	}
	.ghost,
	.go,
	.danger {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		font: inherit;
		font-weight: 700;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.danger {
		border-color: var(--alert-line);
		background: none;
		color: var(--alert);
	}
	button:disabled {
		opacity: 0.5;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	@media (min-width: 900px) {
		.cols {
			grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
		}
		.pool {
			position: sticky;
			top: 84px;
			max-height: calc(100dvh - 120px);
			overflow: auto;
		}
	}
	.pool,
	.sets {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.sets {
		gap: var(--space-2);
	}
	.search {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 10px;
		margin-bottom: 6px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--bg);
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
	h2 {
		margin: var(--space-2) 0 2px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 34px;
		font-size: 14px;
	}
	.pname {
		flex: 1;
		min-width: 0;
	}
	.kind,
	.now,
	.quiet {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
	}
	.empty {
		margin: 0;
		padding: var(--space-4);
		border-radius: 12px;
		border: 1px dashed var(--line);
		color: var(--ink-muted);
	}
	.dev {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: 12px;
		border: 1px solid var(--line);
	}
	.dhead {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.dname {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.x {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 16px;
		border: none;
		background: none;
		color: var(--ink-muted);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}
	.seg {
		display: inline-flex;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.seg button {
		height: 32px;
		padding: 0 14px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.range {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1 1 240px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.range input {
		flex: 1;
		accent-color: var(--accent);
	}
	.val {
		min-width: 52px;
		text-align: right;
		font-family: var(--font-num);
		color: var(--ink);
	}
	select {
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.blabel {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.leave {
		align-self: center;
	}
	.how {
		align-self: flex-start;
	}
	.other {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.steps {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.steps li {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: 10px;
		background: var(--surface-2);
	}
	.step {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		min-width: 0;
	}
	.order {
		display: flex;
	}
	.x:disabled {
		opacity: 0.35;
	}
	.add {
		align-self: flex-start;
	}
	.foot {
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}
	.note {
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
</style>
