<!--
	A thermostat drawn small, for Everywhere › Climate (the Everywhere
	board): the same lit ring to its target as in its room's Climate tab
	(Thermo.svelte), the target and the temperature now inside, − and + under
	it with what it's doing, then its name and room. − and + move the target
	shown at once and send when the presses stop (`Nudge`), as in the room.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { deg, Nudge, sendFor, thermostatOf, type Send } from '#lib/thermostat.js';
	import { aimWord, dialAt, dialSpan } from './climate.js';
	import { brandOf, shortName } from './room.js';

	let {
		device,
		room,
		href,
		may
	}: {
		device: CoreDevice;
		/** The room's name, or "No room". */
		room: string;
		/** Its room's Climate tab. */
		href?: string;
		may: boolean;
	} = $props();

	const t = $derived(thermostatOf(device));
	const name = $derived(shortName(device.name_override ?? device.name, room));
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
	/** The temperature inside is the floor's, for a floor's heat. */
	const nowOf = $derived.by(() => {
		const said = device.schema?.attributes.temperature?.display_name;
		return said && !/^temperature$/i.test(said)
			? said.replace(/\s+temperature$/i, '').toLowerCase()
			: 'now';
	});
	const doing = $derived(
		!device.available
			? 'offline'
			: (commands.notes[device.device_id] ??
					(t.doing === 'heating'
						? 'heating'
						: t.doing === 'cooling'
							? 'cooling'
							: t.doing === 'off'
								? 'off'
								: 'idle'))
	);
</script>

<div class="mini">
	<div
		class="dial"
		class:cool
		class:busy
		class:waiting={pending !== undefined}
		style:--arc={`${arcDeg}deg`}
	>
		<div class="in">
			<small>{t.doing === 'off' ? 'Off' : aimWord(t)}</small>
			<b>{target === undefined ? '--' : deg(target, t.unit)}</b>
			<small>{nowOf} {t.now === undefined ? 'unknown' : deg(t.now, t.unit)}</small>
		</div>
	</div>
	<div class="step">
		<button
			type="button"
			class="xbtn"
			aria-label={`Lower ${name}’s target`}
			disabled={locked || target === undefined || target <= t.min}
			onclick={() => press(-1)}>−</button
		>
		<span class="doing" class:busy>{doing}</span>
		<button
			type="button"
			class="xbtn"
			aria-label={`Raise ${name}’s target`}
			disabled={locked || target === undefined || target >= t.max}
			onclick={() => press(1)}>+</button
		>
	</div>
	{#if href}<a class="nm" {href}>{name}</a>{:else}<b class="nm">{name}</b>{/if}
	<small class="where">{room} · {brandOf(device.plugin_id)}</small>
</div>

<style>
	.mini {
		width: 146px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.dial {
		--lo: #ffb35c;
		--hi: #ff6a3d;
		position: relative;
		width: 120px;
		height: 120px;
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
		box-shadow: 0 0 30px color-mix(in srgb, var(--hi) 40%, transparent);
	}
	.dial::before {
		content: '';
		position: absolute;
		inset: 10px;
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
	.in {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.in b {
		font-size: 30px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.waiting .in b {
		opacity: 0.7;
	}
	.in small {
		font-size: 11px;
		color: var(--ink-muted);
	}
	.step {
		width: 146px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.doing {
		flex: 1;
		min-width: 0;
		font-size: 11.5px;
		color: var(--ink-muted);
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.doing.busy {
		color: #ffb35c;
	}
	.cool + .step .doing.busy {
		color: #7fc4ff;
	}
	.nm {
		max-width: 100%;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		text-align: center;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	a.nm:hover {
		text-decoration: underline;
	}
	.where {
		max-width: 100%;
		margin-top: -4px;
		font-size: 11px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
