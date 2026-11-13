<!--
	What a summary chip on Home stands for: the lights that are on, what's
	open, what's playing — as cards, so they can be dealt with from here.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { cardFor } from '#lib/card.js';
	import { houseChips } from '#lib/summary.js';
	import { devices } from '#lib/devices.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import CardGrid from '#lib/components/CardGrid.svelte';

	const chips = $derived(houseChips(Object.values(devices.byId).map((d) => cardFor(d, clock.now))));
	const chip = $derived(chips.find((c) => c.key === page.params.key));
	// Kept on the page while it is open: a light turned off here stays listed,
	// so the switch doesn't vanish from under the finger.
	// Read without tracking: the effect writes `shown`, so tracking it would loop.
	let shown = $state<string[]>([]);
	let keyShown: string | undefined;
	$effect(() => {
		const key = page.params.key;
		const ids = chip?.ids ?? [];
		untrack(() => {
			const before = key === keyShown ? shown : [];
			keyShown = key;
			const next = [...new Set([...before, ...ids])];
			if (next.length !== shown.length || next.some((id, i) => id !== shown[i])) shown = next;
		});
	});
	const list = $derived(shown.map((id) => devices.byId[id]).filter((d) => d !== undefined));

	$effect(() => heading.show(chip?.text ?? 'Home'));
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if list.length === 0}
	<p class="quiet">Nothing to show now. <a href="/">Back to Home</a></p>
{:else}
	<div class="list"><CardGrid devices={list} /></div>
{/if}

<style>
	.list {
		max-width: 1100px;
	}
	.quiet {
		color: var(--ink-muted);
	}
</style>
