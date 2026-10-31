<!--
	A room as a box (G-b — mockups A and B): its name and who's about, its big
	number, a line of what's on, and "All off". It glows as warm as the
	share of its lights that are on. What's wrong in the room always shows, in
	the alert colour (G6). The box opens the room; "All off" is its own control.
-->
<script lang="ts">
	import BatteryLow from '@lucide/svelte/icons/battery-low';
	import { allOff } from '#lib/allOff.js';
	import type { CoreDevice } from '#lib/devices.js';
	import type { Box } from '#lib/roomBox.js';
	import Icon from './Icon.svelte';

	let {
		href,
		name,
		box,
		devices,
		tiles = false
	}: {
		href?: string;
		name: string;
		box: Box;
		devices: CoreDevice[];
		/** The same size as every other room, rather than sized by what's in it. */
		tiles?: boolean;
	} = $props();

	const glow = $derived(Math.round(box.glow * 100));
	const lit = $derived(box.glow > 0);
</script>

<div class="box" class:alarm={box.alarm} class:tiles style={`--glow: ${glow}%`}>
	{#if href}<a {href} class="cover" aria-label={`Open ${name}`}></a>{/if}
	<div class="top">
		<span class="name">{name}</span>
		{#if box.badges.length > 0}
			<span class="badges">
				{#each box.badges as b (b.icon)}
					<span class="badge" class:warn={b.icon === 'battery'} title={b.label}>
						{#if b.icon === 'battery'}
							<BatteryLow size={14} aria-label={b.label} />
						{:else}
							<Icon name={b.icon} size={14} />
							<span class="sr">{b.label}</span>
						{/if}
					</span>
				{/each}
			</span>
		{/if}
	</div>
	<div class="bottom">
		<div class="numbers">
			{#if box.big !== undefined}<span class="big">{box.big}</span>{/if}
			<span class="line" class:lit
				>{#each box.lines as l, i (i)}{#if i > 0}<span class="sep"> · </span>{/if}<span
						class:bad={l.alert}>{l.text}</span
					>{:else}All quiet{/each}</span
			>
		</div>
		{#if box.allOff.length > 0}
			<button class="off" onclick={() => allOff(box.allOff, devices)}>All off</button>
		{/if}
	</div>
</div>

<style>
	.box {
		position: relative;
		height: 100%;
		min-height: 140px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 12px 12px 14px;
		border-radius: var(--radius);
		border: 1px solid var(--card-line);
		box-shadow: var(--shadow);
		background:
			radial-gradient(
				120% 110% at 50% 115%,
				color-mix(in srgb, var(--fill) var(--glow), transparent) 0%,
				transparent 72%
			),
			var(--surface);
		overflow: hidden;
		min-width: 0;
	}
	.alarm {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.cover {
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		z-index: 1;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 6px;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badges {
		display: flex;
		gap: 4px;
		flex: none;
	}
	.badge {
		width: 24px;
		height: 24px;
		border-radius: 8px;
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.badge.warn {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.bottom {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}
	.numbers {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.big {
		font-family: var(--font-num);
		font-size: 32px;
		line-height: 1;
	}
	.line {
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.line.lit {
		color: var(--lit-ink);
	}
	.bad {
		color: var(--alert);
		font-weight: 600;
	}
	.off {
		position: relative;
		z-index: 2;
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
		flex: none;
	}
</style>
