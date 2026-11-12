<!--
	The "⋯" picker (the Garage board): where a device shows, for the whole
	household. Its room, as Settings › Devices changes it; then the room's
	tabs as chips, the one it's on lit and the one it lands on by itself
	marked; and Put back, which lets it sort itself again (placing.ts).

	One per room, by the "⋯" that opened it (placer.svelte.ts), inside the
	window. Esc, a click outside or leaving it with the keyboard closes it.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { patchDevice } from '#lib/deviceAdmin.js';
	import type { Placer } from './placer.svelte.js';
	import { setDeviceTab } from './tabChoice.js';
	import { devicesIn, TABS, tabChoicesOf, type TabId } from './room.js';
	import { choiceFor, ownTab, popoverAt, tabIn, TAB_HINTS } from './placing.js';

	let { p }: { p: Placer } = $props();

	const id = $derived(p.open?.id ?? '');
	const d = $derived(devices.byId[id]);
	const name = $derived(d ? (d.name_override ?? d.name) : '');
	const room = $derived(d ? roomOf(d, rooms.list) : undefined);
	const list = $derived(room ? devicesIn(devices.byId, room) : []);
	const chosen = $derived(tabChoicesOf(household.doc.console?.tabs));
	const own = $derived(ownTab(list, id, chosen, p.width()));
	const now = $derived(tabIn(list, id, chosen, p.width()));
	const roomNames = $derived([...rooms.list].sort((a, b) => a.name.localeCompare(b.name)));
	const mayMove = $derived(session.can('devices:write'));

	let box = $state<HTMLElement>();
	let w = $state(0);
	let h = $state(0);
	let vw = $state(0);
	let vh = $state(0);
	let busy = $state(false);
	let trouble = $state<string | null>(null);
	// Where it sits: by its "⋯", measured again as the window or it changes size.
	const at = $derived.by(() => {
		void [vw, vh];
		const o = p.open;
		if (!o || w === 0) return undefined;
		// Its "⋯" is gone once the device moves off this tab: it stays where it was.
		const r = o.from.isConnected ? o.from.getBoundingClientRect() : o.rect;
		return popoverAt(
			{ left: r.left, top: r.top, width: r.width, height: r.height },
			{ width: w, height: h },
			{ width: vw, height: vh }
		);
	});

	// The keyboard starts in it, and a new device's picker starts clean.
	$effect(() => {
		void id;
		trouble = null;
		void tick().then(() => box?.querySelector<HTMLElement>('select, button')?.focus());
	});

	async function moveTo(roomId: string) {
		const to = rooms.list.find((r) => r.id === roomId);
		busy = true;
		trouble = await patchDevice(id, { area: to?.name ?? null });
		busy = false;
	}
	async function put(tab: TabId | undefined) {
		trouble = null;
		try {
			await setDeviceTab(id, tab);
			// Put back goes quiet once done: the keyboard moves to the tab it's on.
			if (tab === undefined) {
				await tick();
				box?.querySelector<HTMLElement>('.chip.on')?.focus();
			}
		} catch {
			trouble = 'The house didn’t keep that.';
		}
	}

	function away(e: PointerEvent) {
		const t = e.target as Node;
		if (!p.open || box?.contains(t) || p.open.from.contains(t)) return;
		p.close();
	}
	function leave(e: FocusEvent) {
		const to = e.relatedTarget as Node | null;
		if (to && !box?.contains(to) && !p.open?.from.contains(to)) p.close();
	}
</script>

<svelte:window
	bind:innerWidth={vw}
	bind:innerHeight={vh}
	onpointerdown={away}
	onkeydown={(e) => {
		if (e.key === 'Escape' && p.open) {
			e.preventDefault();
			p.close(true);
		}
	}}
/>

{#if p.open && d}
	<div
		class="placer"
		role="dialog"
		aria-labelledby="placer-h"
		bind:this={box}
		bind:offsetWidth={w}
		bind:offsetHeight={h}
		style:left={at ? `${at.left}px` : '0'}
		style:top={at ? `${at.top}px` : '0'}
		style:visibility={at ? 'visible' : 'hidden'}
		onfocusout={leave}
	>
		<p class="ph" id="placer-h">Show {name} in</p>

		<label class="k" for="placer-room">Room</label>
		<select
			id="placer-room"
			value={room?.id ?? ''}
			disabled={!mayMove || busy}
			title={mayMove ? undefined : 'Moving a device to a room is for people who may change devices'}
			onchange={(e) => moveTo(e.currentTarget.value)}
		>
			<option value="">No room</option>
			{#each roomNames as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
		</select>

		<p class="k" id="placer-tab">Tab</p>
		{#if room}
			<div class="chips" role="group" aria-labelledby="placer-tab">
				{#each TABS as t (t.id)}
					<button
						type="button"
						class="chip"
						class:on={t.id === now}
						aria-pressed={t.id === now}
						onclick={() => put(choiceFor(t.id, own))}
						>{t.name}<small>{t.id === own ? 'where it sorts' : TAB_HINTS[t.id]}</small></button
					>
				{/each}
			</div>
		{:else}
			<p class="note">In no room, it shows on no room’s tab.</p>
		{/if}
		{#if trouble}<p class="note bad" role="alert">{trouble}</p>{/if}

		<div class="foot">
			<p class="note">Everyone’s: this changes where it shows for the whole household</p>
			<button
				type="button"
				class="link"
				disabled={chosen[id] === undefined}
				onclick={() => put(undefined)}>Put back</button
			>
		</div>
	</div>
{/if}

<style>
	.placer {
		position: fixed;
		z-index: 40;
		box-sizing: border-box;
		width: 300px;
		max-width: calc(100vw - 16px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
		border-radius: 14px;
		background: var(--surface);
		box-shadow:
			0 30px 60px -20px rgba(0, 0, 0, 0.9),
			0 0 0 1px var(--con-edge);
		color: var(--ink);
	}
	.ph {
		margin: 0;
		font-size: 13.5px;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.k {
		margin: 2px 0 0;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	select {
		height: 34px;
		padding: 0 8px;
		border: 0;
		border-radius: 9px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		font: 500 13px var(--font);
	}
	.chips {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.chip {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 6px 9px;
		border: 0;
		border-radius: 9px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font: 600 12.5px var(--font);
		text-align: left;
		cursor: pointer;
	}
	.chip small {
		font-size: 10.5px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.chip:hover {
		background: color-mix(in srgb, var(--ink) 11%, transparent);
	}
	.chip.on {
		background: linear-gradient(140deg, #ffc46b, #ff8a5b);
		color: #1d1006;
	}
	.chip.on small {
		color: color-mix(in srgb, #1d1006 70%, transparent);
	}
	.foot {
		display: flex;
		align-items: flex-end;
		gap: 10px;
		margin-top: 2px;
		padding-top: 8px;
		border-top: 1px solid var(--con-edge);
	}
	.note {
		margin: 0;
		font-size: 11px;
		line-height: 1.4;
		color: var(--ink-muted);
	}
	.foot .note {
		flex: 1;
	}
	.note.bad {
		color: var(--alert);
	}
	.link {
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: 600 12px var(--font);
		cursor: pointer;
	}
	.link:disabled {
		color: var(--ink-muted);
		opacity: 0.5;
		cursor: default;
	}
	select:focus-visible,
	.chip:focus-visible,
	.link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
