<!--
	The big numbers across the top of Home (G-b, mockup A): inside and
	outside, lights on, what's playing, what's open — the ones chosen, in the
	order chosen. About five fit a phone's row; more wrap to a second.
-->
<script lang="ts">
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { SUMMARY_BUILT_IN } from '#lib/options.js';
	import { bigNumbers } from '#lib/roomBox.js';
	import { byRoom } from '#lib/summary.js';

	let { card, page, options }: KindProps<'summary'> = $props();

	const numbers = $derived.by(() => {
		const grouped = byRoom(devices.byId, rooms.list);
		const now = clock.now;
		const all = Object.values(devices.byId);
		return bigNumbers(
			{
				all: devices.byId,
				rooms: rooms.list.map((r) => {
					const list = grouped.get(r.id) ?? [];
					return { name: r.name, devices: list, cards: list.map((d) => cardFor(d, now)) };
				}),
				cards: all.map((d) => cardFor(d, now))
			},
			options ?? kindOptions.of(page, 'summary', card.ref, SUMMARY_BUILT_IN)
		);
	});
</script>

<section class="clip" aria-label="The house at a glance">
	<div class="numbers">
		{#each numbers as n (n.id)}
			<div class="number">
				<span class="label">{n.label}</span>
				<span class="value" class:lit={n.lit}
					>{n.value}{#if n.unit}<span class="unit">{n.unit}</span>{/if}</span
				>
				<span class="sub">{n.sub}</span>
			</div>
		{/each}
	</div>
</section>

<style>
	/* Each number's rule is on its right; the last column's falls outside. */
	.clip {
		overflow: hidden;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}
	.numbers {
		margin-right: -1px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
		gap: 14px 8px;
		padding-top: 4px;
	}
	.number {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.value {
		font-family: var(--font-num);
		font-size: 28px;
		line-height: 1;
		font-weight: 500;
	}
	.value.lit {
		color: var(--lit-ink);
	}
	.unit {
		font-size: 16px;
		color: var(--ink-muted);
	}
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@media (min-width: 700px) {
		.numbers {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 18px 20px;
		}
		.number {
			padding-right: 20px;
			border-right: 1px solid var(--line);
		}
		.label {
			font-size: 11px;
			letter-spacing: 0.14em;
		}
		.value {
			font-size: 44px;
		}
		.unit {
			font-size: 20px;
		}
	}
</style>
