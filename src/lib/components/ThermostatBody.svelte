<!--
	A thermostat's card (the board "The thermostat card"), inside its card's
	frame (GenericDeviceCard keeps the link to its page, the long-press menu
	and its alert): a dial with the temperature now and the target, − and +,
	and its schedule. Compact is one row; Large adds how long − and + hold and
	its modes.

	− and + move the target shown at once and send when the presses stop
	(`Nudge`). On a schedule they hold the target, for as long as the card is
	set to (until the schedule changes unless chosen otherwise); without one
	they set it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { CardView } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { DEVICE_BUILT_IN, deviceKind } from '#lib/options.js';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import {
		DIAL,
		Nudge,
		deg,
		dialOf,
		lengthsOf,
		scheduleWords,
		sendFor,
		targetWords,
		thermostatOf,
		type HoldLength
	} from '#lib/thermostat.js';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Icon from './Icon.svelte';

	let {
		device,
		card,
		form,
		name,
		locked,
		options,
		layer
	}: {
		device: CoreDevice;
		card: CardView;
		form: 'compact' | 'standard' | 'large';
		name: string;
		locked: boolean;
		options?: Record<string, unknown>;
		/** Where this card's own settings are kept, for the hold length chosen on it. */
		layer?: { page: string; ref: string };
	} = $props();

	const t = $derived(thermostatOf(device));

	// ---- − and + ----
	let pending = $state<number | undefined>();
	let sentAt = 0;
	const nudge = new Nudge((value) => {
		sentAt = Date.now();
		const s = sendFor(t, device, value, length);
		if (s.kind === 'action') void commands.act(device.device_id, s.id, s.params);
		else void commands.set(device.device_id, card.kind, s.want, device.attributes);
	});
	$effect(() => () => nudge.stop());
	// The target arrived, or the house has had long enough: show its own again.
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

	// ---- how long − and + hold, kept on the card ----
	let chosen = $state<HoldLength | undefined>();
	const lengths = $derived(lengthsOf(t));
	const length = $derived.by((): HoldLength => {
		const want = chosen ?? (options?.hold as HoldLength | undefined) ?? 'next';
		return lengths.includes(want) ? want : 'next';
	});
	const LENGTH_WORDS: Record<HoldLength, string> = {
		next: 'Next change',
		hour: '1 h',
		two: '2 h',
		perm: 'Until changed'
	};
	function choose(l: HoldLength) {
		chosen = l;
		if (!layer) return;
		const own = kindOptions.card(layer.page, deviceKind(device), layer.ref, DEVICE_BUILT_IN);
		own.save({ ...own.without, ...own.mine, hold: l });
	}

	const doing = $derived(t.doing);
	const words = $derived(
		doing === 'heating'
			? 'Heating'
			: doing === 'cooling'
				? 'Cooling'
				: doing === 'off'
					? 'Off'
					: 'Idle'
	);
	const dial = $derived(dialOf(t, target));
	const at = (ms: number) => {
		const d = new Date(ms);
		const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		const today = new Date(clock.now).toDateString() === d.toDateString();
		return today ? time : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
	};
	const schedule = $derived(scheduleWords(t, at));
	const held = $derived(t.schedule === 'hold' || t.schedule === 'permanent_hold');
	const now = $derived(t.now === undefined ? '—' : String(Math.round(t.now)));
	const aim = $derived(targetWords(t, target));
	// Compact says the target beside what it's doing: "Cooling · target 72°".
	const small = $derived(
		t.dual && t.heat !== undefined && t.cool !== undefined
			? `${deg(t.heat, t.unit)}–${deg(t.cool, t.unit)}`
			: target === undefined
				? ''
				: `target ${deg(target, t.unit)}`
	);
	const resume = () => t.resume && void commands.act(device.device_id, t.resume);
	const setMode = (m: string) =>
		void commands.set(device.device_id, card.kind, { hvac_mode: m }, device.attributes);
</script>

