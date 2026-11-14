<!--
	A room's header chips and pills, on the desktop's room (ConsoleRoom) and
	the phone's (PhoneRoom) alike, from the room now (roomNow.svelte.ts): its
	temperature, its lights and what's playing as chips; then a pill for each
	lock (pressed, it locks or unlocks), each door (pressed, the tab it's on)
	and what the cameras saw lately (pressed, the Cameras tab at it).

	They sit in the page's own row: it wraps them on the desktop and scrolls
	them across on a phone (`phone`), where they're a little larger to touch.
-->
<script lang="ts">
	import LockIcon from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import type { CoreDevice } from '#lib/devices.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { isOpen } from '#lib/card.js';
	import { pillWord } from './cameras.js';
	import type { RoomNow } from './roomNow.svelte.js';

	let { r, phone = false }: { r: RoomNow; phone?: boolean } = $props();

	const lockedOf = (d: CoreDevice) => {
		const c = r.card(d);
		return c.control?.kind === 'lock' ? c.control.locked : c.stateLine.startsWith('Locked');
	};
</script>

{#if r.temperature}<span class="chip" class:phone>{r.temperature}</span>{/if}
{#if r.lightsWord}<span class="chip" class:phone>{r.lightsWord}</span>{/if}
{#if r.playing > 0}<span class="chip" class:phone
		>{r.playing === 1 ? '1 playing' : `${r.playing} playing`}</span
	>{/if}
{#each r.locks as d (d.device_id)}
	{@const locked = lockedOf(d)}
	<button
		type="button"
		class="pill"
		class:phone
		class:ok={d.available && locked}
		class:bad={!d.available || !locked}
		aria-busy={commands.pending[d.device_id] ? true : undefined}
		title={!d.available
			? `${r.nameOf(d)} is offline`
			: locked
				? `Unlock ${r.nameOf(d)}`
				: `Lock ${r.nameOf(d)}`}
		onclick={() => r.lockPill(d)}
	>
		{#if locked}<LockIcon size={13} strokeWidth={2.2} aria-hidden="true" />{:else}<LockOpen
				size={13}
				strokeWidth={2.2}
				aria-hidden="true"
			/>{/if}
		{r.pillName(d)}: {d.available ? (locked ? 'Locked' : 'Unlocked') : 'Offline'}
	</button>
{/each}
{#each r.openings as d (d.device_id)}
	{@const open = isOpen(r.card(d))}
	<button
		type="button"
		class="pill"
		class:phone
		class:ok={d.available && !open}
		class:bad={!d.available || open}
		title={r.openingHint(d)}
		onclick={() => r.openingPill(d, r.choose)}
	>
		{#if open}<DoorOpen size={13} strokeWidth={2.2} aria-hidden="true" />{:else}<DoorClosed
				size={13}
				strokeWidth={2.2}
				aria-hidden="true"
			/>{/if}
		{r.pillName(d)}: {d.available ? (open ? 'Open' : 'Closed') : 'Offline'}
	</button>
{/each}
{#each r.camPills as e (e.key)}
	<button
		type="button"
		class="pill cam"
		class:phone
		class:old={clock.now - e.at > 10 * 60_000}
		title="See it on the Cameras tab"
		onclick={() => r.showEvent(e.key)}
		><i aria-hidden="true"></i>{pillWord(e, clock.now, r.camName(e.cam))}</button
	>
{/each}

<style>
	.chip,
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		backdrop-filter: blur(10px);
		font-size: 12px;
		color: color-mix(in srgb, var(--ink) 90%, transparent);
		white-space: nowrap;
	}
	.pill {
		cursor: pointer;
		font-weight: 600;
	}
	/* A phone's: larger, kept whole as they scroll across, and easier to touch. */
	.phone {
		flex: none;
		height: 30px;
		padding: 0 11px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		font: 600 12px var(--font);
		color: inherit;
	}
	.pill.phone {
		position: relative;
	}
	.pill.phone::after {
		content: '';
		position: absolute;
		inset: -7px 0;
	}
	.pill.ok {
		background: color-mix(in srgb, var(--good, #4fe0a0) 18%, transparent);
		color: var(--good-ink, color-mix(in srgb, var(--good, #4fe0a0) 70%, var(--ink)));
	}
	.pill.bad {
		background: color-mix(in srgb, var(--alert) 22%, transparent);
		color: color-mix(in srgb, var(--alert) 65%, var(--ink));
	}
	.pill:hover {
		filter: brightness(1.15);
	}
	.pill.cam {
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
	}
	:global(:root[data-theme='light']) .pill.cam {
		color: #8a5a10;
	}
	.pill.cam i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.pill.cam.old {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 80%, transparent);
	}
	.pill.cam.old i {
		background: var(--ink-muted);
		box-shadow: none;
	}
	.pill[aria-busy='true'] {
		opacity: 0.6;
	}
	.pill:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
