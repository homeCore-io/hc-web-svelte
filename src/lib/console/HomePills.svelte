<!--
	The house's camera news on Home in the console, where the household
	chose it (the "Header pills" choices, cameras.ts): what a camera saw in
	the last half hour, as pills. Each opens the camera's room on its Cameras
	tab at that event, or the Cameras page for a camera in no room.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { camEvents } from './camEvents.svelte.js';
	import { allEvents, camerasOf, pillPrefsOf, pillsOf, pillWord, roomOf } from './cameras.js';

	const prefs = $derived(pillPrefsOf(household.doc.console?.pills));
	const cams = $derived(prefs.home ? camerasOf(Object.values(devices.byId), devices.byId) : []);
	$effect(() => camEvents.follow(cams));
	const pills = $derived(
		pillsOf(
			allEvents(
				camEvents.byCam,
				cams.map((c) => c.id)
			),
			clock.now,
			prefs.kinds
		)
	);
	function hrefOf(cam: string, key: string): string {
		const c = cams.find((x) => x.id === cam);
		const r = c ? roomOf(c.device, rooms.list) : undefined;
		const q = `event=${encodeURIComponent(key)}`;
		return r ? `/rooms/${r.id}?tab=cameras&${q}` : `/cameras?${q}`;
	}
</script>

{#if pills.length > 0}
	<div class="pills" role="group" aria-label="What the cameras saw">
		{#each pills as e (e.key)}
			{@const c = cams.find((x) => x.id === e.cam)}
			<a class="camchip" class:old={clock.now - e.at > 10 * 60_000} href={hrefOf(e.cam, e.key)}
				><i aria-hidden="true"></i>{pillWord(e, clock.now, c?.name)}</a
			>
		{/each}
	</div>
{/if}

<style>
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}
	.camchip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 26px;
		padding: 0 11px 0 9px;
		border-radius: 999px;
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
		font-size: 12px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}
	:global(:root[data-theme='light']) .camchip:not(.old) {
		color: #8a5a10;
	}
	.camchip i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.camchip.old {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink-muted);
	}
	.camchip.old i {
		background: var(--ink-muted);
		box-shadow: none;
	}
	.camchip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
