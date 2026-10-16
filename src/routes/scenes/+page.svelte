<!--
	Every scene, by room, and the modes (C2, D10). homeCore's own scenes and the
	ones plugins bring look and behave the same: tap runs, long-press opens the
	details of a plugin's scene.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { kindOf } from '#lib/card.js';
	import { displayName } from '#lib/devices.js';
	import { roomOf } from '#lib/summary.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import ModeChips from '#lib/components/ModeChips.svelte';
	import SceneCard from '#lib/components/SceneCard.svelte';

	const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
	const groups = $derived.by(() => {
		const out = new Map<string, { id: string; name: string; device: boolean }[]>();
		for (const d of Object.values(devices.byId)) {
			if (kindOf(d) !== 'scene') continue;
			const room = roomOf(d, rooms.list)?.name ?? 'House';
			const list = out.get(room) ?? [];
			list.push({ id: d.device_id, name: displayName(d), device: true });
			out.set(room, list);
		}
		if (scenes.list.length > 0) {
			const list = out.get('House') ?? [];
			for (const s of scenes.list) list.push({ id: s.id, name: s.name, device: false });
			out.set('House', list);
		}
		// The house's own first, then rooms in order.
		return [...out.entries()]
			.map(([room, list]) => ({ room, list: list.sort(byName) }))
			.sort((a, b) =>
				a.room === 'House' ? -1 : b.room === 'House' ? 1 : a.room.localeCompare(b.room)
			);
	});
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="scenes">
		<section>
			<h2 class="section-label">Modes</h2>
			<ModeChips />
		</section>
		{#each groups as g (g.room)}
			<section>
				<h2 class="section-label">{g.room}</h2>
				<div class="grid">
					{#each g.list as s (s.id)}
						{#if s.device}
							<SceneCard
								name={s.name}
								run={() => commands.act(s.id, 'activate')}
								details={() => openDevice(s.id, page.url)}
							/>
						{:else}
							<SceneCard name={s.name} run={() => scenes.run(s.id)} />
						{/if}
					{/each}
				</div>
			</section>
		{:else}
			<p class="quiet">No scenes yet.</p>
		{/each}
	</div>
{/if}

<style>
	.scenes {
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
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	@media (min-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
