<!--
	A wall keypad, drawn as one (the LivingRoom board): its buttons with their
	names and status lights as the keypad itself shows them, the one pressed
	last marked, and its raise and lower rocker when it has one. Pressing a
	button presses it on the wall, where the keypad's plugin declares a press;
	otherwise the drawing only shows what the keypad shows. A button that
	opens a door or a gate asks first.

	Someone who may change devices can rename its buttons in place, where its
	plugin lets them: each button becomes a box for its name, and an empty one
	goes back to the engraving.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import { blankName, keypadButtons, renames } from './keypad.js';

	let { device, may = true }: { device: CoreDevice; may?: boolean } = $props();

	/** The rocker's buttons on a Lutron keypad: lower, raise. */
	const LOWER = 18;
	const RAISE = 19;

	const a = $derived(device.attributes);
	const name = $derived(device.name_override ?? device.name);
	const buttons = $derived(keypadButtons(device));
	const keys = $derived(buttons.filter((b) => b.n !== LOWER && b.n !== RAISE));
	const rocker = $derived(buttons.some((b) => b.n === LOWER) && buttons.some((b) => b.n === RAISE));
	const press = $derived(device.schema?.actions?.find((x) => x.id === 'press_button'));
	const can = $derived(!!press && may && device.available);
	const lit = (n: number) => {
		const v = a[`led_${n}`];
		return v === true || (typeof v === 'number' && v > 0) || v === 'on';
	};
	const last = $derived(typeof a.last_button === 'number' ? a.last_button : undefined);
	const lastName = $derived(
		last === LOWER ? 'lower' : last === RAISE ? 'raise' : buttons.find((b) => b.n === last)?.name
	);
	const blank = blankName;

	/** A button that opens or unlocks something, by its name: always asked first. */
	const OPENS = /\b(door|gate|garage|lock|unlock)\b/i;
	async function push(n: number) {
		if (!can) return;
		const label = buttons.find((b) => b.n === n)?.name ?? `Button ${n}`;
		const go = OPENS.test(label)
			? await ask({ title: `Press ${label} on ${name}?`, go: 'Press it', stay: 'Not now' })
			: await goAhead(device.device_id, 'keypad', `Press ${label} on ${name}?`);
		if (go) void commands.act(device.device_id, 'press_button', { button: n });
	}

	// ---- renaming its buttons ----
	const mayRename = $derived(renames(device) && session.can('devices:write') && device.available);
	let renaming = $state(false);
	let saving = $state<Record<number, boolean>>({});
	/** Send a button's new name; an empty one gives it back its engraving. */
	async function rename(n: number, input: HTMLInputElement) {
		const b = buttons.find((x) => x.n === n);
		const typed = input.value.trim();
		if (!b || typed === (blank(b.name) ? '' : b.name)) return;
		saving = { ...saving, [n]: true };
		const sent = await commands.act(device.device_id, 'set_button_name', {
			button: n,
			name: typed
		});
		saving = { ...saving, [n]: false };
		if (!sent) input.value = blank(b.name) ? '' : b.name;
	}
	function keyed(e: KeyboardEvent, b: { name: string }) {
		const input = e.currentTarget as HTMLInputElement;
		if (e.key === 'Enter') input.blur();
		else if (e.key === 'Escape') {
			input.value = blank(b.name) ? '' : b.name;
			input.blur();
		}
	}
</script>

