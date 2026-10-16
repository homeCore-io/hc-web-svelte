<!--
	A room on Home (C5): its name, a one-line summary, and "All off" while
	anything in it is on. The row opens the room; "All off" is a control of its
	own (D2).
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { CardView } from '#lib/card.js';
	import { allOffTargets, roomSummary } from '#lib/summary.js';
	import { commands } from '#lib/commands.svelte.js';
	import type { CoreDevice } from '#lib/devices.js';
	import Icon from './Icon.svelte';
	import RoomIcon from './RoomIcon.svelte';

	let {
		href,
		name,
		icon,
		cards,
		devices
	}: {
		href: string;
		name: string;
		/** The room's icon, as the household chose it (D10). */
		icon?: string;
		cards: CardView[];
		devices: CoreDevice[];
	} = $props();

	const summary = $derived(roomSummary(cards));
	const targets = $derived(allOffTargets(cards));
	const alert = $derived(cards.some((c) => c.alarm === 'wet'));

	function allOff() {
		for (const c of targets) {
			const d = devices.find((x) => x.device_id === c.id);
			if (d === undefined || c.control === null) continue;
			if (c.control.kind === 'switch')
				void commands.set(c.id, c.kind, { [c.control.attr]: false }, d.attributes);
			else if (d.schema?.attributes.on?.writable)
				void commands.set(c.id, c.kind, { on: false }, d.attributes);
			else if (d.schema?.actions?.some((a) => a.id === 'pause')) void commands.act(c.id, 'pause');
		}
	}
</script>

<div class="room" class:alert>
	<a {href} class="cover" aria-label={`Open ${name}`}></a>
	<span class="icon"
		>{#if alert}<Icon name="alert" />{:else}<RoomIcon name={icon} />{/if}</span
	>
	<span class="text">
		<span class="name">{name}</span>
		<span class="summary">{summary}</span>
	</span>
	{#if targets.length > 0}
		<button class="off" onclick={allOff}>All off</button>
	{/if}
	<ChevronRight size={18} aria-hidden="true" class="chev" />
</div>

<style>
	.room {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		box-sizing: border-box;
		padding: 10px 10px 10px 12px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		box-shadow: var(--shadow);
	}
	.cover {
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		z-index: 1;
	}
	.icon {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: var(--radius-chip);
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.alert {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.alert .icon {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		font-size: 15px;
		font-weight: 600;
	}
	.summary {
		font-size: 13px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.alert .summary {
		color: var(--alert);
		font-weight: 600;
	}
	.off {
		position: relative;
		z-index: 2;
		height: 36px;
		padding: 0 12px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		font-size: 13px;
		font-weight: 600;
		flex: none;
	}
	.room :global(.chev) {
		color: var(--ink-muted);
		flex: none;
	}
</style>
