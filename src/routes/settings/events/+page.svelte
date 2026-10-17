<!--
	Events (A6): everything the house reports, newest first, in words — a
	device changed and who changed it, a rule ran, a command went out, a
	timer started. Readings that change all the time fold into one line each,
	and a device that keeps re-declaring its controls says so once.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { eventRow, folded, onlyNoise, type EventHouse, type EventRow } from '#lib/system.js';
	import { loadEvents } from '#lib/systemAdmin.js';

	$effect(() => heading.show('Events', { href: '/settings/system', label: 'System' }));

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	const KEEP = 1500;
	let events = $state<Json[]>([]);
	let failed = $state<string | null>(null);
	let noise = $state(false);
	let room = $state('');
	let kind = $state('');
	const KINDS = [
		{ id: '', label: 'everything' },
		{ id: 'device', label: 'devices' },
		{ id: 'rule', label: 'rules' },
		{ id: 'command', label: 'commands' },
		{ id: 'scene', label: 'scenes' },
		{ id: 'warn', label: 'worth a look' }
	];
	let paused = $state(false);
	let held = $state<Json[]>([]);

	onMount(() => {
		void loadEvents(500).then((r) => {
			if (!r.ok) return void (failed = r.error);
			// Live frames may have arrived first; keep both, newest first.
			events = [...events, ...r.data.map((x) => x.event)].slice(0, KEEP);
		});
		return live.listen((f) => {
			const e = f as Json;
			if (!e?.type || e.type === 'snapshot' || e.type === 'plugin_heartbeat') return;
			if (paused) held = [e, ...held].slice(0, KEEP);
			else events = [e, ...events].slice(0, KEEP);
		});
	});
	function resume() {
		events = [...held, ...events].slice(0, KEEP);
		held = [];
		paused = false;
	}

	const house: EventHouse = {
		name: (id) => {
			const d = devices.byId[id];
			return d ? displayName(d) : undefined;
		},
		schema: (id) => devices.byId[id]?.schema ?? undefined,
		room: (id) => rooms.list.find((r) => r.deviceIds.includes(id))?.name
	};

	const rows = $derived.by((): EventRow[] => {
		const out: EventRow[] = [];
		const noisy = new Set<EventRow>();
		for (const e of events) {
			const r = eventRow(e, house);
			if (!r || (room && r.room !== room) || (kind && r.kind !== kind)) continue;
			if (onlyNoise(e)) {
				if (!noise) noisy.add(r);
			}
			out.push(r);
		}
		return folded(out, (r) => noisy.has(r)).slice(0, 400);
	});
	const roomNames = $derived(rooms.list.map((r) => r.name).sort());
	const at = (ts: string) =>
		new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	const MARK: Record<string, string> = {
		device: 'D',
		rule: 'R',
		command: '→',
		timer: 'T',
		scene: 'S',
		system: '•',
		warn: '!'
	};
</script>

{#if !session.isAdmin}
	<p class="quiet">Events are for the house’s admins.</p>
{:else}
	<div class="page">
		<div class="tools">
			<span class="sum">Everything the house reports, newest first</span>
			<label
				>Room
				<select bind:value={room}>
					<option value="">any</option>
					{#each roomNames as r (r)}<option value={r}>{r}</option>{/each}
				</select>
			</label>
			<label
				>What
				<select bind:value={kind}>
					{#each KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}
				</select>
			</label>
			<label class="check"
				><input type="checkbox" bind:checked={noise} /> Show readings that change all the time</label
			>
			<button class="plain" onclick={() => (paused ? resume() : (paused = true))}
				>{paused ? `Resume${held.length ? ` · ${held.length} new` : ''}` : 'Pause'}</button
			>
		</div>
		{#if failed}<p class="note bad" role="alert">{failed}</p>{/if}
		{#if rows.length === 0}
			<p class="empty">Nothing yet.</p>
		{:else}
			<ol class="list">
				{#each rows as r, i (`${r.key}:${r.at}:${i}`)}
					<li class={r.kind} class:fold={(r.count ?? 1) > 1 && r.kind !== 'warn'}>
						<span class="at">{at(r.at)}</span>
						<span class="mark" aria-hidden="true">{MARK[r.kind]}</span>
						<span class="words"
							>{#each r.words as w, j (j)}{#if w.strong}<strong>{w.t}</strong
									>{:else}{w.t}{/if}{/each}{#if r.room}<span class="room">
									· {r.room}</span
								>{/if}</span
						>
						{#if r.href}<a href={r.href}>Open</a>{/if}
					</li>
				{/each}
			</ol>
		{/if}
		<p class="quiet">
			homeCore keeps its last thousand events; these start from there and carry on live.
		</p>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.sum {
		flex: 1;
		color: var(--ink-muted);
	}
	label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.check {
		color: var(--ink);
	}
	select {
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 8px;
	}
	.plain {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 700;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.list li {
		display: grid;
		grid-template-columns: max-content 28px minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
		min-height: 44px;
		padding: 6px 16px;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.list li.fold {
		background: color-mix(in srgb, var(--surface-2) 35%, var(--surface));
		color: var(--ink-muted);
	}
	.list li.warn {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.at {
		white-space: nowrap;
		font-family: var(--font-num);
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.mark {
		width: 26px;
		height: 26px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 700;
	}
	.warn .mark {
		background: var(--lit-ink);
		color: var(--lit-bg);
	}
	.words {
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.room {
		color: var(--ink-muted);
		font-size: 13px;
	}
	a {
		font-size: 13px;
		font-weight: 700;
		color: var(--accent);
	}
	.empty {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		font-weight: 600;
	}
	.bad {
		color: var(--alert);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
