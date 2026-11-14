<!--
	A thermostat in the console's Climate tab (the Garage, Office and
	FamilyRoom boards): a lit ring to its target with the target and the
	temperature now inside, − and + under it, then its modes, or its schedule
	where it keeps one. − and + move the target shown at once and send when
	the presses stop (`Nudge`), as its card does.

	The switch it runs shows beside it, or under it where the tab is crowded:
	on or off and why, never switched here, so a hand doesn't fight it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { openDevice } from '#lib/popup.js';
	import { reading } from '#lib/card.js';
	import { deg, Nudge, scheduleWords, sendFor, thermostatOf, type Send } from '#lib/thermostat.js';
	import Col from './Col.svelte';
	import Place from './Place.svelte';
	import { aimWord, dialAt, dialSpan, planSend, plansOf, type Plan } from './climate.js';
	import { shortName } from './room.js';
	import { readingName } from './climate.js';

	let {
		device,
		runs,
		room,
		may,
		apart = true
	}: {
		device: CoreDevice;
		/** The switch it runs, when it says. */
		runs?: CoreDevice;
		room: string;
		may: boolean;
		/** The switch it runs gets a column of its own; else a line under the thermostat. */
		apart?: boolean;
	} = $props();

	const t = $derived(thermostatOf(device));
	const name = $derived(shortName(device.name_override ?? device.name, room));
	const open = (d: CoreDevice) => openDevice(d.device_id, page.url);
	const locked = $derived(!may || !device.available);

	function send(s: Send) {
		if (s.kind === 'action') void commands.act(device.device_id, s.id, s.params);
		else void commands.set(device.device_id, 'thermostat', s.want, device.attributes);
	}

	// ---- − and + ----
	let pending = $state<number | undefined>();
	let sentAt = 0;
	const nudge = new Nudge((value) => {
		sentAt = Date.now();
		send(sendFor(t, device, value, 'next'));
	});
	$effect(() => () => nudge.stop());
	$effect(() => {
		const arrived =
			pending !== undefined && t.target !== undefined && Math.abs(t.target - pending) < t.step / 2;
		const waited = sentAt > 0 && clock.now - sentAt > 20_000;
		if (arrived || waited) {
			nudge.settle();
			pending = undefined;
			sentAt = 0;
		}
	});
	function press(by: number) {
		const from = pending ?? t.target;
		if (from === undefined || locked) return;
		pending = nudge.press(t, from, by);
	}
	const target = $derived(pending ?? t.target);

	// ---- the ring ----
	const span = $derived(dialSpan({ ...t, target }));
	const cool = $derived(t.mode === 'cool' || t.doing === 'cooling');
	const busy = $derived(t.doing === 'heating' || t.doing === 'cooling');
	const arcDeg = $derived(Math.round(dialAt(span, target) * 270));
	const nowAt = $derived(t.now === undefined ? undefined : dialAt(span, t.now));
	/**
	 * Whose the temperature under the target is: the thermostat's own reading
	 * (the room's, in its header, may come from a thermometer and differ), or
	 * the floor's for a floor's heat.
	 */
	const nowOf = $derived(readingName(device));
	const doingWord = $derived(
		t.doing === 'heating'
			? 'heating'
			: t.doing === 'cooling'
				? 'cooling'
				: t.doing === 'off'
					? 'off'
					: 'idle'
	);

	// ---- modes, or the schedule ----
	const plans = $derived(plansOf(t));
	const pickMode = (m: string) =>
		void commands.set(device.device_id, 'thermostat', { hvac_mode: m }, device.attributes);
	function pickPlan(p: Plan) {
		const s = planSend(t, device, p);
		if (s) send(s);
	}
	const at = (ms: number) =>
		new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

	// ---- the switch it runs ----
	const runsOn = $derived(
		typeof device.attributes.actuator_state === 'boolean'
			? device.attributes.actuator_state
			: runs?.attributes.on === true
	);
	const runsName = $derived(runs ? shortName(runs.name_override ?? runs.name, room) : undefined);
	const why = $derived.by(() => {
		if (t.doing === 'off') return 'The thermostat is off';
		if (target === undefined) return '';
		if (t.doing === 'heating') return `Warming to ${deg(target, t.unit)}`;
		if (t.doing === 'cooling') return `Cooling to ${deg(target, t.unit)}`;
		const r = device.schema ? reading(device.attributes, device.schema, 'reason') : undefined;
		return r && device.attributes.reason !== 'idle_in_band'
			? r
			: `Close enough to ${deg(target, t.unit)}`;
	});
	const middle = $derived(
		runsName
			? `runs ${runsName}`
			: t.schedule !== undefined
				? scheduleWords(t, at).toLowerCase()
				: ''
	);
	const note = $derived(commands.notes[device.device_id]);
