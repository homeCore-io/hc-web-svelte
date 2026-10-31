<!--
	A room as a box (G-b — mockups A and B): its name and who's about, its big
	number, a line of what's on, and "All off". It glows as warm as the
	share of its lights that are on. What's wrong in the room always shows, in
	the alert colour (G6). The box opens the room; "All off" is its own control.
	In a narrow box "All off" moves up beside the name as a button with just
	its icon, so it never crowds the line.
-->
<script lang="ts">
	import BatteryLow from '@lucide/svelte/icons/battery-low';
	import Power from '@lucide/svelte/icons/power';
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
	<div class="frame">
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
		<div class="numbers">
			{#if box.big !== undefined}<span class="big">{box.big}</span>{/if}
			<span class="line" class:lit
				>{#each box.lines as l, i (i)}{#if i > 0}<span class="sep"> · </span>{/if}<span
						class:bad={l.alert}>{l.text}</span
					>{:else}All quiet{/each}</span
			>
		</div>
		{#if box.allOff.length > 0}
			<button
				class="off"
				aria-label={`All off in ${name}`}
				title="All off"
				onclick={() => allOff(box.allOff, devices)}
				><Power size={14} aria-hidden="true" /><span class="word">All off</span></button
			>
		{/if}
	</div>
</div>

<style>
	.box {
		position: relative;
		height: 100%;
		min-height: 140px;
		box-sizing: border-box;
		container-type: inline-size;
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
	/* Wide: name across the top, the numbers and "All off" along the bottom.
	   Narrow: "All off" beside the name, the numbers the whole width. */
	.frame {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'top top'
			'numbers off';
		column-gap: 8px;
		row-gap: 10px;
	}
	.top {
		grid-area: top;
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
		overflow-wrap: break-word;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
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
	.numbers {
		grid-area: numbers;
		align-self: end;
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
		grid-area: off;
		align-self: end;
		position: relative;
		z-index: 2;
		height: 32px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		gap: 5px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
	}
	.off :global(svg) {
		display: none;
	}
	/* A 44px target around the 32px button. */
	.off::before {
		content: '';
		position: absolute;
		inset: -6px;
	}
	@container (max-width: 250px) {
		.frame {
			grid-template-areas:
				'top off'
				'numbers numbers';
		}
		.off {
			align-self: start;
			width: 32px;
			padding: 0;
			justify-content: center;
			margin: -4px -4px 0 0;
		}
		.off :global(svg) {
			display: block;
		}
		.word {
			display: none;
		}
	}
</style>
