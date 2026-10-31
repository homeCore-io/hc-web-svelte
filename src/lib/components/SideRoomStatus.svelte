<!--
	A room's status in the sidebar (G3 — "Rooms in the sidebar"): its box's
	big number, a glow while its lights are on, and the alert colour when
	something's wrong — from the same settings as its box on Home.
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ref } from '#lib/layers.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { roomBox } from '#lib/roomBox.js';

	let { room, list }: { room: string; list: CoreDevice[] } = $props();
	const box = $derived(
		roomBox(
			list,
			list.map((d) => cardFor(d, clock.now)),
			devices.byId,
			kindOptions.of('home', 'room', ref.room(room), ROOM_BUILT_IN)
		)
	);
	const wrong = $derived(box.lines.find((l) => l.alert)?.text);
</script>

<span class="status" class:wrong={wrong !== undefined} title={wrong}>
	{#if box.glow > 0}<span class="glow" aria-label="Lights on"></span>{/if}
	{#if wrong}<span class="sr">{wrong}</span>{/if}
	{box.big ?? ''}
</span>

<style>
	.status {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		font-weight: 400;
	}
	.wrong {
		color: var(--alert);
		font-weight: 600;
	}
	.wrong::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--alert);
	}
	.glow {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--fill);
		box-shadow: 0 0 6px var(--fill);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
