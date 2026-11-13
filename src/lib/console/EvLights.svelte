<!--
	Everywhere › Lights (the Everywhere board): a row for each room with
	lights, in Home's order, each light a bulb lit to its level. Tapping a
	bulb turns that light on or off; On and Off do the room, as Room on and
	Room off in its header do (homeCore remembers which lights were on).
	"Turn every light off" asks first. On a phone (`phone`), each bulb is
	named, under the room's name.
-->
<script lang="ts">
	import { commands } from '#lib/commands.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { kindOf } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import EvHead from './EvHead.svelte';
	import { levelOf } from './room.js';
	import { whereLit } from '#lib/lights.js';
	import { setLights } from './switchLights.js';
	import { lightRows, lightsCount, lit, onWord, type LightRow, type Place } from './everywhere.js';

	let { places, phone = false }: { places: Place[]; phone?: boolean } = $props();

	const rows = $derived(lightRows(places));
	const count = $derived(lightsCount(rows, commands.pending));
	const may = $derived(session.mayUse);
	const nameOf = (d: CoreDevice) => d.name_override ?? d.name;
	const want = (d: CoreDevice) => commands.pending[d.device_id]?.want;

	const summary = $derived(
		count.all === 0
			? 'No lights in the house yet'
			: count.on === 0
				? `All ${count.all} lights are off`
				: `${count.on} of ${count.all} lights on ${whereLit(count)}`
	);

	function flip(d: CoreDevice) {
		if (!may || !d.available) return;
		void commands.set(d.device_id, kindOf(d), { on: !lit(d, commands.pending) }, d.attributes);
	}

	// ---- a room's On and Off, and every light off ----
	let busy = $state<Record<string, 'on' | 'off'>>({});
	let trouble = $state<string | null>(null);
	async function power(r: LightRow, on: boolean): Promise<string | null> {
		const key = r.place.key;
		if (busy[key]) return null;
		busy = { ...busy, [key]: on ? 'on' : 'off' };
		const error = await setLights({ ...r, room: r.place.room, name: r.place.name }, on);
		const { [key]: _done, ...rest } = busy;
		busy = rest;
		return error;
	}
	async function room(r: LightRow, on: boolean) {
		trouble = await power(r, on);
	}
	async function allOff() {
		const going = rows.filter((r) => r.lights.some((d) => lit(d, commands.pending)));
		if (going.length === 0) return;
		const yes = await ask({
			title: 'Turn every light off?',
			body:
				count.on === 1
					? 'The one light on goes off.'
					: `All ${count.on} lights on ${whereLit(count)} go off.`,
			go: 'Turn off',
			stay: 'Not now'
		});
		if (!yes) return;
		const said = await Promise.all(going.map((r) => power(r, false)));
		trouble = said.find((s) => s !== null) ?? null;
	}
</script>

<EvHead title="Lights" {summary} glow="#ffaa50" {trouble}>
	<button type="button" class="hbtn" disabled={!may || count.on === 0} onclick={allOff}
		>Turn every light off</button
	>
</EvHead>

<section class="evlist" aria-label="Lights in every room">
	{#if rows.length === 0}
		<p class="quiet">No room has lights yet.</p>
	{/if}
	{#each rows as r (r.place.key)}
		<div class="evrow">
			{#if r.place.room}
				<a class="evname" href={`/rooms/${r.place.room.id}?tab=lights`}
					><b>{r.place.name}</b><small>{onWord(r.lights, commands.pending)}</small></a
				>
			{:else}
				<div class="evname">
					<b>{r.place.name}</b><small>{onWord(r.lights, commands.pending)}</small>
				</div>
			{/if}
			<div class="bulbs" class:named={phone} role="group" aria-label={`${r.place.name} lights`}>
				{#each r.lights as d (d.device_id)}
					{@const level = d.available ? levelOf(d, want(d)) : 0}
					<button
						type="button"
						class="bulb"
						class:on={level > 0}
						class:gone={!d.available}
						aria-busy={commands.pending[d.device_id] ? true : undefined}
						aria-pressed={level > 0}
						aria-label={`${nameOf(d)}, ${!d.available ? 'offline' : level > 0 ? `${level} percent` : 'off'}`}
						title={commands.notes[d.device_id] ?? nameOf(d)}
						disabled={!may || !d.available}
						onclick={() => flip(d)}
						>{#if phone}<i></i><span>{nameOf(d)}</span>{:else}<i
								style:height={level > 0 ? `${Math.max(18, level)}%` : '0'}
							></i>{/if}</button
					>
				{/each}
			</div>
			<div class="pair" role="group" aria-label={`${r.place.name} lights`}>
				<button
					type="button"
					disabled={!may || busy[r.place.key] !== undefined}
					aria-busy={busy[r.place.key] === 'on' || undefined}
					onclick={() => room(r, true)}>On</button
				>
				<button
					type="button"
					disabled={!may || busy[r.place.key] !== undefined}
					aria-busy={busy[r.place.key] === 'off' || undefined}
					onclick={() => room(r, false)}>Off</button
				>
			</div>
		</div>
	{/each}
</section>

<style>
	.bulbs {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 6px;
		padding: 6px 0;
	}
	.bulb {
		position: relative;
		flex: none;
		width: 20px;
		height: 30px;
		padding: 0;
		border: 0;
		border-radius: 6px;
		overflow: hidden;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
		cursor: pointer;
	}
	.bulb i {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 6px;
		background: linear-gradient(0deg, #ff9a3d, #ffe2a8);
		transition: height var(--quick, 0.15s);
	}
	.bulb.on {
		box-shadow: 0 0 12px rgba(255, 180, 90, 0.45);
	}
	.bulb.gone {
		background: transparent;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent);
		cursor: default;
	}
	.bulb:disabled:not(.gone) {
		cursor: default;
	}
	.bulb[aria-busy='true'] {
		opacity: 0.65;
	}
	.bulb:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* On a phone: a chip each, its name beside a lamp that's lit while it's on. */
	.named {
		order: 3;
		flex-basis: 100%;
		padding: 0;
	}
	.named .bulb {
		width: auto;
		max-width: 100%;
		height: 44px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 0 12px 0 11px;
		border-radius: 999px;
		box-shadow: none;
		color: var(--ink-muted);
		font: 600 12.5px var(--font);
	}
	.named .bulb span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.named .bulb i {
		position: static;
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 25%, transparent);
	}
	.named .bulb.on {
		background: rgba(255, 196, 107, 0.14);
		color: #ffd48a;
	}
	:global(:root[data-theme='light']) .named .bulb.on {
		color: #8a5a10;
	}
	.named .bulb.on i {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.pair {
		flex: none;
		display: flex;
		padding: 3px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.pair button {
		height: 30px;
		padding: 0 14px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--ink);
		font: 600 13px var(--font);
		cursor: pointer;
	}
	.pair button:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.pair button:disabled {
		cursor: default;
		opacity: 0.6;
	}
</style>
