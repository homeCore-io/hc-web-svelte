<!--
	Every room's box (G4, G-b): the room kind's settings for every room at
	once — the person's in Customise, the household's in Edit — and the rooms
	set on their own, which these don't reach. A room's own settings win over
	anyone's every-room settings; "Use these instead" takes this layer's away.
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ROOM_BUILT_IN, roomDescriptor } from '#lib/options.js';
	import type { Card } from '#lib/page.js';
	import { reads, roomBox } from '#lib/roomBox.js';
	import { view } from '#lib/view.svelte.js';
	import KindSettings from './KindSettings.svelte';
	import RoomBox from './RoomBox.svelte';

	type Room = Extract<Card, { kind: 'room' }>;
	let {
		page,
		rooms,
		names,
		close
	}: {
		page: string;
		rooms: Room[];
		/** Each room's name on this page, by ref. */
		names: Record<string, string>;
		close: () => void;
	} = $props();

	const shared = $derived(view.mode(page) === 'edit');
	const layer = $derived(kindOptions.kind(page, 'room', ROOM_BUILT_IN));
	const own = $derived(
		kindOptions.setOnTheirOwn(
			page,
			rooms.map((r) => r.ref)
		)
	);
	// The preview: the busiest room that follows these settings, one with a
	// temperature if any has, so the big number shows.
	const warm = (r: Room) => r.devices.some((d) => reads(d, 'temperature'));
	const sample = $derived(
		[...rooms]
			.filter((r) => !own.some((o) => o.ref === r.ref) && r.id !== 'none')
			.sort(
				(a, b) => Number(warm(b)) - Number(warm(a)) || b.devices.length - a.devices.length
			)[0] ?? rooms[0]
	);
</script>

<KindSettings
	title="Every room’s box"
	who={shared
		? 'For everyone — a room set on its own keeps its own.'
		: 'Only you see this — a room set on its own keeps its own.'}
	descriptor={roomDescriptor()}
	mine={layer.mine}
	without={layer.without}
	save={layer.save}
	{close}
>
	{#snippet preview(o)}
		{#if sample}
			<div class="room">
				<RoomBox
					name={names[sample.ref] ?? sample.name}
					box={roomBox(
						sample.devices,
						sample.devices.map((d) => cardFor(d, clock.now)),
						devices.byId,
						o
					)}
					devices={[]}
				/>
			</div>
		{/if}
	{/snippet}
	<section class="own">
		<h3>Rooms set on their own</h3>
		{#each own as o (o.ref)}
			<div class="row">
				<span class="name">{names[o.ref] ?? o.ref}</span>
				{#if o.mine}
					<button
						class="plain"
						onclick={() => view.change(page, { op: 'config', ref: o.ref, config: {} })}
						>Use these instead</button
					>
				{:else}
					<span class="sub">Set for everyone</span>
				{/if}
			</div>
		{:else}
			<p class="sub">None — every room follows these settings.</p>
		{/each}
	</section>
</KindSettings>

<style>
	.room {
		height: 150px;
		display: grid;
	}
	.own {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-top: 1px solid var(--line);
		padding-top: 12px;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 48px;
		padding: 4px 6px 4px 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.name {
		flex: 1;
		font-size: 14px;
		font-weight: 600;
	}
	.sub {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.plain {
		height: 36px;
		padding: 0 12px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
</style>
