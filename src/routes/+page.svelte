<!--
	The generated home (D1): what needs attention and what's on, as chips; the
	house's modes and the scenes that belong to no room; then every room, with
	its summary and "All off" (C5). Favourites join in R4, with personalising.
-->
<script lang="ts">
	import { cardFor, kindOf } from '#lib/card.js';
	import { displayName } from '#lib/devices.js';
	import { byRoom, houseChips } from '#lib/summary.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import Icon from '#lib/components/Icon.svelte';
	import RoomRow from '#lib/components/RoomRow.svelte';
	import SceneCard from '#lib/components/SceneCard.svelte';

	const list = $derived(Object.values(devices.byId));
	const cards = $derived(new Map(list.map((d) => [d.device_id, cardFor(d, clock.now)])));
	const grouped = $derived(byRoom(devices.byId, rooms.list));
	const chips = $derived(houseChips([...cards.values()]));
	const loose = $derived(grouped.get('') ?? []);
	const modes = $derived(
		list
			.filter((d) => kindOf(d) === 'mode')
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const looseScenes = $derived(
		loose
			.filter((d) => kindOf(d) === 'scene')
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const elsewhere = $derived(loose.filter((d) => kindOf(d) !== 'scene' && kindOf(d) !== 'mode'));
	const cardsOf = (ids: { device_id: string }[]) => ids.map((d) => cards.get(d.device_id)!);
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="home">
		{#if chips.length > 0}
			<nav class="chips" aria-label="What's going on">
				{#each chips as c (c.key)}
					<a class="chip" class:alert={c.alert} href={`/on/${c.key}`}>
						<Icon name={c.icon} size={16} />
						{c.text}
					</a>
				{/each}
			</nav>
		{/if}

		{#if modes.length > 0 || looseScenes.length > 0 || scenes.list.length > 0}
			<section>
				<h2 class="section-label">Scenes &amp; modes</h2>
				{#if modes.length > 0}
					<div class="modes">
						{#each modes as m (m.device_id)}
							{@const on = commands.pending[m.device_id]?.want.on ?? m.attributes.on === true}
							<button
								class="mode"
								aria-pressed={on === true}
								disabled={!m.schema?.attributes.on?.writable}
								onclick={() => commands.set(m.device_id, 'mode', { on: !on }, m.attributes)}
							>
								<Icon name="mode" size={16} />
								{displayName(m)}
							</button>
						{/each}
					</div>
				{/if}
				<div class="scenes">
					{#each scenes.list as s (s.id)}
						<SceneCard name={s.name} run={() => scenes.run(s.id)} />
					{/each}
					{#each looseScenes as d (d.device_id)}
						<SceneCard name={displayName(d)} run={() => commands.act(d.device_id, 'activate')} />
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h2 class="section-label">Rooms</h2>
			<div class="rooms">
				{#each rooms.list as r (r.id)}
					{@const inRoom = grouped.get(r.id) ?? []}
					{#if inRoom.length > 0}
						<RoomRow
							href={`/rooms/${r.id}`}
							name={r.name}
							devices={inRoom}
							cards={cardsOf(inRoom)}
						/>
					{/if}
				{/each}
				{#if elsewhere.length > 0}
					<RoomRow
						href="/rooms/none"
						name="Not in a room"
						devices={elsewhere}
						cards={cardsOf(elsewhere)}
					/>
				{/if}
			</div>
		</section>
	</div>
{/if}

<style>
	.home {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.quiet {
		color: var(--ink-muted);
	}
	.chips,
	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px 0 10px;
		border-radius: 18px;
		border: 1px solid var(--lit-card-line);
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.chip.alert {
		border-color: var(--alert-line);
		background: var(--alert-bg);
		color: var(--alert);
	}
	.mode {
		display: flex;
		align-items: center;
		gap: 6px;
		height: var(--target);
		padding: 0 14px 0 12px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 14px;
		font-weight: 600;
	}
	.mode[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.scenes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.rooms {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	@media (min-width: 700px) {
		.scenes {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
		.rooms {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
</style>
