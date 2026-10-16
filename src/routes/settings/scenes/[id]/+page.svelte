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
	import { describeState, differ, sceneable, settingsOf, stateNow } from '#lib/sceneEdit.js';
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
	function takeNow() {
		const next: typeof states = {};
		for (const did of Object.keys(states)) {
			const d = devices.byId[did];
			next[did] = d ? stateNow(d) : states[did]!;
		}
		states = next;
	}

	// ---- try, save, delete ----
	let note = $state<string | null>(null);
	let busy = $state(false);
	async function tryIt() {
		busy = true;
		note = null;
		for (const [did, st] of Object.entries(states)) {
			if ('actions' in st) continue;
			const err = await deviceCall('PATCH', `/devices/${encodeURIComponent(did)}/state`, st);
			if (err) {
				note = err;
				break;
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
				{@const settings = c.d ? settingsOf(c.d) : []}
				<div class="dev">
					<div class="dhead">
						<span class="dname">
							<strong>{c.d ? displayName(c.d) : c.id}</strong>
							{#if c.d}<span class="now"
									>now {describeState(stateNow(c.d, settings), settings)}</span
								>{/if}
						</span>
						<button
							type="button"
							class="x"
							aria-label={`Take ${c.d ? displayName(c.d) : c.id} out of the scene`}
							onclick={() => c.d && toggle(c.d)}><X size={16} /></button
						>
					</div>
					{#if !c.d}
						<p class="quiet">This device is gone from homeCore.</p>
					{:else if 'actions' in st}
						<p class="quiet">Set by its own steps, which this editor doesn’t show yet.</p>
					{:else}
						<div class="controls">
							{#each settings as s (s.attr)}
								{#if s.kind === 'bool'}
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
									<label class="range">
										<span>{s.label}</span>
										<input
											type="range"
											min={s.min}
											max={s.max}
											step={s.step}
											value={Number(st[s.attr] ?? c.d.attributes[s.attr] ?? s.max)}
											disabled={st.on === false}
											oninput={(e) => put(c.id, s.attr, Number(e.currentTarget.value))}
										/>
										<span class="val"
											>{st.on === false || st[s.attr] === undefined
												? '—'
												: `${st[s.attr]}${s.unit ? ` ${s.unit}` : ''}`}</span
										>
									</label>
								{:else if s.kind === 'enum'}
									<label class="range">
										<span>{s.label}</span>
										<select
											value={String(st[s.attr] ?? '')}
											disabled={st.on === false}
											onchange={(e) => put(c.id, s.attr, e.currentTarget.value)}
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
					{/if}
				</div>
			{/each}
			{#if scene}
				<div class="foot">
					<button type="button" class="danger" onclick={remove}>Delete scene…</button>
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
