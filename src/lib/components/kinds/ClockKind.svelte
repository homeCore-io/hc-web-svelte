<!-- The time and the date (14 §6), growing with its place. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { CLOCK_BUILT_IN } from '#lib/options.js';

	let { card, page, options }: KindProps<'clock'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'clock', card.ref, CLOCK_BUILT_IN));
	const seconds = $derived(o.seconds === true);

	let now = $state(new Date());
	$effect(() => {
		// Each second when it shows them; else on the minute.
		const s = seconds;
		const wait = () => (s ? 1000 - (Date.now() % 1000) : 60_000 - (Date.now() % 60_000));
		let t = setTimeout(function tick() {
			now = new Date();
			t = setTimeout(tick, wait());
		}, wait());
		return () => clearTimeout(t);
	});
	const time = $derived(
		now.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			...(seconds ? { second: '2-digit' } : {})
		})
	);
	const date = $derived(
		now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);
</script>

<div class="clock">
	<time datetime={now.toISOString()}>{time}</time>
	{#if o.date !== false}<span>{date}</span>{/if}
</div>

<style>
	.clock {
		container-type: size;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		min-height: 56px;
		height: 100%;
		box-sizing: border-box;
		padding: 8px 14px;
		border: 1px solid var(--card-line);
		border-radius: var(--feel-card-radius, var(--radius));
		background: var(--surface);
		min-width: 0;
	}
	time {
		font-size: clamp(22px, min(45cqh, 18cqw), 120px);
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	span {
		color: var(--ink-muted);
		font-size: clamp(12px, min(12cqh, 5cqw), 24px);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
