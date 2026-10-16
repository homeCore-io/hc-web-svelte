<!--
	Devices (N1): each device's name and which room it is in. Both are
	homeCore's; a person's choice here is an override that a bridge's next
	report doesn't undo (H1).
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { kindOf } from '#lib/card.js';
	import { moveDevice, renameDevice } from '#lib/admin.js';

	let query = $state('');
	const roomNames = $derived([...rooms.list].sort((a, b) => a.name.localeCompare(b.name)));
	const all = $derived(
		Object.values(devices.byId)
			.map((d) => ({ d, name: displayName(d), room: roomOf(d, rooms.list) }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return all;
		return all.filter((x) =>
			`${x.name} ${x.room?.name ?? ''} ${kindOf(x.d)}`.toLowerCase().includes(q)
		);
	});

	let names = $state<Record<string, string>>({});
	let notes = $state<Record<string, string>>({});
	const note = (id: string, err: string | null, done: string) =>
		(notes = { ...notes, [id]: err ?? done });

	async function rename(d: CoreDevice, current: string) {
		const id = d.device_id;
		const next = (names[id] ?? current).trim();
		if (next === '' || next === current) {
			delete names[id];
			return;
		}
		note(id, await renameDevice(id, next), 'Renamed.');
		delete names[id];
	}

	async function move(d: CoreDevice, roomId: string) {
		const room = rooms.list.find((r) => r.id === roomId);
		note(
			d.device_id,
			await moveDevice(d.device_id, room?.name ?? null),
			room ? `Moved to ${room.name}.` : 'Now in no room.'
		);
	}
</script>

{#if !session.can('devices:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<input
			class="filter"
			type="search"
			bind:value={query}
			placeholder="Find a device by name, room or kind"
			aria-label="Find a device"
		/>
		<p class="quiet">{shown.length} of {all.length}</p>
		<ul>
			{#each shown as x (x.d.device_id)}
				{@const id = x.d.device_id}
				<li>
					<input
						class="name"
						value={names[id] ?? x.name}
						aria-label={`Name of ${x.name}`}
						oninput={(e) => (names[id] = e.currentTarget.value)}
						onblur={() => rename(x.d, x.name)}
						onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					/>
					<select
						value={x.room?.id ?? ''}
						aria-label={`Room for ${x.name}`}
						onchange={(e) => move(x.d, e.currentTarget.value)}
					>
						<option value="">No room</option>
						{#each roomNames as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
					</select>
					<span class="kind">{kindOf(x.d).replace(/_/g, ' ')} · {id}</span>
					{#if notes[id]}<span class="note" role="status">{notes[id]}</span>{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.stack {
		max-width: 760px;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.filter {
		height: var(--target);
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 12em);
		gap: 4px 8px;
		padding: 6px 8px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.name,
	select {
		height: 40px;
		min-width: 0;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: none;
	}
	.name {
		font-weight: 600;
	}
	select {
		border-color: var(--line);
	}
	.name:focus {
		border-color: var(--line);
		background: var(--sheet);
		outline: none;
	}
	.kind,
	.note {
		grid-column: 1 / -1;
		padding: 0 8px;
		font-size: 12px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note {
		color: var(--ink);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
