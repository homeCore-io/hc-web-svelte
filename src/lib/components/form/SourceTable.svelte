<!--
	A table bound to the plugin's own devices (`source: core_resource devices`):
	its rows are the devices homeCore has from this plugin, live, and a change
	is made to the device itself — its name, its room — not to the settings
	file. Every such table in the house's plugins names the device and puts
	it in a room; a room typed that the house hasn't yet is made.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { moveDevice, renameDevice } from '#lib/admin.js';
	import type { Field } from '#lib/descriptor.js';

	let {
		field,
		pluginId,
		disabled = false
	}: { field: Field; pluginId: string | undefined; disabled?: boolean } = $props();

	const columns = $derived(Array.isArray(field.item) ? field.item : []);
	const has = (key: string) => columns.some((c) => c.key === key);
	const list = $derived(
		Object.values(devices.byId)
			.filter((d) => d.plugin_id === pluginId)
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const roomName = (d: CoreDevice) => roomOf(d, rooms.list)?.name ?? '';

	let notes = $state<Record<string, { ok: boolean; text: string }>>({});
	const say = (id: string, err: string | null, done: string) =>
		(notes = { ...notes, [id]: err ? { ok: false, text: err } : { ok: true, text: done } });

	async function rename(d: CoreDevice, name: string) {
		const t = name.trim();
		if (t === '' || t === displayName(d)) return;
		say(d.device_id, await renameDevice(d.device_id, t), 'Renamed.');
	}
	async function move(d: CoreDevice, room: string) {
		const t = room.trim();
		if (t === roomName(d)) return;
		say(d.device_id, await moveDevice(d.device_id, t || null), t ? `In ${t}.` : 'In no room.');
	}
</script>

<div class="devices">
	{#if list.length === 0}
		<p class="quiet">No devices from this plugin yet. They appear here as it finds them.</p>
	{/if}
	{#each list as d (d.device_id)}
		<div class="row">
			<div class="who">
				<span class="id">{d.device_id}</span>
				{#if notes[d.device_id]}<span class="note" class:bad={!notes[d.device_id]!.ok}
						>{notes[d.device_id]!.text}</span
					>{/if}
			</div>
			{#if has('name')}
				<input
					aria-label={`${d.device_id}: name`}
					value={displayName(d)}
					{disabled}
					onchange={(e) => rename(d, e.currentTarget.value)}
				/>
			{/if}
			{#if has('area')}
				<input
					aria-label={`${d.device_id}: room`}
					list="source-table-rooms"
					placeholder="No room"
					value={roomName(d)}
					{disabled}
					onchange={(e) => move(d, e.currentTarget.value)}
				/>
			{/if}
		</div>
	{/each}
	<datalist id="source-table-rooms">
		{#each rooms.list as r (r.id)}<option value={r.name}></option>{/each}
	</datalist>
	<p class="quiet">
		A change here is made to the device at once — it isn’t part of saving these settings. A room the
		house doesn’t have yet is made.
	</p>
</div>

<style>
	.devices {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr);
		gap: 8px;
		align-items: center;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--surface-2);
	}
	@media (max-width: 640px) {
		.row {
			grid-template-columns: 1fr;
		}
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.id {
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.note {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.note.bad {
		color: var(--alert);
	}
	input {
		height: 36px;
		min-width: 0;
		padding: 0 10px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