{#snippet head(compact: boolean)}
	<div class="head">
		<span class="icon" class:heat={doing === 'heating'} class:cool={doing === 'cooling'}
			><Icon name={card.icon} size={compact ? 16 : 18} /></span
		>
		<span class="who">
			<span class="name">{name}</span>
			{#if compact}
				<span class="doing {doing}"
					>{words}<span class="aim" class:waiting={pending !== undefined}
						>{small ? ` · ${small}` : ''}</span
					></span
				>
			{:else if form !== 'large'}<span class="doing {doing}">{words}</span>{/if}
		</span>
		{#if form === 'large'}<span class="doing {doing}">{words}</span>{/if}
		{#if !compact}
			<a
				class="open"
				href={deviceHref(device.device_id, page.url)}
				aria-label={`${name} — details`}
				onclick={(e) => {
					if (e.metaKey || e.ctrlKey || e.shiftKey) return;
					e.preventDefault();
					openDevice(device.device_id, page.url);
				}}><span><ChevronRight size={15} /></span></a
			>
		{/if}
	</div>
{/snippet}

{#snippet buttons(small: boolean)}
	<button
		class="step"
		class:small
		aria-label={`Lower ${name}’s target`}
		disabled={locked || target === undefined || target <= t.min}
		onclick={() => press(-1)}>−</button
	>
	<button
		class="step"
		class:small
		aria-label={`Raise ${name}’s target`}
		disabled={locked || target === undefined || target >= t.max}
		onclick={() => press(1)}>+</button
	>
{/snippet}

{#snippet dialFace()}
	<div class="face">
		<div class="dial">
			<svg
				width={DIAL.w}
				height={DIAL.h}
				viewBox={`0 0 ${DIAL.w} ${DIAL.h}`}
				role="img"
				aria-label={`${name}: ${now}${t.unit} now, ${aim}`}
			>
				<path class="track" d={dial.track} />
				{#if dial.fill}<path class="fill" class:cool={dial.cooling} d={dial.fill} />{/if}
				{#if dial.now}<circle class="now" cx={dial.now[0]} cy={dial.now[1]} r="4" />{/if}
				{#if dial.target}
					<circle
						class="ring"
						class:cool={dial.cooling && !t.dual}
						cx={dial.target[0]}
						cy={dial.target[1]}
						r="11"
					/>
				{/if}
				{#if dial.cool}<circle class="ring cool" cx={dial.cool[0]} cy={dial.cool[1]} r="11" />{/if}
			</svg>
			<div class="middle">
				<span class="label">INSIDE</span>
				<span class="temp">{now}<span class="unit">{t.unit}</span></span>
				<span class="aim" class:waiting={pending !== undefined}>{aim}</span>
			</div>
		</div>
		<div class="steps">{@render buttons(false)}</div>
	</div>
{/snippet}

{#snippet chip()}
	<span class="chip" class:held>
		<Icon name={held ? 'lock' : 'timer'} size={13} />
		{schedule}
	</span>
{/snippet}

{#if form === 'compact'}
	<div class="compact">
		{@render head(true)}
		<div class="row">
			<span class="temp">{now}<span class="unit">{t.unit}</span></span>
			<span class="gap"></span>
			{@render buttons(true)}
		</div>
	</div>
{:else if form === 'standard'}
	<div class="standard">
		{@render head(false)}
		{@render dialFace()}
		<div class="chips">
			{@render chip()}
			{#if held && t.resume}
				<button class="pill" disabled={locked} onclick={resume}>Resume</button>
			{/if}
		</div>
	</div>
{:else}
	<div class="large">
		{@render head(false)}
		<div class="split">
			{@render dialFace()}
			<div class="side">
				<div class="group">
					<span class="label">SCHEDULE</span>
					{@render chip()}
					{#if held && t.resume}
						<button class="pill" disabled={locked} onclick={resume}>Resume the schedule</button>
					{/if}
				</div>
				{#if lengths.length > 1}
					<div class="group">
						<span class="label">− AND + HOLD IT</span>
						<span class="seg" role="radiogroup" aria-label="How long − and + hold it">
							{#each lengths as l (l)}
								<button
									role="radio"
									aria-checked={length === l}
									disabled={locked}
									onclick={() => choose(l)}>{LENGTH_WORDS[l]}</button
								>
							{/each}
						</span>
					</div>
				{/if}
				{#if t.modes.length > 1}
					<div class="group">
						<span class="label">MODE</span>
						<span class="seg" role="radiogroup" aria-label="Mode">
							{#each t.modes as m (m.value)}
								<button
									role="radio"
									aria-checked={t.mode === m.value}
									disabled={locked}
									onclick={() => setMode(m.value)}>{m.label}</button
								>
							{/each}
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.compact,
	.standard,
	.large {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.standard {
		gap: 4px;
	}
	.large {
		gap: 10px;
		container-type: inline-size;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.icon {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: var(--radius-chip);
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.compact .icon {
		width: 30px;
		height: 30px;
	}
	.icon.heat {
		background: var(--fill);
		color: var(--lit-ink);
	}
	.icon.cool {
		color: var(--cool);
	}
	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.compact .name {
		font-size: 14px;
	}
	.doing {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.doing.heating {
		color: var(--track-on);
	}
	.doing.cooling {
		color: var(--cool);
	}
	.open {
		position: relative;
		z-index: 2;
		flex: none;
		width: 44px;
		height: 44px;
		margin: -7px -7px -7px 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.open span {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* The dial and its − and +: 236 wide at most, smaller in a narrow card. */
	.face {
		width: 100%;
		max-width: 236px;
		align-self: center;
		flex: none;
		display: flex;
		flex-direction: column;
	}
	.dial {
		position: relative;
		width: 100%;
		aspect-ratio: 236 / 200;
		container-type: inline-size;
	}
	.dial svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.track,
	.fill {
		fill: none;
		stroke-width: 12;
		stroke-linecap: round;
	}
	.track {
		stroke: var(--track-off);
	}
	.fill {
		stroke: var(--track-on);
	}
	.fill.cool {
		stroke: var(--cool);
	}
	.now {
		fill: var(--ink);
	}
	.ring {
		fill: var(--surface);
		stroke: var(--track-on);
		stroke-width: 4;
	}
	.ring.cool {
		stroke: var(--cool);
	}
	.middle {
		position: absolute;
		inset: 22% 0 auto 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		pointer-events: none;
	}
	.label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--ink-muted);
	}
	.temp {
		font-family: var(--font-num);
		font-size: 46px;
		line-height: 1;
		font-weight: 500;
	}
	.unit {
		font-size: 18px;
		color: var(--ink-muted);
	}
	.aim {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.aim.waiting {
		color: var(--accent);
		font-weight: 600;
	}
	/* Under the dial, either side of its opening: clear of the arc's ends. */
	.steps {
		display: flex;
		justify-content: center;
		gap: 72px;
		margin-top: -12px;
	}
	.dial .temp {
		font-size: min(46px, 19.5cqw);
	}
	.dial .unit {
		font-size: min(18px, 7.6cqw);
	}
	.dial .aim {
		font-size: min(13px, 5.6cqw);
	}
	.step {
		position: relative;
		z-index: 2;
		width: var(--target);
		height: var(--target);
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 22px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.step.small {
		width: 36px;
		height: 36px;
		font-size: 18px;
	}
	/* A 44px target around the smaller button. */
	.step.small::before {
		content: '';
		position: absolute;
		inset: -4px;
	}
	.step:disabled,
	.pill:disabled,
	.seg button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.chips {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
		padding-top: 4px;
	}
	.chip {
		height: 30px;
		padding: 0 12px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
	}
	.chip.held {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.pill {
		position: relative;
		z-index: 2;
		height: 32px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		align-self: flex-start;
	}
	/* The pill's 44px target. */
	.pill::before {
		content: '';
		position: absolute;
		inset: -6px 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.row .temp {
		font-size: 30px;
	}
	.row .unit {
		font-size: 14px;
	}
	.gap {
		flex: 1;
	}
	.compact .doing {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.compact .doing .aim {
		font-size: 12px;
		font-weight: 500;
	}
	.split {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 14px;
	}
	.side {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	@container (min-width: 520px) {
		.split {
			flex-direction: row;
			align-items: center;
			gap: 18px;
		}
		.side {
			flex: 1;
		}
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	/* One line: four short choices, each as wide as its words. */
	.seg {
		position: relative;
		z-index: 2;
		display: flex;
		flex-wrap: nowrap;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.seg button {
		flex: 1 1 auto;
		min-height: 36px;
		padding: 0 7px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.seg button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
</style>
