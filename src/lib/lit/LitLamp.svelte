<!--
	A light in the Lit look (12): a card you drag across to dim, filled with the
	light's own colour as far as it is up. A group ("Holiday Lights 1" to "4")
	is one card with a dot for each, and a switch for them all.
-->
<script lang="ts">
	import { commands } from '#lib/commands.svelte.js';
	import { goAhead } from '#lib/ask.js';
	import { session } from '#lib/me.svelte.js';
	import { isGroup, type Lamp, type LampGroup } from './room.js';

	let { lamp }: { lamp: Lamp | LampGroup } = $props();

	const group = $derived(isGroup(lamp) ? lamp : null);
	const one = $derived(isGroup(lamp) ? null : lamp);
	const may = $derived(session.mayUse);

	// Follows the finger; sent once, when it is let go.
	let dragging = $state<number | null>(null);
	const level = $derived(dragging ?? (one?.on ? (one.level ?? 100) : 0));

	function release(v: number) {
		dragging = null;
		if (!one) return;
		const d = one.card.device;
		void commands.set(
			d.device_id,
			one.view.kind,
			v === 0 ? { [one.attr]: false } : { brightness_pct: v, [one.attr]: true },
			d.attributes
		);
	}

	async function flip(l: Lamp) {
		if (
			!(await goAhead(
				l.card.device.device_id,
				l.view.kind,
				`Turn ${l.name} ${l.on ? 'off' : 'on'}?`
			))
		)
			return;
		void commands.set(
			l.card.device.device_id,
			l.view.kind,
			{ [l.attr]: !l.on },
			l.card.device.attributes
		);
	}
	const onCount = $derived(group ? group.members.filter((m) => m.on).length : 0);
	async function flipAll() {
		if (!group) return;
		const want = onCount === 0;
		for (const m of group.members)
			if (m.on !== want)
				void commands.set(
					m.card.device.device_id,
					m.view.kind,
					{ [m.attr]: want },
					m.card.device.attributes
				);
	}
	const rgb = $derived(
		group ? (group.members.find((m) => m.on)?.rgb ?? group.members[0]!.rgb) : one!.rgb
	);
</script>

{#if one}
	<div class="lamp" class:on={level > 0} style:--c={rgb} style:--fill={`${level}%`}>
		<div class="fill" aria-hidden="true"></div>
		<div class="words">
			<span class="top"><span class="pct">{level > 0 ? `${level}%` : 'Off'}</span></span>
			<span class="name">{one.name}</span>
			<span class="sub">{level > 0 ? one.view.stateLine : 'Drag across to turn on'}</span>
		</div>
		<input
			type="range"
			min="0"
			max="100"
			value={level}
			disabled={!may || !one.view.available}
			aria-label={`${one.name}, brightness`}
			oninput={(e) => (dragging = Number(e.currentTarget.value))}
			onchange={(e) => release(Number(e.currentTarget.value))}
		/>
	</div>
{:else if group}
	<div class="lamp group" class:on={onCount > 0} style:--c={rgb}>
		<div class="words">
			<span class="top">
				<span class="dots">
					{#each group.members as m (m.card.ref)}
						<button
							class="dot"
							class:on={m.on}
							disabled={!may}
							aria-pressed={m.on}
							aria-label={`${m.name}, ${m.on ? 'on' : 'off'}`}
							onclick={() => flip(m)}
						></button>
					{/each}
				</span>
				<button
					class="all"
					class:on={onCount > 0}
					disabled={!may}
					aria-label={onCount > 0 ? `Turn ${group.name} off` : `Turn ${group.name} on`}
					onclick={flipAll}><span></span></button
				>
			</span>
			<span class="name">{group.name}</span>
			<span class="sub"
				>{onCount === 0
					? 'Off'
					: onCount === group.members.length
						? `All ${onCount} on`
						: `${onCount} of ${group.members.length} on`}</span
			>
		</div>
	</div>
{/if}

<style>
	.lamp {
		position: relative;
		overflow: hidden;
		min-height: 112px;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.lamp.on {
		border-color: rgba(var(--c), 0.55);
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--fill);
		background: linear-gradient(90deg, rgba(var(--c), 0.16), rgba(var(--c), 0.45));
		transition: width 0.15s;
	}
	.group.on {
		background: linear-gradient(135deg, rgba(var(--c), 0.32), rgba(var(--c), 0.1));
	}
	.words {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		height: 100%;
		min-height: 112px;
		box-sizing: border-box;
		padding: 14px 16px;
		pointer-events: none;
	}
	.group .words {
		pointer-events: auto;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex: 1;
		align-self: stretch;
	}
	.pct {
		margin-left: auto;
		font-family: var(--font-num);
		font-size: 22px;
		color: var(--ink-muted);
	}
	.on .pct {
		color: var(--ink);
	}
	.name {
		font-weight: 700;
		font-size: 15px;
	}
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
	}
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: ew-resize;
	}
	.lamp:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.dots {
		display: flex;
		gap: 6px;
	}
	.dot {
		width: 26px;
		height: 26px;
		padding: 0;
		border-radius: 999px;
		border: 2px solid var(--ink-muted);
		background: transparent;
	}
	.dot.on {
		border-color: rgb(var(--c));
		background: rgb(var(--c));
		box-shadow: 0 0 10px rgba(var(--c), 0.9);
	}
	.all {
		width: 48px;
		height: 28px;
		padding: 3px;
		border: none;
		border-radius: 999px;
		background: var(--surface-2);
		display: flex;
	}
	.all.on {
		background: var(--accent);
		justify-content: flex-end;
	}
	.all span {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		background: #fff;
	}
</style>