</script>

<Col
	title={name}
	plugin={device.plugin_id}
	note={note ?? (device.available ? doingWord : 'offline')}
	alert={!!note || !device.available}
	width="calc(210px + 70px * var(--k, 1))"
	onopen={() => open(device)}
	place={device}
>
	<div
		class="dial"
		class:cool
		class:busy
		class:waiting={pending !== undefined}
		style:--arc={`${arcDeg}deg`}
	>
		{#if nowAt !== undefined}
			<span
				class="now"
				style:transform={`rotate(${225 + nowAt * 270}deg)`}
				title={`Now ${deg(t.now!, t.unit)}`}
				aria-hidden="true"><i></i></span
			>
		{/if}
		<div class="in">
			<small>{t.doing === 'off' ? 'Off' : aimWord(t)}</small>
			<b>{target === undefined ? '–' : deg(target, t.unit)}</b>
			<small>{nowOf} {t.now === undefined ? '–' : deg(t.now, t.unit)}</small>
		</div>
	</div>
	<div class="step">
		<button
			type="button"
			class="sb"
			aria-label={`Lower ${name}’s target`}
			disabled={locked || target === undefined || target <= t.min}
			onclick={() => press(-1)}>−</button
		>
		<span class="mid">{middle}</span>
		<button
			type="button"
			class="sb"
			aria-label={`Raise ${name}’s target`}
			disabled={locked || target === undefined || target >= t.max}
			onclick={() => press(1)}>+</button
		>
	</div>
	{#if t.modes.length > 1}
		<div class="seg" role="radiogroup" aria-label={`${name} mode`} style:--n={t.modes.length}>
			{#each t.modes as m (m.value)}
				<button
					type="button"
					role="radio"
					aria-checked={t.mode === m.value}
					class:on={t.mode === m.value}
					disabled={locked}
					onclick={() => pickMode(m.value)}>{m.label}</button
				>
			{/each}
		</div>
	{:else if plans.length > 0}
		<div class="seg" role="radiogroup" aria-label={`${name} schedule`} style:--n={plans.length}>
			{#each plans as p (p.id)}
				<button
					type="button"
					role="radio"
					aria-checked={t.schedule === p.id}
					class:on={t.schedule === p.id}
					disabled={locked}
					onclick={() => pickPlan(p.id)}>{p.label}</button
				>
			{/each}
		</div>
	{/if}
	{#if runs && !apart}
		<div class="rans">
			<button type="button" class="ran" onclick={() => open(runs)}>
				<span class="dot" class:busy={runsOn} aria-hidden="true"></span>
				<span>{runsName}: <b>{runsOn ? 'On' : 'Off'}</b> · {why}</span>
			</button>
			<Place d={runs} tag={false} />
		</div>
	{/if}
</Col>

{#if runs && apart}
	<Col
		title={runsName ?? ''}
		plugin={runs.plugin_id}
		note="its switch"
		width="calc(190px + 50px * var(--k, 1))"
		onopen={() => open(runs)}
		place={runs}
	>
		<div class="bar">
			<span class="dot" class:busy={runsOn} aria-hidden="true"></span>
			<b>{runs.available ? (runsOn ? 'On' : 'Off') : 'Offline'}</b>
			<small>{why}</small>
		</div>
		<p class="quiet">
			{name} turns it on and off. Switching it by hand would fight the thermostat, so it’s shown here
			and not switched.
		</p>
	</Col>
{/if}

<style>
	.dial {
		--size: calc(128px + 82px * var(--k, 1));
		--lo: #ffb35c;
		--hi: #ff6a3d;
		position: relative;
		width: var(--size);
		height: var(--size);
		margin: 0 auto;
		border-radius: 50%;
		background: conic-gradient(
			from 225deg,
			var(--lo) 0deg,
			var(--hi) var(--arc),
			color-mix(in srgb, var(--ink) 8%, transparent) var(--arc) 270deg,
			transparent 270deg
		);
		transition: box-shadow 0.3s;
	}
	.dial.cool {
		--lo: #9fe4ff;
		--hi: #3a8cff;
	}
	.dial.busy {
		box-shadow: 0 0 40px color-mix(in srgb, var(--hi) 45%, transparent);
	}
	.dial::before {
		content: '';
		position: absolute;
		inset: calc(10px + 4px * var(--k, 1));
		border-radius: 50%;
		background: radial-gradient(circle at 50% 30%, #1c1f27, #0d0f14 70%);
		box-shadow:
			inset 0 2px 10px rgba(0, 0, 0, 0.8),
			0 1px 0 rgba(255, 255, 255, 0.05);
	}
	:global(:root[data-theme='light']) .dial::before {
		background: radial-gradient(circle at 50% 30%, #fbfaf7, #e6e2d9 70%);
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.15);
	}
	/* The temperature now: a small mark on the ring. */
	.now {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.now i {
		position: absolute;
		left: 50%;
		top: 1px;
		width: 4px;
		height: calc(9px + 3px * var(--k, 1));
		margin-left: -2px;
		border-radius: 2px;
		background: var(--ink);
		box-shadow: 0 0 6px rgba(255, 255, 255, 0.7);
	}
	.in {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.in b {
		font-size: calc(34px + 20px * var(--k, 1));
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.waiting .in b {
		opacity: 0.7;
	}
	.in small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.step {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.mid {
		flex: 1;
		min-width: 0;
		font-size: 11.5px;
		color: var(--ink-muted);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sb {
		flex: none;
		width: calc(36px + 8px * var(--k, 1));
		height: calc(36px + 8px * var(--k, 1));
		border-radius: 50%;
		border: 0;
		font: 500 22px/1 var(--font);
		color: var(--ink);
		cursor: pointer;
		background: linear-gradient(180deg, #2a2d35, #1a1c22);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 6px 12px -6px rgba(0, 0, 0, 0.9);
	}
	:global(:root[data-theme='light']) .sb {
		background: linear-gradient(180deg, #ffffff, #e9e5dc);
		box-shadow:
			inset 0 1px 0 #fff,
			0 4px 10px -6px rgba(0, 0, 0, 0.4);
	}
	.sb:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.sb:focus-visible,
	.seg button:focus-visible,
	.ran:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(var(--n), auto);
		padding: 3px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.seg button {
		height: calc(26px + 4px * var(--k, 1));
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink-muted);
		font: 600 11.5px var(--font);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seg button.on {
		background: linear-gradient(140deg, #ffb35c, #ff7a3d);
		color: #2a1300;
	}
	.seg button:disabled {
		cursor: default;
	}
	.seg button:disabled:not(.on) {
		opacity: 0.5;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.bar b {
		font-size: calc(20px + 6px * var(--k, 1));
		font-weight: 700;
	}
	.bar small {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 22%, transparent);
	}
	.dot.busy {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.quiet {
		margin: 0;
		max-width: 260px;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--ink-muted);
	}
	.rans {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.ran {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-size: 11.5px;
		text-align: left;
		cursor: pointer;
	}
	.ran b {
		color: var(--ink);
	}
	.ran:hover span:last-child {
		text-decoration: underline;
	}
</style>
