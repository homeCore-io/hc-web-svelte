<!-- What needs attention (N7): the first three alerts, and the way to the rest. -->
<script lang="ts">
	import { alerts } from '#lib/alerts.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import AlertList from '../AlertList.svelte';

	// Reads the alerts itself: the card only marks where they go.
	let {}: KindProps<'alerts'> = $props();
</script>

<AlertList list={alerts.list.slice(0, 3)} />
{#if alerts.list.length > 3}
	<a class="more" href="/alerts">All {alerts.list.length} alerts</a>
{/if}

<style>
	.more {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
</style>