<div class="kp">
	<div class="kplate" role="group" aria-label={`${name} keypad`}>
		{#each keys as b (b.n)}
			{#if renaming}
				<label class="kbtn kname" class:wait={saving[b.n]}
					><span class="kled" aria-hidden="true"></span><input
						type="text"
						value={blank(b.name) ? '' : b.name}
						placeholder={b.engraved ?? `Button ${b.n}`}
						maxlength="40"
						disabled={saving[b.n]}
						aria-label={`Name for button ${b.n}${b.engraved ? `, engraved ${b.engraved}` : ''}`}
						onkeydown={(e) => keyed(e, b)}
						onchange={(e) => void rename(b.n, e.currentTarget)}
					/></label
				>
			{:else}
				<button
					type="button"
					class="kbtn"
					class:lit={lit(b.n)}
					class:blank={blank(b.name)}
					class:last={last === b.n}
					disabled={!can}
					aria-label={`${b.name}${lit(b.n) ? ', its light on' : ''}`}
					onclick={() => void push(b.n)}
					><span class="kled" aria-hidden="true"></span><span class="ktxt">{b.name}</span></button
				>
			{/if}
		{/each}
		{#if rocker}
			<div class="krock">
				<button type="button" aria-label="Lower" disabled={!can} onclick={() => void push(LOWER)}
					>▼</button
				>
				<button type="button" aria-label="Raise" disabled={!can} onclick={() => void push(RAISE)}
					>▲</button
				>
			</div>
		{/if}
	</div>
	<p class="note">
		{#if renaming}
			Type a name, or clear it for the engraving.
			<button type="button" class="more" onclick={() => (renaming = false)}>Done</button>
		{:else}
			{#if lastName}Last pressed: {lastName}.{/if}
			{press
				? 'Its lights show what the keypad shows.'
				: 'Shown as it is; it can’t be pressed from here.'}
			<button type="button" class="more" onclick={() => openDevice(device.device_id, page.url)}
				>Details</button
			>
			{#if mayRename}
				<button type="button" class="more" onclick={() => (renaming = true)}>Rename buttons</button>
			{/if}
		{/if}
	</p>
</div>

<style>
	.kp {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 170px;
	}
	.kplate {
		width: 150px;
		box-sizing: border-box;
		padding: 16px 14px;
		border-radius: 14px;
		display: flex;
		flex-direction: column;
		gap: 7px;
		background: linear-gradient(180deg, #f2f1ec, #d9d7cf);
		box-shadow:
			0 18px 30px -16px rgba(0, 0, 0, 0.9),
			inset 0 1px 0 #fff,
			inset 0 -2px 0 rgba(0, 0, 0, 0.12);
	}
	.kbtn,
	.krock button {
		border: 0;
		border-radius: 5px;
		background: linear-gradient(180deg, #fbfaf6, #e7e5de);
		box-shadow:
			0 1px 0 rgba(0, 0, 0, 0.18),
			inset 0 1px 0 #fff;
		cursor: pointer;
	}
	.kbtn {
		position: relative;
		height: 30px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 8px;
		color: #4a4740;
		font: 600 10.5px var(--font);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-align: left;
	}
	.kbtn:not(:disabled):active,
	.krock button:not(:disabled):active {
		transform: translateY(1px);
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	.kbtn:disabled,
	.krock button:disabled {
		cursor: default;
	}
	.kbtn:focus-visible,
	.krock button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.kled {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #bdbab1;
		flex: none;
	}
	.lit .kled {
		background: #5ad1ff;
		box-shadow:
			0 0 6px #5ad1ff,
			0 0 12px rgba(90, 209, 255, 0.8);
	}
	.blank {
		color: #9d998f;
	}
	.last {
		box-shadow:
			0 0 0 2px rgba(255, 196, 107, 0.8),
			inset 0 1px 0 #fff;
	}
	/* Renaming: the button is a box for its name, the same size. */
	.kname {
		cursor: text;
		background: #fff;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
	}
	.kname:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.kname input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		padding: 0;
		background: none;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		text-transform: none;
		outline: none;
	}
	.kname input::placeholder {
		color: #9d998f;
		text-transform: uppercase;
	}
	.kname.wait {
		opacity: 0.6;
	}
	.ktxt {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.krock {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-top: 4px;
	}
	.krock button {
		height: 24px;
		color: #6a665c;
		font-size: 10px;
	}
	.note {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ink-muted);
	}
	.more {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink-muted);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.more:hover {
		color: var(--ink);
	}
</style>
